import type {
  AppointmentSlot,
  AppointmentSlotRow,
  Booking,
  BookingPaymentMethod,
  BookingRow,
  CancelBookingResult,
  ConsultationMode,
  Doctor,
  DoctorRow,
} from '@teleconsult/shared-types';
import {
  mapAppointmentSlotRow,
  mapBookingRow,
  mapCancelBookingResult,
  mapDoctorRow,
} from '@teleconsult/shared-types';

import { getBackendUrl } from '@/lib/backend';
import { supabase } from '@/lib/supabase';

export type UpcomingBooking = {
  booking: Booking;
  slot: AppointmentSlot | null;
  doctor: Doctor;
};

type BookingJoinRow = BookingRow & {
  appointment_slots: AppointmentSlotRow | AppointmentSlotRow[] | null;
  doctors: DoctorRow | DoctorRow[] | null;
};

const backendUrl = getBackendUrl();

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function sortKeyForBooking(item: UpcomingBooking): number {
  if (item.slot) return new Date(item.slot.startsAt).getTime();
  if (item.booking.preferredStartsAt) {
    return new Date(item.booking.preferredStartsAt).getTime();
  }
  return new Date(item.booking.createdAt).getTime();
}

/** Atomically claim an open slot for the signed-in patient. */
export async function bookAppointmentSlot(
  slotId: string,
  options?: {
    mode?: ConsultationMode;
    paymentMethod?: BookingPaymentMethod;
  }
): Promise<Booking> {
  const { data, error } = await supabase.rpc('book_appointment_slot', {
    p_slot_id: slotId,
    p_mode: options?.mode ?? null,
    p_payment_method: options?.paymentMethod ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('Booking failed.');
  return mapBookingRow(data as BookingRow);
}

/**
 * Request an offline visit when the doctor has no open offline slots.
 * Creates a `pending_admin` booking for hospital review.
 */
export async function requestOfflineOverflowBooking(input: {
  doctorId: string;
  preferredStartsAt: string;
  preferredEndsAt: string;
  preferredNote?: string | null;
  paymentMethod?: BookingPaymentMethod;
}): Promise<Booking> {
  const { data, error } = await supabase.rpc('request_offline_overflow_booking', {
    p_doctor_id: input.doctorId,
    p_preferred_starts_at: input.preferredStartsAt,
    p_preferred_ends_at: input.preferredEndsAt,
    p_preferred_note: input.preferredNote ?? null,
    p_payment_method: input.paymentMethod ?? 'clinic',
  });

  if (error) throw error;
  if (!data) throw new Error('Could not submit request.');
  return mapBookingRow(data as BookingRow);
}

/** Active future bookings (confirmed, unpaid hold, or awaiting admin). */
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
    .in('status', ['confirmed', 'pending_payment', 'pending_admin'])
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw error;

  const now = Date.now();
  const mapped: UpcomingBooking[] = [];

  for (const row of (data as BookingJoinRow[] | null) ?? []) {
    const slotRow = firstRelation(row.appointment_slots);
    const doctorRow = firstRelation(row.doctors);
    if (!doctorRow) continue;

    const booking = mapBookingRow(row);
    const slot = slotRow ? mapAppointmentSlotRow(slotRow) : null;

    if (booking.status === 'pending_admin') {
      mapped.push({
        booking,
        slot: null,
        doctor: mapDoctorRow(doctorRow),
      });
      continue;
    }

    if (!slot) continue;
    if (new Date(slot.startsAt).getTime() <= now) continue;

    mapped.push({
      booking,
      slot,
      doctor: mapDoctorRow(doctorRow),
    });
  }

  mapped.sort((a, b) => sortKeyForBooking(a) - sortKeyForBooking(b));

  return mapped.slice(0, limit);
}

export async function fetchNextUpcomingBooking(): Promise<UpcomingBooking | null> {
  const rows = await fetchUpcomingBookings(1);
  return rows[0] ?? null;
}

/** Load one of the patient's bookings with optional slot + doctor. */
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
  if (!doctorRow) return null;

  return {
    booking: mapBookingRow(row),
    slot: slotRow ? mapAppointmentSlotRow(slotRow) : null,
    doctor: mapDoctorRow(doctorRow),
  };
}

/**
 * Cancel (before cutoff) or flag for hospital (after cutoff).
 * Paid free-cancels go through the backend so Razorpay refunds can run.
 */
export async function cancelAppointmentBooking(
  bookingId: string,
  reason?: string
): Promise<CancelBookingResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const res = await fetch(`${backendUrl}/payments/cancel-booking`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bookingId, reason: reason ?? null }),
  });

  if (!res.ok) {
    let message = `Cancel failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const payload = (await res.json()) as {
    outcome: string;
    cutoffHours: number;
    message: string;
    booking: BookingRow;
    refunded?: boolean;
  };

  return mapCancelBookingResult(payload);
}
