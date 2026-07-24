import type {
  AppointmentSlot,
  AppointmentSlotRow,
  DoctorAvailability,
  DoctorAvailabilityRow,
} from '@teleconsult/shared-types';
import { mapAppointmentSlotRow, mapDoctorAvailabilityRow } from '@teleconsult/shared-types';

import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function fetchDoctorAvailability(
  supabase: Supabase,
  doctorId: string
): Promise<DoctorAvailability[]> {
  const { data, error } = await supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data as DoctorAvailabilityRow[] | null)?.map(mapDoctorAvailabilityRow) ?? [];
}

export async function fetchUpcomingOpenSlots(
  supabase: Supabase,
  doctorId: string,
  limit = 100
): Promise<AppointmentSlot[]> {
  const { data, error } = await supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as AppointmentSlotRow[] | null)?.map(mapAppointmentSlotRow) ?? [];
}
