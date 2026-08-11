import type {
  AppNotification,
  AppointmentSlot,
  DoctorAvailability,
} from '@teleconsult/shared-types';
import { consultationModeLabel } from '@teleconsult/shared-types';
import Link from 'next/link';

import {
  DoctorCasesPreview,
  type CasePreviewItem,
} from '@/components/doctor-cases-preview';
import {
  DashboardKpiStrip,
  KpiBellIcon,
  KpiCalendarIcon,
  KpiSlotsIcon,
} from '@/components/dashboard-kpi-strip';
import { DashboardNotifications } from '@/components/dashboard-notifications';
import { ScheduleGlanceCard } from '@/components/schedule-glance-card';
import {
  formatPatientShortName,
  formatTime12h,
  type DoctorUpcomingBooking,
} from '@/lib/bookings';

type Props = {
  displayName: string;
  todayBookings: DoctorUpcomingBooking[];
  consultationByBookingId: Map<string, string>;
  todayOpenSlotsCount: number;
  unrepliedCount: number;
  responseAwaitedCount: number;
  unrepliedCases: CasePreviewItem[];
  responseAwaitedCases: CasePreviewItem[];
  latestCases: CasePreviewItem[];
  availability: DoctorAvailability[];
  openSlots: AppointmentSlot[];
  recentNotifications: AppNotification[];
  unreadCount: number;
  showPhotoNudge: boolean;
};

function ModeIcon({ mode }: { mode: 'online' | 'offline' }) {
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

export function DoctorDashboardView({
  displayName,
  todayBookings,
  consultationByBookingId,
  todayOpenSlotsCount,
  unrepliedCount,
  responseAwaitedCount,
  unrepliedCases,
  responseAwaitedCases,
  latestCases,
  availability,
  openSlots,
  recentNotifications,
  unreadCount,
  showPhotoNudge,
}: Props) {
  const pendingResponses = unrepliedCount + responseAwaitedCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Welcome, {displayName}
          </h1>
          <p className="text-muted">Let’s review your upcoming day.</p>
        </div>
        <Link
          href="/notifications"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition hover:border-primary/40"
        >
          Notifications
          {unreadCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>

      <DashboardKpiStrip
        items={[
          {
            label: "Today's Bookings",
            value:
              todayBookings.length === 0
                ? 'None'
                : `${todayBookings.length} Confirmed`,
            tone: 'green',
            icon: <KpiCalendarIcon />,
          },
          {
            label: 'Pending Responses',
            value: String(pendingResponses),
            tone: 'amber',
            icon: <KpiBellIcon />,
          },
          {
            label: 'Availability Today',
            value:
              todayOpenSlotsCount === 0
                ? 'No open slots'
                : `${todayOpenSlotsCount} Slot${todayOpenSlotsCount === 1 ? '' : 's'} Open`,
            tone: 'blue',
            icon: <KpiSlotsIcon />,
          },
        ]}
      />

      <DashboardNotifications items={recentNotifications} unreadCount={unreadCount} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Today&apos;s Agenda
            </h2>
            <Link
              href="/bookings"
              className="text-xs font-semibold text-primary hover:underline"
            >
              All bookings
            </Link>
          </div>

          {todayBookings.length === 0 ? (
            <div className="rounded-2xl bg-background px-4 py-6 text-sm text-muted">
              No confirmed appointments left today. Check upcoming bookings or update
              availability.
            </div>
          ) : (
            <ul className="space-y-3">
              {todayBookings.map(({ booking, slot, patient }) => {
                const consultationId = consultationByBookingId.get(booking.id);
                const timeLabel = formatTime12h(new Date(slot.startsAt));
                const name = formatPatientShortName(patient.fullName);
                const openHref =
                  consultationId != null
                    ? `/cases/${consultationId}`
                    : booking.mode === 'online'
                      ? '/cases'
                      : '/bookings';

                return (
                  <li
                    key={booking.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background py-4 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderLeftWidth: 4, borderLeftColor: 'var(--primary)' }}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {timeLabel}{' '}
                          <span className="text-muted">|</span> {name}
                        </p>
                        <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                          Confirmed
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        <ModeIcon mode={booking.mode} />
                        <span>
                          {consultationModeLabel(booking.mode)} consultation
                          {booking.cancelRequestAt ? ' · Cancel requested' : ''}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={openHref}
                      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
                    >
                      {booking.mode === 'online' ? 'Open Consultation' : 'View Visit'}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <DoctorCasesPreview
            unrepliedCount={unrepliedCount}
            responseAwaitedCount={responseAwaitedCount}
            unreplied={unrepliedCases}
            responseAwaited={responseAwaitedCases}
            latest={latestCases}
          />
          <ScheduleGlanceCard availability={availability} openSlots={openSlots} />
        </div>
      </div>

      {showPhotoNudge ? (
        <div className="flex flex-col gap-3 rounded-[24px] border border-primary/20 bg-primary-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Add your profile photo</p>
            <p className="text-sm text-muted">
              A photo is required to complete your doctor profile (soft gate — you can still use
              the app).
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Go to profile
          </Link>
        </div>
      ) : null}
    </div>
  );
}
