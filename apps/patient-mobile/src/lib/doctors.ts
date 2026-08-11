import type {
  AppointmentSlot,
  AppointmentSlotRow,
  ConsultationMode,
  Doctor,
  DoctorRow,
} from '@teleconsult/shared-types';
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

/** Future open slots for a doctor (patient-visible via RLS), optionally filtered by mode. */
export async function fetchOpenSlotsForDoctor(
  doctorId: string,
  options?: { mode?: ConsultationMode; limit?: number }
): Promise<AppointmentSlot[]> {
  const limit = options?.limit ?? 500;
  const until = new Date();
  until.setMonth(until.getMonth() + OPEN_SLOTS_HORIZON_MONTHS);

  let query = supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .lte('starts_at', until.toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (options?.mode) query = query.eq('mode', options.mode);

  const { data, error } = await query;

  if (error) throw error;
  return (data as AppointmentSlotRow[] | null)?.map(mapAppointmentSlotRow) ?? [];
}

/**
 * Open slots for many doctors in a short local-day window (list preview).
 * Returns slots grouped by doctor id.
 */
export async function fetchOpenSlotsForDoctors(
  doctorIds: string[],
  options: { mode: ConsultationMode; daysAhead: number }
): Promise<Map<string, AppointmentSlot[]>> {
  const byDoctor = new Map<string, AppointmentSlot[]>();
  for (const id of doctorIds) byDoctor.set(id, []);
  if (doctorIds.length === 0) return byDoctor;

  const now = new Date();
  // Inclusive local window: today through (daysAhead - 1) more days.
  const until = new Date();
  until.setHours(0, 0, 0, 0);
  until.setDate(until.getDate() + options.daysAhead);
  until.setTime(until.getTime() - 1);

  const { data, error } = await supabase
    .from('appointment_slots')
    .select('*')
    .in('doctor_id', doctorIds)
    .eq('mode', options.mode)
    .eq('status', 'open')
    .gt('starts_at', now.toISOString())
    .lte('starts_at', until.toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw error;

  for (const row of (data as AppointmentSlotRow[] | null) ?? []) {
    const slot = mapAppointmentSlotRow(row);
    const list = byDoctor.get(slot.doctorId);
    if (list) list.push(slot);
    else byDoctor.set(slot.doctorId, [slot]);
  }

  return byDoctor;
}
