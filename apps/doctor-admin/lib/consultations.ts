import type {
  AppointmentSlot,
  AppointmentSlotRow,
  Booking,
  BookingRow,
  Consultation,
  ConsultationMode,
  ConsultationRow,
  DoctorCaseQueue,
  Message,
  MessageAttachmentInput,
  MessageAttachmentMime,
  MessageRow,
  Patient,
  PatientRow,
} from '@teleconsult/shared-types';
import {
  CONSULTATION_ATTACHMENTS_BUCKET,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_BODY_MAX_LENGTH,
  OFFLINE_CHAT_UNAVAILABLE_COPY,
  consultationAttachmentObjectPath,
  isChatEnabledForMode,
  mapAppointmentSlotRow,
  mapBookingRow,
  mapConsultationRow,
  mapMessageRow,
  mapPatientRow,
  messageListPreview,
  normalizeMessageAttachmentMime,
} from '@teleconsult/shared-types';

import type { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;
type BrowserSupabase = ReturnType<typeof createBrowserClient>;

export type DoctorConsultationCase = {
  consultation: Consultation;
  patient: Patient;
  lastMessagePreview: string | null;
  booking?: Booking | null;
  slot?: AppointmentSlot | null;
};

type ConsultationJoinRow = ConsultationRow & {
  patients: PatientRow | PatientRow[] | null;
  messages?: Pick<MessageRow, 'body' | 'attachment_name' | 'created_at'>[] | null;
  bookings?:
    | (BookingRow & {
        appointment_slots?: AppointmentSlotRow | AppointmentSlotRow[] | null;
      })
    | (BookingRow & {
        appointment_slots?: AppointmentSlotRow | AppointmentSlotRow[] | null;
      })[]
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
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

export type DoctorCaseQueueCounts = {
  all: number;
  unreplied: number;
  responseAwaited: number;
};

export function parseDoctorCaseQueue(
  value: string | string[] | undefined
): DoctorCaseQueue {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'unreplied' || raw === 'response_awaited') return raw;
  return 'all';
}

export function doctorCaseQueueLabel(queue: DoctorCaseQueue): string {
  if (queue === 'unreplied') return 'Unreplied';
  if (queue === 'response_awaited') return 'Response awaited';
  return 'All';
}

export function doctorCaseQueueEmptyCopy(queue: DoctorCaseQueue): {
  title: string;
  description: string;
} {
  if (queue === 'unreplied') {
    return {
      title: 'No unreplied cases',
      description:
        'New consultations stay here until you send the first reply.',
    };
  }
  if (queue === 'response_awaited') {
    return {
      title: 'No responses awaited',
      description: 'When a patient messages again, the case shows up here.',
    };
  }
  return {
    title: 'No online cases yet',
    description:
      'When a patient confirms an online booking, a chat case appears here.',
  };
}

/** Doctor's cases, newest activity first. Mode + optional live queue filter. */
export async function fetchDoctorConsultations(
  supabase: Supabase,
  doctorId: string,
  options?: {
    limit?: number;
    queue?: DoctorCaseQueue;
    mode?: ConsultationMode;
  }
): Promise<DoctorConsultationCase[]> {
  const limit = options?.limit ?? 50;
  const queue = options?.queue ?? 'all';
  const mode = options?.mode ?? 'online';

  let query = supabase
    .from('consultations')
    .select(
      mode === 'offline'
        ? `
      *,
      patients (*),
      bookings (
        *,
        appointment_slots (*)
      )
    `
        : `
      *,
      patients (*),
      messages (body, attachment_name, created_at)
    `
    )
    .eq('doctor_id', doctorId)
    .eq('mode', mode);

  if (mode === 'online') {
    if (queue === 'unreplied') {
      query = query.eq('status', 'open');
    } else if (queue === 'response_awaited') {
      query = query
        .eq('status', 'in_progress')
        .eq('last_message_sender_role', 'patient');
    }
  }

  const ordered =
    mode === 'offline'
      ? query.order('created_at', { ascending: false }).limit(limit)
      : query
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('created_at', { ascending: false, foreignTable: 'messages' })
          .limit(1, { foreignTable: 'messages' })
          .limit(limit);

  const { data, error } = await ordered;

  if (error) throw error;

  const mapped: DoctorConsultationCase[] = [];
  for (const row of (data as ConsultationJoinRow[] | null) ?? []) {
    const patientRow = firstRelation(row.patients);
    if (!patientRow) continue;
    const latest = row.messages?.[0];
    const bookingRow = firstRelation(row.bookings);
    const slotRow = bookingRow
      ? firstRelation(bookingRow.appointment_slots)
      : null;
    mapped.push({
      consultation: mapConsultationRow(row),
      patient: mapPatientRow(patientRow),
      lastMessagePreview: messageListPreview(
        latest
          ? { body: latest.body, attachmentName: latest.attachment_name }
          : null
      ),
      booking: bookingRow ? mapBookingRow(bookingRow) : null,
      slot: slotRow ? mapAppointmentSlotRow(slotRow) : null,
    });
  }
  return mapped;
}

/** Map booking id → consultation id for agenda “Open Consultation” links. */
export async function fetchConsultationIdsByBookingIds(
  supabase: Supabase,
  bookingIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(bookingIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('consultations')
    .select('id, booking_id')
    .in('booking_id', ids);

  if (error) throw error;

  for (const row of (data as { id: string; booking_id: string }[] | null) ?? []) {
    if (row.id && row.booking_id) map.set(row.booking_id, row.id);
  }
  return map;
}

/** Counts for dashboard / Cases queue tabs (online chat cases only). */
export async function fetchDoctorCaseQueueCounts(
  supabase: Supabase,
  doctorId: string
): Promise<DoctorCaseQueueCounts> {
  const [allRes, unrepliedRes, awaitedRes] = await Promise.all([
    supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('mode', 'online'),
    supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('mode', 'online')
      .eq('status', 'open'),
    supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('mode', 'online')
      .eq('status', 'in_progress')
      .eq('last_message_sender_role', 'patient'),
  ]);

  if (allRes.error) throw allRes.error;
  if (unrepliedRes.error) throw unrepliedRes.error;
  if (awaitedRes.error) throw awaitedRes.error;

  return {
    all: allRes.count ?? 0,
    unreplied: unrepliedRes.count ?? 0,
    responseAwaited: awaitedRes.count ?? 0,
  };
}

export async function fetchDoctorConsultationById(
  supabase: Supabase,
  doctorId: string,
  consultationId: string
): Promise<DoctorConsultationCase | null> {
  const { data, error } = await supabase
    .from('consultations')
    .select(
      `
      *,
      patients (*),
      bookings (
        *,
        appointment_slots (*)
      )
    `
    )
    .eq('id', consultationId)
    .eq('doctor_id', doctorId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ConsultationJoinRow;
  const patientRow = firstRelation(row.patients);
  if (!patientRow) return null;

  const bookingRow = firstRelation(row.bookings);
  const slotRow = bookingRow
    ? firstRelation(bookingRow.appointment_slots)
    : null;

  return {
    consultation: mapConsultationRow(row),
    patient: mapPatientRow(patientRow),
    lastMessagePreview: null,
    booking: bookingRow ? mapBookingRow(bookingRow) : null,
    slot: slotRow ? mapAppointmentSlotRow(slotRow) : null,
  };
}

export async function fetchConsultationMessages(
  supabase: Supabase,
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

/** Upload a file into the private consultation-attachments bucket. */
export async function uploadConsultationAttachment(
  supabase: BrowserSupabase,
  consultationId: string,
  file: File
): Promise<MessageAttachmentInput> {
  await assertOnlineChat(supabase, consultationId);

  const trimmedName = file.name.trim() || 'attachment';
  const { mime, sizeBytes } = validateAttachmentMeta(
    trimmedName,
    file.type,
    file.size
  );

  const path = consultationAttachmentObjectPath(consultationId, trimmedName);
  const { error: uploadError } = await supabase.storage
    .from(CONSULTATION_ATTACHMENTS_BUCKET)
    .upload(path, file, {
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
  supabase: BrowserSupabase,
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

async function assertOnlineChat(
  supabase: BrowserSupabase,
  consultationId: string
): Promise<void> {
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

/** Send a text message as the signed-in doctor. */
export async function sendDoctorMessage(
  supabase: BrowserSupabase,
  consultationId: string,
  doctorUserId: string,
  body: string
): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > MESSAGE_BODY_MAX_LENGTH) {
    throw new Error(`Message must be at most ${MESSAGE_BODY_MAX_LENGTH} characters.`);
  }

  await assertOnlineChat(supabase, consultationId);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      consultation_id: consultationId,
      sender_id: doctorUserId,
      sender_role: 'doctor',
      body: trimmed,
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Could not send message.');
  return mapMessageRow(data as MessageRow);
}

/** Upload + send an attachment (optional caption) as the signed-in doctor. */
export async function sendDoctorAttachment(
  supabase: BrowserSupabase,
  consultationId: string,
  doctorUserId: string,
  file: File,
  caption?: string | null
): Promise<Message> {
  const trimmedCaption = caption?.trim() || null;
  if (trimmedCaption && trimmedCaption.length > MESSAGE_BODY_MAX_LENGTH) {
    throw new Error(`Message must be at most ${MESSAGE_BODY_MAX_LENGTH} characters.`);
  }

  await assertOnlineChat(supabase, consultationId);

  const attachment = await uploadConsultationAttachment(
    supabase,
    consultationId,
    file
  );

  const { data, error } = await supabase
    .from('messages')
    .insert({
      consultation_id: consultationId,
      sender_id: doctorUserId,
      sender_role: 'doctor',
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

export { MESSAGE_BODY_MAX_LENGTH };

/** Mark peer messages as read (online consultation only). */
export async function markConsultationMessagesRead(
  supabase: BrowserSupabase,
  consultationId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('mark_consultation_messages_read', {
    p_consultation_id: consultationId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** Build a browser Realtime channel (caller must `.subscribe()` / `removeChannel`). */
export function subscribeConsultationThread(
  supabase: BrowserSupabase,
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
