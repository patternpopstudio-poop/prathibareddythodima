import { needsDoctorPhoto } from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireStaff } from '@/lib/auth';
import { fetchDoctorUpcomingBookings } from '@/lib/bookings';
import { fetchDoctorProfile } from '@/lib/doctors';

export default async function DashboardPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  let displayName = 'there';
  let showPhotoNudge = false;
  let upcomingCount = 0;

  if (staff.role === 'doctor') {
    const doctor = await fetchDoctorProfile(staff.supabase, staff.userId);
    if (doctor?.fullName) displayName = doctor.fullName;
    showPhotoNudge = needsDoctorPhoto(doctor);
    const bookings = await fetchDoctorUpcomingBookings(staff.supabase, staff.userId, 50);
    upcomingCount = bookings.length;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {displayName}</h1>
        <p className="max-w-xl text-muted">
          {staff.role === 'admin'
            ? 'Use Invites to create doctor or admin setup links.'
            : 'Review upcoming bookings and keep your availability current.'}
        </p>
      </div>

      {staff.role === 'doctor' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface px-5 py-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Upcoming bookings</p>
              <p className="text-sm text-muted">
                {upcomingCount === 0
                  ? 'No confirmed appointments yet.'
                  : `${upcomingCount} confirmed appointment${upcomingCount === 1 ? '' : 's'}.`}
              </p>
            </div>
            <Link
              href="/bookings"
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              View bookings
            </Link>
          </div>
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface px-5 py-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Manage availability</p>
              <p className="text-sm text-muted">
                Add weekly hours and generate open slots patients can book.
              </p>
            </div>
            <Link
              href="/availability"
              className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:border-primary"
            >
              Open availability
            </Link>
          </div>
        </div>
      ) : null}

      {showPhotoNudge ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-primary/20 bg-primary-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Add your profile photo</p>
            <p className="text-sm text-muted">
              A photo is required to complete your doctor profile (soft gate — you can still use the app).
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover">
            Go to profile
          </Link>
        </div>
      ) : null}
    </div>
  );
}
