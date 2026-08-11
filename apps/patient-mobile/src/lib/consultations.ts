import type {
  Consultation,
  ConsultationRow,
  Doctor,
  DoctorRow,
  Message,
  MessageAttachmentInput,
  MessageAttachmentMime,
  MessageRow,
} from '@teleconsult/shared-types';
import {
  CONSULTATION_ATTACHMENTS_BUCKET,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_BODY_MAX_LENGTH,
  OFFLINE_CHAT_UNAVAILABLE_COPY,
  consultationAttachmentObjectPath,
  isChatEnabledForMode,
  mapConsultationRow,
  mapDoctorRow,
  mapMessageRow,
  messageListPreview,
  normalizeMessageAttachmentMime,
} from '@teleconsult/shared-types';

import { supabase } from '@/lib/supabase';

export type PatientConsultationCase = {
  consultation: Consultation;
  doctor: Doctor;
  /** Latest message body / attachment preview when available. */
  lastMessagePreview: string | null;
};

type ConsultationJoinRow = ConsultationRow & {
  doctors: DoctorRow | DoctorRow[] | null;
  messages?: Pick<MessageRow, 'body' | 'attachment_name' | 'created_at'>[] | null;
};

export type AttachmentUploadSource = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Patient's online consultation cases (chat inbox), newest activity first. */
export async function fetchPatientConsultations(
  limit = 40
): Promise<PatientConsultationCase[]> {
  const { data, error } = await supabase
    .from('consultations')
    .select(
      `
      *,
      doctors (*),
      messages (body, attachment_name, created_at)
    `
    )
    .eq('mode', 'online')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('created_at', { ascending: false, foreignTable: 'messages' })
    .limit(1, { foreignTable: 'messages' })
    .limit(limit);

  if (error) throw error;

  const mapped: PatientConsultationCase[] = [];
  for (const row of (data as ConsultationJoinRow[] | null) ?? []) {
    const doctorRow = firstRelation(row.doctors);
    if (!doctorRow) continue;
    const latest = row.messages?.[0];
    mapped.push({
      consultation: mapConsultationRow(row),
      doctor: mapDoctorRow(doctorRow),
      lastMessagePreview: messageListPreview(
        latest
          ? { body: latest.body, attachmentName: latest.attachment_name }
          : null
      ),
    });
  }
  return mapped;
}

export async function fetchPatientConsultationById(
  consultationId: string
): Promise<PatientConsultationCase | null> {
  const { data, error } = await supabase
    .from('consultations')
    .select(
      `
      *,
      doctors (*)
    `
    )
    .eq('id', consultationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ConsultationJoinRow;
  const doctorRow = firstRelation(row.doctors);
  if (!doctorRow) return null;

  return {
    consultation: mapConsultationRow(row),
    doctor: mapDoctorRow(doctorRow),
    lastMessagePreview: null,
  };
}

/** Messages oldest → newest for a consultation the patient can access. */
export async function fetchConsultationMessages(
  consultationId: string,
  limit = 200
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return ((data as MessageRow[] | null) ?? []).map(mapMessageRow);
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not signed in.');
  return user.id;
}

async function assertOnlineChat(consultationId: string): Promise<void> {
  const { data, error } = await supabase
    .from('consultations')
    .select('mode')
    .eq('id', consultationId)
    .maybeSingle();
  if (error) throw error;
  const mode = data?.mode === 'offline' ? 'offline' : 'online';
  if (!isChatEnabledForMode(mode)) {
    throw new Error(OFFLINE_CHAT_UNAVAILABLE_COPY);
  }
}

function validateAttachmentMeta(
  name: string,
  mimeType: string | null | undefined,
  size: number | null | undefined
): { mime: MessageAttachmentMime; sizeBytes: number } {
  const mime = normalizeMessageAttachmentMime(mimeType, name);
  if (!mime) {
    throw new Error('Only PDF, JPG, and PNG files are allowed.');
  }
  const sizeBytes = size ?? 0;
  if (!sizeBytes || sizeBytes <= 0) {
    throw new Error('Could not read file size.');
  }
  if (sizeBytes > MESSAGE_ATTACHMENT_MAX_BYTES) {
    throw new Error('File must be 10 MB or smaller.');
  }
  return { mime, sizeBytes };
}

/** Upload a file into the private consultation-attachments bucket. */
export async function uploadConsultationAttachment(
  consultationId: string,
  source: AttachmentUploadSource
): Promise<MessageAttachmentInput> {
  await assertOnlineChat(consultationId);

  const trimmedName = source.name.trim() || 'attachment';
  const { mime, sizeBytes } = validateAttachmentMeta(
    trimmedName,
    source.mimeType,
    source.size
  );

  const path = consultationAttachmentObjectPath(consultationId, trimmedName);
  const response = await fetch(source.uri);
  if (!response.ok) {
    throw new Error('Could not read the selected file.');
  }
  const bytes = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(CONSULTATION_ATTACHMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  return {
    path,
    name: trimmedName.slice(0, 255),
    mime,
    sizeBytes,
  };
}

/** Short-lived signed URL for viewing a private attachment. */
export async function createConsultationAttachmentSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CONSULTATION_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not create download link.');
  return data.signedUrl;
}

/** Send a text message as the signed-in patient. */
export async function sendPatientMessage(
  consultationId: string,
  body: string
): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > MESSAGE_BODY_MAX_LENGTH) {
    throw new Error(`Message must be at most ${MESSAGE_BODY_MAX_LENGTH} characters.`);
  }

  await assertOnlineChat(consultationId);
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      consultation_id: consultationId,
      sender_id: userId,
      sender_role: 'patient',
      body: trimmed,
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Could not send message.');
  return mapMessageRow(data as MessageRow);
}

