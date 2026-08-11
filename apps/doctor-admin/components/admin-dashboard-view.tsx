import type { AppNotification } from '@teleconsult/shared-types';
import Link from 'next/link';

import {
  DashboardKpiStrip,
  KpiBellIcon,
  KpiPaymentIcon,
  KpiQueueIcon,
} from '@/components/dashboard-kpi-strip';
import type { ClinicUnpaidBooking } from '@/lib/clinic-payments';
import { notificationDestination } from '@/lib/notifications';
import type { OverflowPendingBooking } from '@/lib/overflow';

type Props = {
  displayName: string;
  pendingOverflow: OverflowPendingBooking[];
  unpaidClinic: ClinicUnpaidBooking[];
  recentNotifications: AppNotification[];
  unreadCount: number;
};

export function AdminDashboardView({
  displayName,
  pendingOverflow,
  unpaidClinic,
  recentNotifications,
  unreadCount,
}: Props) {
  const overflowCount = pendingOverflow.length;
  const unpaidCount = unpaidClinic.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Welcome, {displayName}
        </h1>
        <p className="text-muted">
          Review overflow requests, clinic payments, and staff invites.
        </p>
      </div>

      <DashboardKpiStrip
        items={[
          {
            label: 'Overflow Queue',
            value:
              overflowCount === 0
                ? 'Clear'
                : `${overflowCount} Pending`,
            tone: 'amber',
            icon: <KpiQueueIcon />,
          },
          {
            label: 'Clinic Payments',
            value:
              unpaidCount === 0
                ? 'All settled'
                : `${unpaidCount} Unpaid`,
            tone: 'blue',
            icon: <KpiPaymentIcon />,
          },
          {
            label: 'Notifications',
            value:
              unreadCount === 0
                ? 'Up to date'
                : `${unreadCount} Unread`,
            tone: 'green',
            icon: <KpiBellIcon />,
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Needs Attention
            </h2>
            <Link
              href="/notifications"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Notifications
            </Link>
          </div>

          {overflowCount === 0 && unpaidCount === 0 && recentNotifications.length === 0 ? (
            <div className="rounded-2xl bg-background px-4 py-6 text-sm text-muted">
              Nothing waiting right now. Overflow and unpaid clinic visits will show up here.
            </div>
          ) : (
            <ul className="space-y-3">
              {pendingOverflow.slice(0, 4).map(({ booking, patient, doctor }) => (
                <li
                  key={`overflow-${booking.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background py-4 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderLeftWidth: 4, borderLeftColor: '#d97706' }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {patient.fullName.trim() || 'Patient'}
                      </p>
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        Overflow
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {doctor.fullName.trim() || 'Doctor'} · offline capacity request
                    </p>
                  </div>
                  <Link
                    href="/overflow"
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  >
                    Review
                  </Link>
                </li>
              ))}

              {unpaidClinic.slice(0, 4).map(({ booking, patient, doctor }) => (
                <li
                  key={`unpaid-${booking.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background py-4 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderLeftWidth: 4, borderLeftColor: 'var(--primary)' }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {patient.fullName.trim() || 'Patient'}
                      </p>
                      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                        Unpaid clinic
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {doctor.fullName.trim() || 'Doctor'} · mark paid when collected
                    </p>
                  </div>
                  <Link
                    href="/clinic-payments"
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-primary"
                  >
                    Open
                  </Link>
                </li>
              ))}

              {recentNotifications.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <Link
                    href={notificationDestination(item)}
                    className={`block rounded-2xl border px-4 py-3 transition hover:border-primary ${
                      item.readAt
                        ? 'border-border bg-background'
                        : 'border-primary/25 bg-primary-soft'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">
              Quick Actions
            </h2>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/overflow"
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 transition hover:bg-primary-soft/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">Overflow queue</p>
                    <p className="text-xs text-muted">Accept or reject offline requests</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">Open</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/clinic-payments"
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 transition hover:bg-primary-soft/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">Clinic payments</p>
                    <p className="text-xs text-muted">Mark collected visit fees</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">Open</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/invites"
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 transition hover:bg-primary-soft/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">Invites</p>
                    <p className="text-xs text-muted">Create doctor or admin setup links</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">Open</span>
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
