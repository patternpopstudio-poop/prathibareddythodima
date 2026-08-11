import { getRoleFromAppMetadata, isStaffRole, type UserRole } from '@teleconsult/shared-types';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

/** Request-scoped: layout + page share one auth round-trip per navigation. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = getRoleFromAppMetadata(user.app_metadata as Record<string, unknown>);
  return { user, role, supabase };
});

export const requireStaff = cache(async (): Promise<
  | {
      ok: true;
      userId: string;
      role: Extract<UserRole, 'doctor' | 'admin'>;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
  | { ok: false }
> => {
  const session = await getSessionUser();
  if (!session?.role || !isStaffRole(session.role)) {
    return { ok: false };
  }
  const role = session.role;
  if (role !== 'doctor' && role !== 'admin') {
    return { ok: false };
  }
  return {
    ok: true,
    userId: session.user.id,
    role,
    supabase: session.supabase,
  };
});
