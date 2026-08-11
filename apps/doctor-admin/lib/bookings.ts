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

export function formatTime12h(date: Date): string {
  const hours24 = date.getHours();
  const mins = date.getMinutes();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
}

/** Short patient label for agenda rows, e.g. "Rahul S." */
export function formatPatientShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Patient';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

export function isLocalToday(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function formatBookingWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const datePart = `${WEEKDAYS[start.getDay()]} ${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  return `${datePart} · ${formatTime12h(start)} – ${formatTime12h(end)}`;
}

function dayOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Date part for booking cards, e.g. "11th Aug". */
export function formatBookingDatePart(startsAt: string): string {
  const start = new Date(startsAt);
  return `${dayOrdinal(start.getDate())} ${MONTHS[start.getMonth()]}`;
}

/** Weekday part for booking cards, e.g. "Tue". */
export function formatBookingWeekday(startsAt: string): string {
  return WEEKDAYS[new Date(startsAt).getDay()];
}

/** Compact date for booking cards, e.g. "11th Aug  Tue". */
export function formatBookingDateLine(startsAt: string): string {
  return `${formatBookingDatePart(startsAt)}  ${formatBookingWeekday(startsAt)}`;
}

/** Time range only, e.g. "10:00 AM – 10:15 AM". */
export function formatBookingTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime12h(new Date(startsAt))} – ${formatTime12h(new Date(endsAt))}`;
}
