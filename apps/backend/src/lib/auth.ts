import { getRoleFromAppMetadata, type UserRole } from '@teleconsult/shared-types';
import type { Request } from 'express';

import { getSupabaseAdmin } from './supabase.js';

export type AuthedRequest = Request & {
  userId?: string;
  role?: UserRole;
};

/** Validate Bearer JWT and attach userId + role (from app_metadata). */
export async function requireAuth(
  req: AuthedRequest,
  roles?: UserRole[]
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token.' };
  }

  const token = header.slice('Bearer '.length).trim();
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, status: 503, message: 'Supabase admin client not configured.' };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, message: 'Invalid or expired session.' };
  }

  const role = getRoleFromAppMetadata(data.user.app_metadata as Record<string, unknown>);
  if (!role) {
    return { ok: false, status: 403, message: 'User has no assigned role.' };
  }

  if (roles && !roles.includes(role)) {
    return { ok: false, status: 403, message: 'Insufficient role for this action.' };
  }

  req.userId = data.user.id;
  req.role = role;
  return { ok: true };
}
