import type {
  AppointmentSlot,
  AppointmentSlotRow,
  Booking,
  BookingRow,
  Patient,
  PatientRow,
} from '@teleconsult/shared-types';
import { mapAppointmentSlotRow, mapBookingRow, mapPatientRow } from '@teleconsult/shared-types';

import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type DoctorUpcomingBooking = {
  booking: Booking;
  slot: AppointmentSlot;
  patient: Patient;
};

type BookingJoinRow = BookingRow & {
  appointment_slots: AppointmentSlotRow | AppointmentSlotRow[] | null;
  patients: PatientRow | PatientRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Confirmed future bookings for a doctor (soonest first). */
export async function fetchDoctorUpcomingBookings(
  supabase: Supabase,
  doctorId: string,
  limit = 50
): Promise<DoctorUpcomingBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      appointment_slots (*),
      patients (*)
    `
    )
    .eq('doctor_id', doctorId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) throw error;

  const now = Date.now();
  const mapped: DoctorUpcomingBooking[] = [];

  for (const row of (data as BookingJoinRow[] | null) ?? []) {
    const slotRow = firstRelation(row.appointment_slots);
    const patientRow = firstRelation(row.patients);
    if (!slotRow || !patientRow) continue;

    const slot = mapAppointmentSlotRow(slotRow);
    if (new Date(slot.startsAt).getTime() <= now) continue;

    mapped.push({
      booking: mapBookingRow(row),
      slot,
      patient: mapPatientRow(patientRow),
    });
  }

  mapped.sort(
    (a, b) => new Date(a.slot.startsAt).getTime() - new Date(b.slot.startsAt).getTime()
  );

  return mapped.slice(0, limit);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatTime12h(date: Date): string {
  const hours24 = date.getHours();
  const mins = date.getMinutes();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
}

export function formatBookingWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const datePart = `${WEEKDAYS[start.getDay()]} ${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  return `${datePart} · ${formatTime12h(start)} – ${formatTime12h(end)}`;
}