/** Upload + send an attachment (optional caption) as the signed-in patient. */
export async function sendPatientAttachment(
  consultationId: string,
  source: AttachmentUploadSource,
  caption?: string | null
): Promise<Message> {
  const trimmedCaption = caption?.trim() || null;
  if (trimmedCaption && trimmedCaption.length > MESSAGE_BODY_MAX_LENGTH) {
    throw new Error(`Message must be at most ${MESSAGE_BODY_MAX_LENGTH} characters.`);
  }

  const attachment = await uploadConsultationAttachment(consultationId, source);
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('messages')
    .insert({
      consultation_id: consultationId,
      sender_id: userId,
      sender_role: 'patient',
      body: trimmedCaption,
      attachment_path: attachment.path,
      attachment_name: attachment.name,
      attachment_mime: attachment.mime,
      attachment_size_bytes: attachment.sizeBytes,
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Could not send attachment.');
  return mapMessageRow(data as MessageRow);
}

export function consultationStatusLabel(status: Consultation['status']): string {
  return status === 'in_progress' ? 'In progress' : 'Open';
}

export function formatConsultationActivity(iso: string | null | undefined): string {
  if (!iso) return 'No messages yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No messages yet';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Mark peer messages as read (online consultation only). */
export async function markConsultationMessagesRead(
  consultationId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('mark_consultation_messages_read', {
    p_consultation_id: consultationId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/**
 * Subscribe to new messages (+ consultation status) for a thread.
 * Caller must `removeChannel` / unsubscribe on cleanup.
 */
/** Build a Realtime channel (caller must `.subscribe()` / `removeChannel`). */
export function subscribeConsultationThread(
  consultationId: string,
  handlers: {
    onMessage: (message: Message) => void;
    onMessageUpdate?: (message: Message) => void;
    onConsultation?: (consultation: Consultation) => void;
  }
) {
  return supabase
    .channel(`consultation-thread:${consultationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `consultation_id=eq.${consultationId}`,
      },
      (payload) => {
        handlers.onMessage(mapMessageRow(payload.new as MessageRow));
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `consultation_id=eq.${consultationId}`,
      },
      (payload) => {
        handlers.onMessageUpdate?.(mapMessageRow(payload.new as MessageRow));
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'consultations',
        filter: `id=eq.${consultationId}`,
      },
      (payload) => {
        handlers.onConsultation?.(mapConsultationRow(payload.new as ConsultationRow));
      }
    );
}
