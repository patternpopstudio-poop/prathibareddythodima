import type { ConsultationMode, DoctorCaseQueue } from '@teleconsult/shared-types';
import {
  bookingPaymentStatusLabel,
  consultationModeLabel,
  isBookingChatActive,
  parseConsultationMode,
} from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  DashboardKpiStrip,
  KpiBellIcon,
  KpiCalendarIcon,
  KpiQueueIcon,
} from '@/components/dashboard-kpi-strip';
import { RefreshButton } from '@/components/refresh-button';
import { requireStaff } from '@/lib/auth';
import { formatBookingWhen, formatPatientShortName } from '@/lib/bookings';
import {
  consultationStatusLabel,
  doctorCaseQueueEmptyCopy,
  doctorCaseQueueLabel,
  fetchDoctorCaseQueueCounts,
  fetchDoctorConsultations,
  formatConsultationActivity,
  parseDoctorCaseQueue,
} from '@/lib/consultations';

const MODES: ConsultationMode[] = ['online', 'offline'];
const QUEUES: DoctorCaseQueue[] = ['all', 'unreplied', 'response_awaited'];

function modeHref(mode: ConsultationMode): string {
  return mode === 'online' ? '/cases' : `/cases?mode=${mode}`;
}

function queueHref(queue: DoctorCaseQueue, mode: ConsultationMode): string {
  const params = new URLSearchParams();
  if (mode !== 'online') params.set('mode', mode);
  if (queue !== 'all') params.set('queue', queue);
  const qs = params.toString();
  return qs ? `/cases?${qs}` : '/cases';
}

function patientInitial(fullName: string): string {
  return fullName.trim().charAt(0).toUpperCase() || 'P';
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string | string[]; mode?: string | string[] }>;
}) {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Cases
        </h1>
        <p className="max-w-xl text-muted">
          Doctors manage consultation chats here. Admins can create doctor accounts from{' '}
          <Link href="/invites" className="font-semibold text-primary hover:underline">
            Invites
          </Link>
          .
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const mode = parseConsultationMode(params.mode);
  const queue = mode === 'online' ? parseDoctorCaseQueue(params.queue) : 'all';
  const [cases, counts] = await Promise.all([
    fetchDoctorConsultations(staff.supabase, staff.userId, { queue, mode }),
    fetchDoctorCaseQueueCounts(staff.supabase, staff.userId),
  ]);
  const empty =
    mode === 'offline'
      ? {
          title: 'No offline cases',
          description:
            'Confirmed in-clinic visits appear here. Chat is only available for online cases.',
        }
      : doctorCaseQueueEmptyCopy(queue);
  const countFor = (q: DoctorCaseQueue) =>
    q === 'unreplied'
      ? counts.unreplied
      : q === 'response_awaited'
        ? counts.responseAwaited
        : counts.all;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Cases
          </h1>
          <p className="max-w-2xl text-muted">
            Online cases use chat queues. Offline cases show appointment details only — messaging
            is not available for in-clinic visits.
          </p>
        </div>
        <RefreshButton />
      </div>

      <DashboardKpiStrip
        items={[
          {
            label: 'Unreplied',
            value:
              counts.unreplied === 0 ? 'None' : String(counts.unreplied),
            tone: 'amber',
            icon: <KpiBellIcon />,
          },
          {
            label: 'Response Awaited',
            value:
              counts.responseAwaited === 0
                ? 'None'
                : String(counts.responseAwaited),
            tone: 'blue',
            icon: <KpiQueueIcon />,
          },
          {
            label: 'All Online',
            value:
              counts.all === 0 ? 'None' : `${counts.all} Cases`,
            tone: 'green',
            icon: <KpiCalendarIcon />,
          },
        ]}
      />

      <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mb-4 flex flex-wrap gap-4 border-b border-border">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <Link
                key={m}
                href={modeHref(m)}
                className={`relative -mb-px shrink-0 pb-2.5 text-sm font-semibold transition-colors ${
                  active ? 'text-primary' : 'text-muted hover:text-foreground'
                }`}
              >
                {consultationModeLabel(m)}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </div>

        {mode === 'online' ? (
          <div className="mb-4 flex flex-wrap gap-4 border-b border-border">
            {QUEUES.map((q) => {
              const active = q === queue;
              const count = countFor(q);
              return (
                <Link
                  key={q}
                  href={queueHref(q, mode)}
                  className={`relative -mb-px shrink-0 pb-2.5 text-xs font-semibold transition-colors ${
                    active ? 'text-primary' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {doctorCaseQueueLabel(q)}
                  <span
                    className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                      active ? 'bg-primary-soft text-primary' : 'bg-background text-muted'
                    }`}
                  >
                    {count}
                  </span>
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}

        {cases.length === 0 ? (
          <div className="rounded-2xl bg-background px-4 py-6">
            <p className="text-sm font-semibold text-foreground">{empty.title}</p>
            <p className="mt-1 text-sm text-muted">{empty.description}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {cases.map(({ consultation, patient, lastMessagePreview, booking, slot }) => {
              const fullName = patient.fullName.trim() || 'Patient';
              const shortName = formatPatientShortName(patient.fullName);
              const isOnline = mode === 'online';
              const bookingCancelled = booking
                ? !isBookingChatActive(booking.status)
                : false;
              const statusLabel = bookingCancelled
                ? 'Cancelled'
                : isOnline
                  ? consultationStatusLabel(consultation.status)
                  : consultationModeLabel('offline');
              const statusActive =
                isOnline && !bookingCancelled && consultation.status === 'in_progress';

              return (
                <li
                  key={consultation.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background py-4 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderLeftWidth: 4, borderLeftColor: 'var(--primary)' }}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
                      aria-hidden
                    >
                      {patientInitial(fullName)}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{shortName}</p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            statusActive
                              ? 'bg-primary-soft text-primary'
                              : 'bg-surface text-muted'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {isOnline ? (
                        <>
                          <p className="line-clamp-2 text-sm text-muted">
                            {lastMessagePreview || 'No messages yet — open to reply'}
                          </p>
                          <p className="text-xs text-muted">
                            {formatConsultationActivity(consultation.lastMessageAt)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted">
                            {slot
                              ? formatBookingWhen(slot.startsAt, slot.endsAt)
                              : 'Appointment time pending'}
                          </p>
                          <p className="text-xs text-muted">
                            {booking
                              ? `Payment: ${bookingPaymentStatusLabel(booking)}`
                              : 'In-clinic visit — chat not available'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/cases/${consultation.id}`}
                    className={`inline-flex shrink-0 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      isOnline
                        ? 'bg-primary text-white hover:bg-primary-hover'
                        : 'bg-primary-soft text-primary hover:bg-primary-soft/80'
                    }`}
                  >
                    {bookingCancelled
                      ? 'Remove chat'
                      : isOnline
                        ? 'Open Consultation'
                        : 'View Visit'}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
