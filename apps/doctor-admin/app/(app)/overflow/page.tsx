import {
  consultationModeLabel,
  formatInrFromPaise,
} from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { OverflowActions } from '@/components/overflow-actions';
import { RefreshButton } from '@/components/refresh-button';
import { requireStaff } from '@/lib/auth';
import { formatBookingWhen } from '@/lib/bookings';
import {
  defaultAcceptWindow,
  fetchPendingOverflowBookings,
} from '@/lib/overflow';

export default async function OverflowQueuePage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'admin') {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Overflow queue</h1>
        <p className="max-w-xl text-muted">
          Only admins can accept or reject offline overflow requests. Doctors see
          assigned offline visits on{' '}
          <Link href="/bookings" className="font-semibold text-primary hover:underline">
            Bookings
          </Link>
          .
        </p>
      </div>
    );
  }

  const rows = await fetchPendingOverflowBookings(staff.supabase);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Overflow queue</h1>
          <p className="max-w-2xl text-muted">
            Offline requests when the doctor had no open slots. Accept by creating or
            assigning a real offline slot, or reject with a patient-visible reason.
          </p>
        </div>
        <RefreshButton />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground">No pending requests</p>
          <p className="mt-1 text-sm text-muted">
            When patients request an offline visit and capacity is full, requests appear
            here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ booking, patient, doctor, openOfflineSlots, occupancy }) => {
            const window = defaultAcceptWindow(booking);
            return (
              <li
                key={booking.id}
                className="rounded-3xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        {patient.fullName.trim() || 'Patient'}
                      </p>
                      <p className="text-sm text-muted">
                        {doctor.fullName.trim() || 'Doctor'} · Offline ·{' '}
                        {booking.paymentMethod === 'online'
                          ? 'Pay online after assign'
                          : 'Pay at clinic'}
                        {booking.amountPaise != null
                          ? ` · ${formatInrFromPaise(booking.amountPaise)}`
                          : null}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {patient.mobile ? <span>{patient.mobile}</span> : null}
                        {patient.email ? (
                          <span className="break-all">{patient.email}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-background px-4 py-3 text-sm">
                      <p className="font-medium text-foreground">Preferred window</p>
                      <p className="mt-1 text-muted">
                        {booking.preferredStartsAt && booking.preferredEndsAt
                          ? formatBookingWhen(
                              booking.preferredStartsAt,
                              booking.preferredEndsAt
                            )
                          : 'Not specified'}
                      </p>
                      {booking.preferredNote ? (
                        <p className="mt-2 text-muted">Note: {booking.preferredNote}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Upcoming occupancy ({occupancy.length})
                      </p>
                      {occupancy.length === 0 ? (
                        <p className="text-sm text-muted">No upcoming slots on the calendar.</p>
                      ) : (
                        <ul className="space-y-1 text-sm text-muted">
                          {occupancy.map((slot) => (
                            <li key={slot.id}>
                              {consultationModeLabel(slot.mode)} · {slot.status} ·{' '}
                              {formatBookingWhen(slot.startsAt, slot.endsAt)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <OverflowActions
                    bookingId={booking.id}
                    defaultStartsLocal={window.startsLocal}
                    defaultEndsLocal={window.endsLocal}
                    openOfflineSlots={openOfflineSlots}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
