'use client';

import { consultationModeLabel, type AppointmentSlot } from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type Props = {
  bookingId: string;
  defaultStartsLocal: string;
  defaultEndsLocal: string;
  openOfflineSlots: AppointmentSlot[];
};

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatSlotOption(slot: AppointmentSlot): string {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  return `${start.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export function OverflowActions({
  bookingId,
  defaultStartsLocal,
  defaultEndsLocal,
  openOfflineSlots,
}: Props) {
  const router = useRouter();
  const [startsLocal, setStartsLocal] = useState(defaultStartsLocal);
  const [endsLocal, setEndsLocal] = useState(defaultEndsLocal);
  const [slotId, setSlotId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usingExistingSlot = Boolean(slotId);

  const slotHint = useMemo(() => {
    if (usingExistingSlot) return 'Assigning the selected open offline slot.';
    return 'Creates a new offline slot in this free window, then assigns the patient.';
  }, [usingExistingSlot]);

  async function onAccept() {
    setBusy('accept');
    setError(null);
    try {
      const supabase = createClient();
      const args: {
        p_booking_id: string;
        p_slot_id?: string | null;
        p_starts_at?: string | null;
        p_ends_at?: string | null;
      } = { p_booking_id: bookingId };

      if (slotId) {
        args.p_slot_id = slotId;
      } else {
        const startsAt = localInputToIso(startsLocal);
        const endsAt = localInputToIso(endsLocal);
        if (!startsAt || !endsAt) {
          throw new Error('Enter a valid start and end time.');
        }
        args.p_starts_at = startsAt;
        args.p_ends_at = endsAt;
      }

      const { error: rpcError } = await supabase.rpc('accept_overflow_booking', args);
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept request.');
    } finally {
      setBusy(null);
    }
  }

  async function onReject() {
    setBusy('reject');
    setError(null);
    try {
      const reason = rejectReason.trim();
      if (!reason) throw new Error('Reject reason is required.');

      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('reject_overflow_booking', {
        p_booking_id: bookingId,
        p_reject_reason: reason,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject request.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:max-w-md">
      {openOfflineSlots.length > 0 ? (
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Assign open offline slot</span>
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            disabled={busy != null}
            className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Create new slot instead…</option>
            {openOfflineSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {formatSlotOption(slot)} ({consultationModeLabel(slot.mode)})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!usingExistingSlot ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Starts</span>
            <input
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              disabled={busy != null}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Ends</span>
            <input
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              disabled={busy != null}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      <p className="text-xs text-muted">{slotHint}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void onAccept()}
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {busy === 'accept' ? 'Accepting…' : 'Accept & assign'}
        </button>
      </div>

      <label className="space-y-1 text-sm">
        <span className="font-medium text-foreground">Reject reason</span>
        <input
          type="text"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={busy != null}
          maxLength={500}
          placeholder="Shown to the patient"
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        disabled={busy != null || !rejectReason.trim()}
        onClick={() => void onReject()}
        className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-semibold text-danger hover:border-danger disabled:opacity-60"
      >
        {busy === 'reject' ? 'Rejecting…' : 'Reject request'}
      </button>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
