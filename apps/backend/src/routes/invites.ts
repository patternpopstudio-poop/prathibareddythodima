import type { InviteUserResult } from '@teleconsult/shared-types';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['doctor', 'admin']),
  fullName: z.string().min(1).max(200),
  mobile: z.string().min(6).max(20).optional(),
  redirectTo: z.string().url().optional(),
});

type InviteRole = z.infer<typeof inviteSchema>['role'];

/** Align patients/doctors with invited role after createUser's metadata UPDATE. */
async function ensureInviteProfile(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  input: {
    userId: string;
    role: InviteRole;
    fullName: string;
    email: string;
    mobile?: string;
  }
): Promise<string | null> {
  if (input.role === 'doctor') {
    const { error: delErr } = await admin.from('patients').delete().eq('id', input.userId);
    if (delErr) return delErr.message;

    const { error: upsertErr } = await admin.from('doctors').upsert(
      {
        id: input.userId,
        full_name: input.fullName,
        email: input.email,
        mobile: input.mobile ?? null,
      },
      { onConflict: 'id' }
    );
    return upsertErr?.message ?? null;
  }

  // admin — no clinical profile row
  const [{ error: pErr }, { error: dErr }] = await Promise.all([
    admin.from('patients').delete().eq('id', input.userId),
    admin.from('doctors').delete().eq('id', input.userId),
  ]);
  return pErr?.message ?? dErr?.message ?? null;
}

export const invitesRouter = Router();

/**
 * Admin-only: create Auth user + one-time invite/setup link.
 * Staff roles only (doctor / admin). B2B patient invites deferred to billing phase.
 */
invitesRouter.post('/', async (req, res) => {
  const auth = await requireAuth(req as AuthedRequest, ['admin']);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: 'Supabase admin client not configured.' });
    return;
  }

  const redirectTo =
    input.redirectTo ??
    process.env.INVITE_REDIRECT_TO ??
    'http://localhost:3000/auth/callback';

  const userMetadata: Record<string, string> = {
    role: input.role,
    full_name: input.fullName.trim(),
  };
  if (input.mobile) userMetadata.mobile = input.mobile.trim();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    email_confirm: false,
    app_metadata: { role: input.role },
    user_metadata: userMetadata,
  });

  if (createError || !created.user) {
    res.status(400).json({ error: createError?.message ?? 'Failed to create user.' });
    return;
  }

  // createUser applies app_metadata on a follow-up UPDATE; INSERT triggers may
  // briefly create a patients row. Ensure the profile matches the invited role.
  const profileError = await ensureInviteProfile(admin, {
    userId: created.user.id,
    role: input.role,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile?.trim(),
  });
  if (profileError) {
    res.status(500).json({
      error: `User created (${created.user.id}) but profile sync failed: ${profileError}`,
    });
    return;
  }

  let actionLink: string | null = null;
  const { data: inviteLink, error: inviteLinkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: input.email.trim().toLowerCase(),
    options: { redirectTo },
  });

  if (inviteLink?.properties?.action_link) {
    actionLink = inviteLink.properties.action_link;
  } else {
    // User already exists from createUser — recovery link lets them set a password.
    const { data: recoveryLink, error: recoveryError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: input.email.trim().toLowerCase(),
      options: { redirectTo },
    });
    if (recoveryError && inviteLinkError) {
      res.status(500).json({
        error: `User created (${created.user.id}) but setup link failed: ${
          recoveryError.message || inviteLinkError.message
        }`,
      });
      return;
    }
    actionLink = recoveryLink?.properties?.action_link ?? null;
  }

  await admin.from('audit_logs').insert({
    actor_id: (req as AuthedRequest).userId,
    action: 'invite_user',
    entity_type: 'auth.users',
    entity_id: created.user.id,
    metadata: {
      email: input.email.trim().toLowerCase(),
      role: input.role,
    },
  });

  const result: InviteUserResult = {
    userId: created.user.id,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    actionLink,
  };

  res.status(201).json(result);
});
