import type { Doctor, DoctorProfileInput, DoctorRow } from '@teleconsult/shared-types';
import { mapDoctorRow } from '@teleconsult/shared-types';

import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const DOCTOR_PHOTOS_BUCKET = 'doctor-photos';

export async function fetchDoctorProfile(
  supabase: Supabase,
  doctorId: string
): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', doctorId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDoctorRow(data as DoctorRow);
}

export async function updateDoctorProfile(
  supabase: Supabase,
  doctorId: string,
  input: DoctorProfileInput
): Promise<Doctor> {
  const payload: Record<string, string | null> = {
    full_name: input.fullName.trim(),
    mobile: input.mobile?.trim() ? input.mobile.trim() : null,
  };

  if (input.photoUrl !== undefined) {
    payload.photo_url = input.photoUrl?.trim() ? input.photoUrl.trim() : null;
  }

  const { data, error } = await supabase
    .from('doctors')
    .update(payload)
    .eq('id', doctorId)
    .select('*')
    .single();

  if (error) throw error;
  return mapDoctorRow(data as DoctorRow);
}

export function doctorPhotoObjectPath(doctorId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'jpg';
  const safeExt = ext === 'png' || ext === 'webp' || ext === 'jpeg' || ext === 'jpg' ? ext : 'jpg';
  const normalized = safeExt === 'jpeg' ? 'jpg' : safeExt;
  return `${doctorId}/avatar.${normalized}`;
}
