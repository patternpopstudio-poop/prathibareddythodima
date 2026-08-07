import type { AppointmentSlot, AppointmentSlotRow, Doctor, DoctorRow } from '@teleconsult/shared-types';
import { mapAppointmentSlotRow, mapDoctorRow } from '@teleconsult/shared-types';

import { supabase } from '@/lib/supabase';

/** Active doctors patients may browse for booking. */
export async function fetchActiveDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data as DoctorRow[] | null)?.map(mapDoctorRow) ?? [];
}

export async function fetchDoctorById(doctorId: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', doctorId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDoctorRow(data as DoctorRow);
}

/** How far ahead patients can load open slots (matches slot-picker browse window). */
const OPEN_SLOTS_HORIZON_MONTHS = 6;

/** Future open slots for a doctor (patient-visible via RLS). */
export async function fetchOpenSlotsForDoctor(
  doctorId: string,
  limit = 500
): Promise<AppointmentSlot[]> {
  const until = new Date();
  until.setMonth(until.getMonth() + OPEN_SLOTS_HORIZON_MONTHS);

  const { data, error } = await supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .lte('starts_at', until.toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as AppointmentSlotRow[] | null)?.map(mapAppointmentSlotRow) ?? [];
}
