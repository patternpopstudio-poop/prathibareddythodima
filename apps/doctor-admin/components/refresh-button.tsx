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
      aria-label={busy ? 'Refreshing' : label}
      title={label}
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={busy ? 'animate-spin' : undefined}
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
    </button>
  );
}
