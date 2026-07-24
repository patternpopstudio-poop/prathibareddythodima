import type {
  AppointmentSlot,
  AppointmentSlotRow,
  Booking,
  BookingRow,
  CancelBookingResult,
  Doctor,
  DoctorRow,
} from '@teleconsult/shared-types';
import {
  mapAppointmentSlotRow,
  mapBookingRow,
  mapCancelBookingResult,
  mapDoctorRow,
} from '@teleconsult/shared-types';

import { supabase } from '@/lib/supabase';

export type UpcomingBooking = {
  booking: Booking;
  slot: AppointmentSlot;
  doctor: Doctor;
};

type BookingJoinRow = BookingRow & {
  appointment_slots: AppointmentSlotRow | AppointmentSlotRow[] | null;
  doctors: DoctorRow | DoctorRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Atomically claim an open slot for the signed-in patient. */
export async function bookAppointmentSlot(slotId: string): Promise<Booking> {
  const { data, error } = await supabase.rpc('book_appointment_slot', {
    p_slot_id: slotId,
  });

  if (error) throw error;
  if (!data) throw new Error('Booking failed.');
  return mapBookingRow(data as BookingRow);
}

/** Confirmed future bookings for the current patient (soonest first). */
export async function fetchUpcomingBookings(limit = 20): Promise<UpcomingBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      appointment_slots (*),
      doctors (*)
    `
    )
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw error;

  const now = Date.now();
  const mapped: UpcomingBooking[] = [];

  for (const row of (data as BookingJoinRow[] | null) ?? []) {
    const slotRow = firstRelation(row.appointment_slots);
    const doctorRow = firstRelation(row.doctors);
    if (!slotRow || !doctorRow) continue;

    const slot = mapAppointmentSlotRow(slotRow);
    if (new Date(slot.startsAt).getTime() <= now) continue;

    mapped.push({
      booking: mapBookingRow(row),
      slot,
      doctor: mapDoctorRow(doctorRow),
    });
  }

  mapped.sort(
    (a, b) => new Date(a.slot.startsAt).getTime() - new Date(b.slot.startsAt).getTime()
  );

  return mapped.slice(0, limit);
}

export async function fetchNextUpcomingBooking(): Promise<UpcomingBooking | null> {
  const rows = await fetchUpcomingBookings(1);
  return rows[0] ?? null;
}

/** Load one of the patient's bookings (confirmed or recently cancelled) with slot + doctor. */
export async function fetchBookingById(bookingId: string): Promise<UpcomingBooking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      appointment_slots (*),
      doctors (*)
    `
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as BookingJoinRow;
  const slotRow = firstRelation(row.appointment_slots);
  const doctorRow = firstRelation(row.doctors);
  if (!slotRow || !doctorRow) return null;

  return {
    booking: mapBookingRow(row),
    slot: mapAppointmentSlotRow(slotRow),
    doctor: mapDoctorRow(doctorRow),
  };
}

/**
 * Cancel (before cutoff) or flag for hospital (after cutoff).
 * Enforced in Postgres — clients cannot bypass via direct UPDATE.
 */
export async function cancelAppointmentBooking(
  bookingId: string,
  reason?: string
): Promise<CancelBookingResult> {
  const { data, error } = await supabase.rpc('cancel_appointment_booking', {
    p_booking_id: bookingId,
    p_reason: reason ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('Cancel failed.');
  return mapCancelBookingResult(data as Parameters<typeof mapCancelBookingResult>[0]);
}
