import { getRoleFromAppMetadata, type UserRole } from '@teleconsult/shared-types';
import type { User } from '@supabase/supabase-js';

/** Authoritative role from app_metadata (never user_metadata). */
export function getUserRole(user: User | null | undefined): UserRole | null {
  return getRoleFromAppMetadata(user?.app_metadata as Record<string, unknown> | undefined);
}

export function assertPatientRole(user: User | null | undefined): void {
  const role = getUserRole(user);
  if (role && role !== 'patient') {
    throw new Error('This account is not a patient login. Use the doctor/admin app instead.');
  }
}
