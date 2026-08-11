import { formatInrFromPaise } from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MarkClinicPaidButton } from '@/components/mark-clinic-paid-button';
import { RefreshButton } from '@/components/refresh-button';
import { requireStaff } from '@/lib/auth';
import { formatBookingWhen } from '@/lib/bookings';
import { fetchClinicUnpaidBookings } from '@/lib/clinic-payments';

export default async function ClinicPaymentsPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'admin') {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Clinic payments</h1>
        <p className="max-w-xl text-muted">
          Only admins can mark pay-at-clinic bookings as paid. Doctors can see payment status on
          their{' '}
          <Link href="/bookings" className="font-semibold text-primary hover:underline">
            Bookings
          </Link>{' '}
          list.
        </p>
      </div>
    );
  }

  const rows = await fetchClinicUnpaidBookings(staff.supabase);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Clinic payments</h1>
          <p className="max-w-2xl text-muted">
            Offline bookings where the patient chose pay at clinic. Mark paid when the hospital
            receives payment — doctors cannot do this.
          </p>
        </div>
        <RefreshButton />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground">No unpaid clinic bookings</p>
          <p className="mt-1 text-sm text-muted">
            When a patient books offline and chooses pay at clinic, the booking appears here until
            you mark it paid.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          {rows.map(({ booking, slot, patient, doctor }) => (
            <li
              key={booking.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {patient.fullName.trim() || 'Patient'}
                </p>
                <p className="text-sm text-muted">
                  {doctor.fullName.trim() || 'Doctor'}
                  {slot
                    ? ` · ${formatBookingWhen(slot.startsAt, slot.endsAt)}`
                    : ' · time TBD'}
                </p>
                <p className="text-sm text-muted">
                  {booking.amountPaise != null
                    ? formatInrFromPaise(booking.amountPaise)
                    : 'Fee unknown'}{' '}
                  · Offline · Pay at clinic
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {patient.mobile ? <span>{patient.mobile}</span> : null}
                  {patient.email ? <span className="break-all">{patient.email}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex w-fit items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-danger">
                  Unpaid
                </span>
                <MarkClinicPaidButton bookingId={booking.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
