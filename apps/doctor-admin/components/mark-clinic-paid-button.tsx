'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type Props = {
  bookingId: string;
};

export function MarkClinicPaidButton({ bookingId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onMarkPaid() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('mark_clinic_booking_paid', {
        p_booking_id: bookingId,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark paid.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onMarkPaid()}
        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Mark paid'}
      </button>
      {error ? <p className="max-w-[14rem] text-right text-xs text-danger">{error}</p> : null}
    </div>
  );
}
