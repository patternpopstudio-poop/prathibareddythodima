import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RefreshButton } from '@/components/refresh-button';
import { requireStaff } from '@/lib/auth';
import { fetchDoctorUpcomingBookings, formatBookingWhen } from '@/lib/bookings';

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

function formatBookedAt(iso: string): string {
  const d = new Date(iso);
  const hours24 = d.getHours();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${hours12}:${mins} ${period}`;
}

export default async function BookingsPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
        <p className="max-w-xl text-muted">
          Doctors see their own upcoming appointments here. Admins can create doctor accounts from{' '}
          <Link href="/invites" className="font-semibold text-primary hover:underline">
            Invites
          </Link>
          .
        </p>
      </div>
    );
  }

  const bookings = await fetchDoctorUpcomingBookings(staff.supabase, staff.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
          <p className="max-w-2xl text-muted">
            Confirmed appointments appear here as soon as a patient books. Late cancel requests
            (within 2 hours of start) stay confirmed until the hospital handles them.
          </p>
        </div>
        <RefreshButton />
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground">No upcoming bookings</p>
          <p className="mt-1 text-sm text-muted">
            When a patient books one of your open slots, it will show up here. Make sure you have{' '}
            <Link href="/availability" className="font-semibold text-primary hover:underline">
              open availability
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          {bookings.map(({ booking, slot, patient }) => (
            <li
              key={booking.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {patient.fullName.trim() || 'Patient'}
                </p>
                <p className="text-sm text-muted">{formatBookingWhen(slot.startsAt, slot.endsAt)}</p>
                <p className="text-xs text-muted">
                  Confirmed · booked {formatBookedAt(booking.createdAt)}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {patient.mobile ? <span>{patient.mobile}</span> : null}
                  {patient.email ? <span className="break-all">{patient.email}</span> : null}
                </div>
                {booking.cancelRequestAt ? (
                  <p className="text-sm font-medium text-danger">
                    Patient requested cancel
                    {booking.cancelRequestNote ? ` — ${booking.cancelRequestNote}` : ''}. Contact
                    hospital workflow applies.
                  </p>
                ) : null}
              </div>
              {booking.cancelRequestAt ? (
                <span className="inline-flex w-fit items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-danger">
                  Cancel requested
                </span>
              ) : (
                <span className="inline-flex w-fit items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  Confirmed
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
