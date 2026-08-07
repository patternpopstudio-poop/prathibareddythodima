'use client';

import {
  CONSULTATION_FEE_DEFAULT_PAISE,
  CONSULTATION_FEE_MAX_PAISE,
  CONSULTATION_FEE_MIN_PAISE,
  type InviteUserResult,
} from '@teleconsult/shared-types';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type RoleOption = 'doctor' | 'admin';

const DEFAULT_FEE_RUPEES = CONSULTATION_FEE_DEFAULT_PAISE / 100;
const MIN_FEE_RUPEES = CONSULTATION_FEE_MIN_PAISE / 100;
const MAX_FEE_RUPEES = CONSULTATION_FEE_MAX_PAISE / 100;

export function InviteForm() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<RoleOption>('doctor');
  const [mobile, setMobile] = useState('');
  const [feeRupees, setFeeRupees] = useState(String(DEFAULT_FEE_RUPEES));
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

      let consultationFeePaise: number | undefined;
      if (role === 'doctor') {
        const rupees = Number(feeRupees);
        if (!Number.isInteger(rupees) || rupees < MIN_FEE_RUPEES || rupees > MAX_FEE_RUPEES) {
          throw new Error(
            `Consultation fee must be an integer between ₹${MIN_FEE_RUPEES} and ₹${MAX_FEE_RUPEES}.`
          );
        }
        consultationFeePaise = rupees * 100;
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
      const trimmedMobile = mobile.trim();
      let res: Response;
      try {
        res = await fetch(`${backendUrl}/invites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: email.trim(),
            fullName: fullName.trim(),
            role,
            mobile: trimmedMobile || undefined,
            consultationFeePaise,
            redirectTo: `${window.location.origin}/auth/callback`,
          }),
        });
      } catch {
        throw new Error(
          `Cannot reach backend at ${backendUrl}. Is it running (npm run dev in apps/backend)?`
        );
      }

      let body: InviteUserResult & { error?: unknown };
      try {
        body = (await res.json()) as InviteUserResult & { error?: unknown };
      } catch {
        throw new Error(`Invite failed (HTTP ${res.status}). Backend returned a non-JSON response.`);
      }

      if (!res.ok) {
        const err = body.error;
        const message =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object'
              ? JSON.stringify(err)
              : `Invite failed (HTTP ${res.status}).`;
        throw new Error(message);
      }

      setResult(body);
      setEmail('');
      setFullName('');
      setMobile('');
      setFeeRupees(String(DEFAULT_FEE_RUPEES));
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
        {role === 'doctor' ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Consultation fee (₹)
            <input
              type="number"
              required
              min={MIN_FEE_RUPEES}
              max={MAX_FEE_RUPEES}
              step={1}
              value={feeRupees}
              onChange={(e) => setFeeRupees(e.target.value)}
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
            <span className="text-xs font-normal text-muted">
              INR · ₹{MIN_FEE_RUPEES}–₹{MAX_FEE_RUPEES} per consult
            </span>
          </label>
        ) : null}

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
