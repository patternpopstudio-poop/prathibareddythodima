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

export type ClinicUnpaidBooking = {
  booking: Booking;
  slot: AppointmentSlot | null;
  patient: Patient;
  doctor: Doctor;
};

type BookingJoinRow = BookingRow & {
  appointment_slots: AppointmentSlotRow | AppointmentSlotRow[] | null;
  patients: PatientRow | PatientRow[] | null;
  doctors: DoctorRow | DoctorRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Confirmed offline bookings awaiting clinic payment (admin queue). */
export async function fetchClinicUnpaidBookings(
  supabase: Supabase,
  limit = 100
): Promise<ClinicUnpaidBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      appointment_slots (*),
      patients (*),
      doctors (*)
    `
    )
    .eq('status', 'confirmed')
    .eq('payment_method', 'clinic')
    .eq('payment_status', 'unpaid')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const mapped: ClinicUnpaidBooking[] = [];
  for (const row of (data as BookingJoinRow[] | null) ?? []) {
    const patientRow = firstRelation(row.patients);
    const doctorRow = firstRelation(row.doctors);
    if (!patientRow || !doctorRow) continue;
    const slotRow = firstRelation(row.appointment_slots);

    mapped.push({
      booking: mapBookingRow(row),
      slot: slotRow ? mapAppointmentSlotRow(slotRow) : null,
      patient: mapPatientRow(patientRow),
      doctor: mapDoctorRow(doctorRow),
    });
  }

  mapped.sort((a, b) => {
    const aStart = a.slot?.startsAt ?? a.booking.createdAt;
    const bStart = b.slot?.startsAt ?? b.booking.createdAt;
    return new Date(aStart).getTime() - new Date(bStart).getTime();
  });

  return mapped;
}
