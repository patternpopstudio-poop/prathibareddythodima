'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  label?: string;
};

export function RefreshButton({ label = 'Refresh' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        window.setTimeout(() => setBusy(false), 400);
      }}
      className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
    >
      {busy ? 'Refreshing…' : label}
    </button>
  );
}
