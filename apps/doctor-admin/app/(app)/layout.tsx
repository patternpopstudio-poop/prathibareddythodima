import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/app-header';
import { InactivityGuard } from '@/components/inactivity-guard';
import { requireStaff } from '@/lib/auth';
import { fetchDoctorProfile } from '@/lib/doctors';
import { fetchUnreadNotificationCount } from '@/lib/notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  if (!staff.ok) {
    redirect('/login');
  }

  const [unreadCount, doctor] = await Promise.all([
    fetchUnreadNotificationCount(staff.supabase).catch(() => 0),
    staff.role === 'doctor'
      ? fetchDoctorProfile(staff.supabase, staff.userId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <InactivityGuard>
      <div className="min-h-full">
        <AppHeader
          role={staff.role}
          unreadCount={unreadCount}
          photoUrl={doctor?.photoUrl ?? null}
          displayName={doctor?.fullName ?? null}
        />
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </div>
    </InactivityGuard>
  );
}
