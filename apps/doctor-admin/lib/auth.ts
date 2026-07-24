import { getRoleFromAppMetadata, isStaffRole, type UserRole } from '@teleconsult/shared-types';

import { createClient } from '@/lib/supabase/server';

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = getRoleFromAppMetadata(user.app_metadata as Record<string, unknown>);
  return { user, role, supabase };
}

export async function requireStaff(): Promise<
  | { ok: true; userId: string; role: UserRole; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false }
> {
  const session = await getSessionUser();
  if (!session?.role || !isStaffRole(session.role)) {
    return { ok: false };
  }
  return {
    ok: true,
    userId: session.user.id,
    role: session.role,
    supabase: session.supabase,
  };
}
