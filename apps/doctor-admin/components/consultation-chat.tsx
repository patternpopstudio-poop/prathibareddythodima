'use client';

import type { Consultation, Message } from '@teleconsult/shared-types';
import {
  DOCTOR_CHAT_LOCKED_COPY,
  MESSAGE_BODY_MAX_LENGTH,
  appendMessageIfNew,
  doctorChatUnlockAtMs,
  isDoctorChatOpen,
  isImageAttachmentMime,
  mapMessageRow,
  messageReceiptLabel,
  upsertMessageById,
  type MessageRow,
} from '@teleconsult/shared-types';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import {
  consultationStatusLabel,
  createConsultationAttachmentSignedUrl,
  markConsultationMessagesRead,
  sendDoctorAttachment,
  sendDoctorMessage,
  subscribeConsultationThread,
} from '@/lib/consultations';
import { createClient } from '@/lib/supabase/client';

type Props = {
  consultationId: string;
  doctorUserId: string;
  initialMessages: Message[];
  initialStatus: Consultation['status'];
  slotStartsAt?: string | null;
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function MessageAttachment({
  message,
  mine,
}: {
  message: Message;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ensureUrl = useCallback(async () => {
    if (!message.attachmentPath) return null;
    if (url) return url;
    setLoading(true);
    setErr(null);
    try {
      const supabase = createClient();
      const signed = await createConsultationAttachmentSignedUrl(
        supabase,
        message.attachmentPath
      );
      setUrl(signed);
      return signed;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open file.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [message.attachmentPath, url]);

  useEffect(() => {
    if (isImageAttachmentMime(message.attachmentMime)) {
      void ensureUrl();
    }
  }, [ensureUrl, message.attachmentMime]);

  async function onOpen() {
    const signed = await ensureUrl();
    if (!signed) return;
    window.open(signed, '_blank', 'noopener,noreferrer');
  }

  if (!message.attachmentPath || !message.attachmentName) return null;

  const isImage = isImageAttachmentMime(message.attachmentMime);

  return (
    <div className="space-y-2">
      {isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
        <img
          src={url}
          alt={message.attachmentName}
          className="max-h-48 max-w-full cursor-pointer rounded-xl object-cover"
          onClick={() => void onOpen()}
        />
      ) : null}
      <button
        type="button"
        onClick={() => void onOpen()}
        disabled={loading}
        className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium underline-offset-2 hover:underline disabled:opacity-60 ${
          mine ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary'
        }`}
      >
        {loading ? 'Opening…' : message.attachmentName}
      </button>
      {err ? <p className="text-[11px] text-danger">{err}</p> : null}
    </div>
  );
}

function formatUnlockTime(iso: string): string {
  const unlockMs = doctorChatUnlockAtMs(iso);
  const d = new Date(unlockMs ?? iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M12 16V7m0 0-3.5 3.5M12 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReloadIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={spinning ? 'animate-spin' : undefined}
      aria-hidden
    >
      <path
        d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 16h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConsultationChat({
  consultationId,
  doctorUserId,
  initialMessages,
  initialStatus,
  slotStartsAt,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatUnlocked = isDoctorChatOpen(slotStartsAt, nowMs);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (chatUnlocked) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [chatUnlocked]);

  useEffect(() => {
    const supabase = createClient();

    void markConsultationMessagesRead(supabase, consultationId).catch(() => {
      // Best-effort; RLS/RPC errors should not block the thread.
    });

    const channel = subscribeConsultationThread(supabase, consultationId, {
      onMessage: (message) => {
        setMessages((prev) => appendMessageIfNew(prev, message));
        if (message.senderId !== doctorUserId) {
          void markConsultationMessagesRead(supabase, consultationId).catch(() => {});
        }
      },
      onMessageUpdate: (message) => {
        setMessages((prev) => upsertMessageById(prev, message));
      },
      onConsultation: (consultation) => {
        setStatus(consultation.status);
      },
    });

    channel.subscribe((subStatus) => {
      setLive(subStatus === 'SUBSCRIBED');
    });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [consultationId, doctorUserId]);

  async function reload() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: loadErr } = await supabase
        .from('messages')
        .select('*')
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (loadErr) throw loadErr;
      setMessages(((data as MessageRow[] | null) ?? []).map(mapMessageRow));
      void markConsultationMessagesRead(supabase, consultationId).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reload messages.');
    } finally {
      setBusy(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy || !chatUnlocked) return;

    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const sent = await sendDoctorMessage(
        supabase,
        consultationId,
        doctorUserId,
        text
      );
      setDraft('');
      setMessages((prev) => appendMessageIfNew(prev, sent));
      setStatus('in_progress');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy || !chatUnlocked) return;

    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const sent = await sendDoctorAttachment(
        supabase,
        consultationId,
        doctorUserId,
        file,
        draft
      );
      setDraft('');
      setMessages((prev) => appendMessageIfNew(prev, sent));
      setStatus('in_progress');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="text-sm text-muted">
          {consultationStatusLabel(status)}
          {live ? ' · Live' : ' · Connecting…'}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reload()}
          aria-label={busy ? 'Reloading messages' : 'Reload messages'}
          title="Reload"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ReloadIcon spinning={busy} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No messages yet.{' '}
            {chatUnlocked
              ? 'Reply to the patient to start the consultation.'
              : DOCTOR_CHAT_LOCKED_COPY}
          </p>
        ) : (
          messages.map((item) => {
            const mine = item.senderId === doctorUserId || item.senderRole === 'doctor';
            const body = item.body?.trim();
            return (
              <div
                key={item.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] space-y-1.5 rounded-2xl px-4 py-2.5 ${
                    mine
                      ? 'rounded-br-md bg-primary text-white'
                      : 'rounded-bl-md border border-border bg-background text-foreground'
                  }`}
                >
                  {item.attachmentPath ? (
                    <MessageAttachment message={item} mine={mine} />
                  ) : null}
                  {body ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
                  ) : null}
                  <p
                    className={`text-[11px] ${mine ? 'text-white/75' : 'text-muted'}`}
                  >
                    {formatMessageTime(item.createdAt)}
                    {mine ? ` · ${messageReceiptLabel(item)}` : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-5 text-sm text-danger">{error}</p> : null}

      {!chatUnlocked ? (
        <p className="px-5 pb-2 text-sm text-muted">
          {DOCTOR_CHAT_LOCKED_COPY}
          {slotStartsAt ? ` Messaging unlocks at ${formatUnlockTime(slotStartsAt)}.` : ''}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void onSend(e)}
        className="flex items-end gap-3 border-t border-border px-5 py-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => void onFileChange(e)}
        />
        <button
          type="button"
          disabled={busy || !chatUnlocked}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload file"
          title="Upload file"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-primary hover:bg-primary-soft disabled:opacity-45"
        >
          <UploadIcon />
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={MESSAGE_BODY_MAX_LENGTH}
          placeholder={chatUnlocked ? 'Write a reply…' : 'Chat locked until 10 minutes before the appointment'}
          disabled={busy || !chatUnlocked}
          className="min-h-[2.75rem] flex-1 resize-y rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !chatUnlocked || !draft.trim()}
          className="h-11 rounded-2xl bg-primary px-5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-45"
        >
          Send
        </button>
      </form>
    </div>
  );
}
