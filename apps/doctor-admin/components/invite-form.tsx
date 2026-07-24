'use client';

import { useState } from 'react';

import type { InviteUserResult } from '@teleconsult/shared-types';

import { createClient } from '@/lib/supabase/client';

type RoleOption = 'doctor' | 'admin';

export function InviteForm() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<RoleOption>('doctor');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteUserResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not signed in.');
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
      const res = await fetch(`${backendUrl}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          fullName,
          role,
          mobile: mobile || undefined,
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      });

      const body = (await res.json()) as InviteUserResult & { error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof body.error === 'string' ? body.error : 'Invite failed. Is the backend running?'
        );
      }

      setResult(body);
      setEmail('');
      setFullName('');
      setMobile('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="max-w-lg space-y-4 rounded-[20px] bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Full name
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleOption)}
            className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
          >
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Mobile (optional)
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
          />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? 'Creating invite…' : 'Create invite'}
        </button>
      </form>

      {result ? (
        <div className="max-w-lg space-y-2 rounded-[20px] border border-primary/20 bg-primary-soft p-6 text-sm">
          <p className="font-semibold text-primary">Invite created</p>
          <p>
            <span className="text-muted">User:</span> {result.email} ({result.role})
          </p>
          {result.actionLink ? (
            <p className="break-all">
              <span className="text-muted">Setup link:</span> {result.actionLink}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
