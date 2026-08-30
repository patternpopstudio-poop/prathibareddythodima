import {
  CANCELLED_CHAT_UNAVAILABLE_COPY,
  OFFLINE_CHAT_UNAVAILABLE_COPY,
  bookingPaymentStatusLabel,
  consultationModeLabel,
  isBookingChatActive,
  isChatEnabledForMode,
} from '@teleconsult/shared-types';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ConsultationChat } from '@/components/consultation-chat';
import { RemoveCancelledChatButton } from '@/components/remove-cancelled-chat-button';
import { requireStaff } from '@/lib/auth';
import { formatBookingWhen } from '@/lib/bookings';
import {
  consultationStatusLabel,
  fetchConsultationMessages,
  fetchDoctorConsultationById,
} from '@/lib/consultations';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CaseThreadPage({ params }: Props) {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    redirect('/cases');
  }

  const { id } = await params;
  const caseRow = await fetchDoctorConsultationById(staff.supabase, staff.userId, id);
  if (!caseRow) notFound();
  if (caseRow.consultation.archivedAt) redirect('/cases');

  const patientName = caseRow.patient.fullName.trim() || 'Patient';
  const chatEnabled = isChatEnabledForMode(caseRow.consultation.mode);
  const bookingCancelled = caseRow.booking
    ? !isBookingChatActive(caseRow.booking.status)
    : false;
  const composerEnabled = chatEnabled && !bookingCancelled;
  const messages = composerEnabled
    ? await fetchConsultationMessages(staff.supabase, id)
    : [];
  const backHref =
    caseRow.consultation.mode === 'offline' ? '/cases?mode=offline' : '/cases';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={backHref} className="text-sm font-semibold text-primary hover:underline">
          ← Cases
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{patientName}</h1>
            <p className="text-sm text-muted">
              {consultationModeLabel(caseRow.consultation.mode)}
              {composerEnabled
                ? ` · ${consultationStatusLabel(caseRow.consultation.status)}`
                : bookingCancelled
                  ? ' · Cancelled'
                  : ' · In-clinic'}
              {caseRow.patient.mobile ? ` · ${caseRow.patient.mobile}` : ''}
            </p>
          </div>
        </div>
      </div>

      {bookingCancelled ? (
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            {CANCELLED_CHAT_UNAVAILABLE_COPY}
          </p>
          <p className="text-sm text-muted">
            The patient cancelled this appointment. You can remove it from Cases. Message
            history is kept.
          </p>
          <RemoveCancelledChatButton
            consultationId={id}
            doctorUserId={staff.userId}
          />
        </div>
      ) : null}

      {composerEnabled ? (
        <ConsultationChat
          consultationId={id}
          doctorUserId={staff.userId}
          initialMessages={messages}
          initialStatus={caseRow.consultation.status}
          slotStartsAt={
            caseRow.slot?.startsAt ?? caseRow.booking?.preferredStartsAt ?? null
          }
        />
      ) : !bookingCancelled ? (
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {OFFLINE_CHAT_UNAVAILABLE_COPY}
            </p>
            <p className="text-sm text-muted">
              Review appointment details below. Messaging is only available for online
              consultations.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Appointment
              </dt>
              <dd className="text-sm text-foreground">
                {caseRow.slot
                  ? formatBookingWhen(caseRow.slot.startsAt, caseRow.slot.endsAt)
                  : 'Time pending'}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Payment
              </dt>
              <dd className="text-sm text-foreground">
                {caseRow.booking
                  ? bookingPaymentStatusLabel(caseRow.booking)
                  : '—'}
              </dd>
            </div>
            {caseRow.patient.email ? (
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Email
                </dt>
                <dd className="break-all text-sm text-foreground">{caseRow.patient.email}</dd>
              </div>
            ) : null}
            {caseRow.patient.mobile ? (
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Mobile
                </dt>
                <dd className="text-sm text-foreground">{caseRow.patient.mobile}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
