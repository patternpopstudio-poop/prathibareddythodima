'use client';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void onSignOut()}
      aria-label="Sign out"
      title="Sign out"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-muted transition hover:bg-background hover:text-foreground"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path
          d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15 12H3m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
