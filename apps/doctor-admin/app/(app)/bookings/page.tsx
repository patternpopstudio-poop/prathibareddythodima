import type { ConsultationMode } from '@teleconsult/shared-types';
import {
    bookingPaymentStatusLabel,
    consultationModeLabel,
} from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
    DashboardKpiStrip,
    KpiBellIcon,
    KpiCalendarIcon,
    KpiSlotsIcon,
} from '@/components/dashboard-kpi-strip';
import { RefreshButton } from '@/components/refresh-button';
import { requireStaff } from '@/lib/auth';
import {
    fetchDoctorUpcomingBookings,
    formatBookingDatePart,
    formatBookingTimeRange,
    formatBookingWeekday,
    formatPatientShortName,
    type DoctorUpcomingBooking,
} from '@/lib/bookings';
import { fetchConsultationIdsByBookingIds } from '@/lib/consultations';

const MODE_SECTIONS: ConsultationMode[] = ['online', 'offline'];

function ModeIcon({ mode }: { mode: ConsultationMode }) {
  if (mode === 'offline') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="text-muted"
        aria-hidden
      >
        <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="text-muted"
      aria-hidden
    >
      <path d="M15 10l5-3v10l-5-3v-4Z" strokeLinejoin="round" />
      <rect x="3" y="7" width="12" height="10" rx="2" />
    </svg>
  );
}

function BookingList({
  items,
  consultationByBookingId,
}: {
  items: DoctorUpcomingBooking[];
  consultationByBookingId: Map<string, string>;
}) {
  return (
    <ul className="space-y-3">
      {items.map(({ booking, slot, patient }) => {
        const consultationId = consultationByBookingId.get(booking.id);
        const name = formatPatientShortName(patient.fullName);
        const openHref =
          consultationId != null
            ? `/cases/${consultationId}`
            : booking.mode === 'online'
              ? '/cases'
              : null;
        const unpaidClinic =
          booking.paymentMethod === 'clinic' && booking.paymentStatus === 'unpaid';
        const isOnline = booking.mode === 'online';

        return (
          <li
            key={booking.id}
            className={`flex flex-col gap-3 rounded-2xl border py-4 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between ${
              isOnline
                ? 'border-gray-200 bg-white'
                : 'border-primary/20 bg-primary-soft/70'
            }`}
            style={{
              borderLeftWidth: 4,
              borderLeftColor: isOnline ? '#9ca3af' : 'var(--primary)',
            }}
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-muted">
                    {formatBookingDatePart(slot.startsAt)}
                    <span className="mx-2 text-border">·</span>
                    <span className="tracking-wide">{formatBookingWeekday(slot.startsAt)}</span>
                  </p>
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    {name}{' '}
                    <span className="font-medium text-muted">
                      ({formatBookingTimeRange(slot.startsAt, slot.endsAt)})
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      isOnline
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {consultationModeLabel(booking.mode)}
                  </span>
                  {booking.cancelRequestAt ? (
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-danger">
                      Cancel requested
                    </span>
                  ) : (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isOnline
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-white/80 text-primary'
                      }`}
                    >
                      Confirmed
                    </span>
                  )}
                  {unpaidClinic ? (
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-danger">
                      Pay at clinic
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <ModeIcon mode={booking.mode} />
                <span>
                  {consultationModeLabel(booking.mode)} consultation
                  {booking.paymentMethod === 'clinic' || booking.paymentStatus === 'unpaid'
                    ? ` · Payment: ${bookingPaymentStatusLabel(booking)}`
                    : ''}
                </span>
              </div>

              {(patient.mobile || patient.email) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {patient.mobile ? <span>{patient.mobile}</span> : null}
                  {patient.email ? <span className="break-all">{patient.email}</span> : null}
                </div>
              )}

              {booking.cancelRequestAt ? (
                <p className="text-sm font-medium text-danger">
                  Patient requested cancel
                  {booking.cancelRequestNote ? ` — ${booking.cancelRequestNote}` : ''}.
                  Contact hospital workflow applies.
                </p>
              ) : null}
            </div>

            {openHref ? (
              <Link
                href={openHref}
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                Open Consultation
              </Link>
            ) : (
              <span className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary">
                In-clinic visit
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function BookingsPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Bookings
        </h1>
        <p className="max-w-xl text-muted">
          Doctors see their own upcoming appointments here. Admins manage{' '}
          <Link href="/clinic-payments" className="font-semibold text-primary hover:underline">
            clinic payments
          </Link>{' '}
          and create doctor accounts from{' '}
          <Link href="/invites" className="font-semibold text-primary hover:underline">
            Invites
          </Link>
          .
        </p>
      </div>
    );
  }

  const bookings = await fetchDoctorUpcomingBookings(staff.supabase, staff.userId);
  const consultationByBookingId = await fetchConsultationIdsByBookingIds(
    staff.supabase,
    bookings.map((row) => row.booking.id)
  );

  const byMode = Object.fromEntries(
    MODE_SECTIONS.map((mode) => [mode, bookings.filter((b) => b.booking.mode === mode)])
  ) as Record<ConsultationMode, DoctorUpcomingBooking[]>;

  const onlineCount = byMode.online.length;
  const offlineCount = byMode.offline.length;
  const cancelRequestedCount = bookings.filter((b) => b.booking.cancelRequestAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Bookings
          </h1>
          <p className="max-w-2xl text-muted">
            Confirmed appointments as soon as a patient books. Online and offline are listed
            separately.
          </p>
        </div>
        <RefreshButton />
      </div>

      <DashboardKpiStrip
        items={[
          {
            label: 'Online',
            value:
              onlineCount === 0
                ? 'None'
                : `${onlineCount} Upcoming`,
            tone: 'green',
            icon: <KpiCalendarIcon />,
          },
          {
            label: 'Offline',
            value:
              offlineCount === 0
                ? 'None'
                : `${offlineCount} Upcoming`,
            tone: 'blue',
            icon: <KpiSlotsIcon />,
          },
          {
            label: 'Cancel Requests',
            value:
              cancelRequestedCount === 0
                ? 'None'
                : String(cancelRequestedCount),
            tone: 'amber',
            icon: <KpiBellIcon />,
          },
        ]}
      />

      {bookings.length === 0 ? (
        <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="rounded-2xl bg-background px-4 py-6">
            <p className="text-sm font-semibold text-foreground">No upcoming bookings</p>
            <p className="mt-1 text-sm text-muted">
              When a patient books one of your open slots, it will show up here. Make sure you
              have{' '}
              <Link href="/availability" className="font-semibold text-primary hover:underline">
                open availability
              </Link>
              .
            </p>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {MODE_SECTIONS.map((mode) => {
            const items = byMode[mode];
            return (
              <section
                key={mode}
                className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {consultationModeLabel(mode)}
                  </h2>
                  <p className="text-xs font-semibold text-muted">
                    {items.length} upcoming
                    {mode === 'offline' ? ' · in-clinic (no chat)' : ''}
                  </p>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-2xl bg-background px-4 py-6 text-sm text-muted">
                    No upcoming {consultationModeLabel(mode).toLowerCase()} bookings.
                  </div>
                ) : (
                  <BookingList
                    items={items}
                    consultationByBookingId={consultationByBookingId}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
