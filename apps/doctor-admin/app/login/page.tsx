'use client';

import { getRoleFromAppMetadata, isStaffRole } from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { completeAuthFromUrl, destinationForAuthLink } from '@/lib/auth-callback';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const hashRecoveryStarted = useRef(false);

  // Invite/recovery links sometimes land on /login with tokens still in the hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('access_token=')) return;
    if (hashRecoveryStarted.current) return;
    hashRecoveryStarted.current = true;

    setRecovering(true);

    async function recoverFromHash() {
      try {
        const result = await completeAuthFromUrl(new URL(window.location.href));
        if (!result.ok) {
          setError(result.message);
          setRecovering(false);
          window.history.replaceState({}, '', '/login');
          return;
        }
        window.location.replace(destinationForAuthLink(result.linkType));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invite link failed.');
        setRecovering(false);
        window.history.replaceState({}, '', '/login');
      }
    }

    void recoverFromHash();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      const role = getRoleFromAppMetadata(
        data.user?.app_metadata as Record<string, unknown> | undefined
      );

      if (!isStaffRole(role)) {
        await supabase.auth.signOut();
        throw new Error('This portal is for doctors and admins only.');
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
      setLoading(false);
    }
  }

  if (recovering) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm text-muted">Opening your invite link…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-[20px] bg-surface p-8 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">TELECONSULT</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Doctor & admin sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Use the email from your admin invite to continue. New invites open a set-password screen
          first.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
