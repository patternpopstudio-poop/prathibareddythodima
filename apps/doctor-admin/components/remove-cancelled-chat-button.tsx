'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { archiveDoctorConsultation } from '@/lib/consultations';
import { createClient } from '@/lib/supabase/client';

type Props = {
  consultationId: string;
  doctorUserId: string;
};

export function RemoveCancelledChatButton({ consultationId, doctorUserId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void (async () => {
            try {
              const supabase = createClient();
              await archiveDoctorConsultation(supabase, consultationId, doctorUserId);
              router.push('/cases');
              router.refresh();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not remove this chat.'
              );
              setBusy(false);
            }
          })();
        }}
        className="rounded-2xl border border-danger/30 bg-red-50 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-red-100 disabled:opacity-60"
      >
        {busy ? 'Removing…' : 'Remove chat'}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
