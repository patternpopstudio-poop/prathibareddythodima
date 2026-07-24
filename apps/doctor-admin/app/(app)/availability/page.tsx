import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AvailabilityManager } from '@/components/availability-manager';
import { fetchDoctorAvailability, fetchUpcomingOpenSlots } from '@/lib/availability';
import { requireStaff } from '@/lib/auth';

export default async function AvailabilityPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Availability</h1>
        <p className="max-w-xl text-muted">
          Doctors manage their own hours and open slots. Admins can create doctor accounts from{' '}
          <Link href="/invites" className="font-semibold text-primary hover:underline">
            Invites
          </Link>
          .
        </p>
      </div>
    );
  }

  const [rules, slots] = await Promise.all([
    fetchDoctorAvailability(staff.supabase, staff.userId),
    fetchUpcomingOpenSlots(staff.supabase, staff.userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Availability</h1>
        <p className="max-w-2xl text-muted">
          Set weekly hours, generate bookable slots (15+ minutes), and remove open slots patients
          have not booked yet.
        </p>
      </div>

      <AvailabilityManager
        doctorId={staff.userId}
        initialRules={rules}
        initialSlots={slots}
      />
    </div>
  );
}
