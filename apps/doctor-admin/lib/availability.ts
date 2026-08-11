import type {
  AppointmentSlot,
  AppointmentSlotRow,
  ConsultationMode,
  DoctorAvailability,
  DoctorAvailabilityRow,
} from '@teleconsult/shared-types';
import { mapAppointmentSlotRow, mapDoctorAvailabilityRow } from '@teleconsult/shared-types';

import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function fetchDoctorAvailability(
  supabase: Supabase,
  doctorId: string,
  mode?: ConsultationMode
): Promise<DoctorAvailability[]> {
  let query = supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (mode) query = query.eq('mode', mode);

  const { data, error } = await query;

  if (error) throw error;
  return (data as DoctorAvailabilityRow[] | null)?.map(mapDoctorAvailabilityRow) ?? [];
}

export async function fetchUpcomingOpenSlots(
  supabase: Supabase,
  doctorId: string,
  options?: { mode?: ConsultationMode; limit?: number; until?: Date }
): Promise<AppointmentSlot[]> {
  const limit = options?.limit ?? 500;
  let query = supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (options?.mode) query = query.eq('mode', options.mode);
  if (options?.until) query = query.lte('starts_at', options.until.toISOString());

  const { data, error } = await query;

  if (error) throw error;
  return (data as AppointmentSlotRow[] | null)?.map(mapAppointmentSlotRow) ?? [];
}
