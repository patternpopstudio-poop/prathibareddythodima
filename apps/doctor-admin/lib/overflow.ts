import type {
  AppointmentSlot,
  AppointmentSlotRow,
  Booking,
  BookingRow,
  Doctor,
  DoctorRow,
  Patient,
  PatientRow,
} from '@teleconsult/shared-types';
import {
  mapAppointmentSlotRow,
  mapBookingRow,
  mapDoctorRow,
  mapPatientRow,
} from '@teleconsult/shared-types';

import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type OverflowPendingBooking = {
  booking: Booking;
  patient: Patient;
  doctor: Doctor;
  openOfflineSlots: AppointmentSlot[];
  occupancy: AppointmentSlot[];
};

type BookingJoinRow = BookingRow & {
  patients: PatientRow | PatientRow[] | null;
  doctors: DoctorRow | DoctorRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toLocalInputValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultAcceptWindow(booking: Booking): {
  startsLocal: string;
  endsLocal: string;
} {
  const preferred = booking.preferredStartsAt
    ? new Date(booking.preferredStartsAt)
    : new Date(Date.now() + 60 * 60 * 1000);
  const starts = Number.isNaN(preferred.getTime())
    ? new Date(Date.now() + 60 * 60 * 1000)
    : preferred;
  const ends = new Date(starts.getTime() + 15 * 60 * 1000);
  return {
    startsLocal: toLocalInputValue(starts),
    endsLocal: toLocalInputValue(ends),
  };
}

/** Pending offline overflow requests for admin review (oldest first). */
export async function fetchPendingOverflowBookings(
  supabase: Supabase,
  limit = 100
): Promise<OverflowPendingBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      patients (*),
      doctors (*)
    `
    )
    .eq('status', 'pending_admin')
    .eq('mode', 'offline')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const rows = (data as BookingJoinRow[] | null) ?? [];
  const doctorIds = [...new Set(rows.map((r) => r.doctor_id))];

  const slotsByDoctor = new Map<string, AppointmentSlot[]>();
  if (doctorIds.length > 0) {
    const { data: slotData, error: slotError } = await supabase
      .from('appointment_slots')
      .select('*')
      .in('doctor_id', doctorIds)
      .neq('status', 'cancelled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(400);

    if (slotError) throw slotError;

    for (const slotRow of (slotData as AppointmentSlotRow[] | null) ?? []) {
      const slot = mapAppointmentSlotRow(slotRow);
      const list = slotsByDoctor.get(slot.doctorId) ?? [];
      list.push(slot);
      slotsByDoctor.set(slot.doctorId, list);
    }
  }

  const mapped: OverflowPendingBooking[] = [];
  for (const row of rows) {
    const patientRow = firstRelation(row.patients);
    const doctorRow = firstRelation(row.doctors);
    if (!patientRow || !doctorRow) continue;

    const booking = mapBookingRow(row);
    const occupancy = slotsByDoctor.get(booking.doctorId) ?? [];
    const openOfflineSlots = occupancy.filter(
      (s) => s.mode === 'offline' && s.status === 'open'
    );

    mapped.push({
      booking,
      patient: mapPatientRow(patientRow),
      doctor: mapDoctorRow(doctorRow),
      openOfflineSlots,
      occupancy: occupancy.slice(0, 12),
    });
  }

  return mapped;
}
