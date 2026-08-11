import { needsDoctorPhoto } from '@teleconsult/shared-types';
import { redirect } from 'next/navigation';

import { AdminDashboardView } from '@/components/admin-dashboard-view';
import type { CasePreviewItem } from '@/components/doctor-cases-preview';
import { DoctorDashboardView } from '@/components/doctor-dashboard-view';
import { requireStaff } from '@/lib/auth';
import { fetchDoctorAvailability, fetchUpcomingOpenSlots } from '@/lib/availability';
import { fetchDoctorUpcomingBookings, isLocalToday } from '@/lib/bookings';
import { fetchClinicUnpaidBookings } from '@/lib/clinic-payments';
import {
  fetchConsultationIdsByBookingIds,
  fetchDoctorCaseQueueCounts,
  fetchDoctorConsultations,
  formatConsultationActivity,
  type DoctorConsultationCase,
} from '@/lib/consultations';
import { fetchDoctorProfile } from '@/lib/doctors';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
} from '@/lib/notifications';
import { fetchPendingOverflowBookings } from '@/lib/overflow';
import { dayKeyFromIso, localDayKey } from '@/lib/slot-calendar';

function toCasePreview(item: DoctorConsultationCase): CasePreviewItem {
  const hasActivity = Boolean(item.consultation.lastMessageAt);
  return {
    id: item.consultation.id,
    patientName: item.patient.fullName.trim() || 'Patient',
    preview: item.lastMessagePreview ?? 'No messages yet',
    activityLabel: hasActivity
      ? formatConsultationActivity(item.consultation.lastMessageAt)
      : '',
  };
}

function doctorDisplayName(fullName: string | null | undefined): string {
  const name = fullName?.trim();
  if (!name) return 'Doctor';
  if (/^dr\.?\s/i.test(name)) return name;
  return `Dr. ${name}`;
}

export default async function DashboardPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role === 'admin') {
    const [overflow, unpaid, recentNotifications, unreadCount] = await Promise.all([
      fetchPendingOverflowBookings(staff.supabase, 100).catch(() => []),
      fetchClinicUnpaidBookings(staff.supabase, 100).catch(() => []),
      fetchNotifications(staff.supabase, { unreadOnly: true, limit: 3 }).catch(() => []),
      fetchUnreadNotificationCount(staff.supabase).catch(() => 0),
    ]);

    return (
      <AdminDashboardView
        displayName="Admin"
        pendingOverflow={overflow}
        unpaidClinic={unpaid}
        recentNotifications={recentNotifications}
        unreadCount={unreadCount}
      />
    );
  }

  const glanceUntil = new Date();
  glanceUntil.setDate(glanceUntil.getDate() + 7);
  glanceUntil.setHours(23, 59, 59, 999);

  const [
    doctor,
    bookings,
    queueCounts,
    unrepliedCases,
    responseAwaitedCases,
    latestCases,
    availability,
    openSlots,
    recentNotifications,
    unreadCount,
  ] = await Promise.all([
    fetchDoctorProfile(staff.supabase, staff.userId),
    fetchDoctorUpcomingBookings(staff.supabase, staff.userId, 50),
    fetchDoctorCaseQueueCounts(staff.supabase, staff.userId),
    fetchDoctorConsultations(staff.supabase, staff.userId, {
      queue: 'unreplied',
      limit: 3,
    }),
    fetchDoctorConsultations(staff.supabase, staff.userId, {
      queue: 'response_awaited',
      limit: 3,
    }),
    fetchDoctorConsultations(staff.supabase, staff.userId, {
      queue: 'all',
      limit: 3,
    }),
    fetchDoctorAvailability(staff.supabase, staff.userId).catch(() => []),
    // Heatmap only needs the next 7 days — avoid shipping hundreds of slots.
    fetchUpcomingOpenSlots(staff.supabase, staff.userId, {
      limit: 120,
      until: glanceUntil,
    }).catch(() => []),
    fetchNotifications(staff.supabase, { unreadOnly: true, limit: 3 }).catch(() => []),
    fetchUnreadNotificationCount(staff.supabase).catch(() => 0),
  ]);

  const displayName = doctorDisplayName(doctor?.fullName);
  const showPhotoNudge = needsDoctorPhoto(doctor);

  const todayBookings = bookings.filter((row) => isLocalToday(row.slot.startsAt));
  const todayKey = localDayKey(new Date());
  const todayOpenSlotsCount = openSlots.filter(
    (slot) => dayKeyFromIso(slot.startsAt) === todayKey
  ).length;

  const consultationByBookingId = await fetchConsultationIdsByBookingIds(
    staff.supabase,
    todayBookings.map((row) => row.booking.id)
  );

  return (
    <DoctorDashboardView
      displayName={displayName}
      todayBookings={todayBookings}
      consultationByBookingId={consultationByBookingId}
      todayOpenSlotsCount={todayOpenSlotsCount}
      unrepliedCount={queueCounts.unreplied}
      responseAwaitedCount={queueCounts.responseAwaited}
      unrepliedCases={unrepliedCases.map(toCasePreview)}
      responseAwaitedCases={responseAwaitedCases.map(toCasePreview)}
      latestCases={latestCases.map(toCasePreview)}
      availability={availability}
      openSlots={openSlots}
      recentNotifications={recentNotifications}
      unreadCount={unreadCount}
      showPhotoNudge={showPhotoNudge}
    />
  );
}
