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
      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary"
    >
      Sign out
    </button>
  );
}
