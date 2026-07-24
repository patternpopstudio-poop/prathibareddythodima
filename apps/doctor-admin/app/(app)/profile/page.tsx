import { needsDoctorPhoto } from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DoctorProfileForm } from '@/components/doctor-profile-form';
import { requireStaff } from '@/lib/auth';
import { fetchDoctorProfile } from '@/lib/doctors';

export default async function ProfilePage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="max-w-xl text-muted">
          Doctor profile photos are managed on doctor accounts. Admins use{' '}
          <Link href="/invites" className="font-semibold text-primary hover:underline">
            Invites
          </Link>{' '}
          to create doctors.
        </p>
      </div>
    );
  }

  const doctor = await fetchDoctorProfile(staff.supabase, staff.userId);
  if (!doctor) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-danger">Doctor profile row was not found. Contact an admin.</p>
      </div>
    );
  }

  const needsPhoto = needsDoctorPhoto(doctor);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted">
          Keep your details current. A profile photo is required to complete your doctor profile.
        </p>
      </div>

      {needsPhoto ? (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-foreground">
          Add a clear profile photo so patients can recognise you when booking.
        </div>
      ) : null}

      <DoctorProfileForm doctor={doctor} />
    </div>
  );
}
