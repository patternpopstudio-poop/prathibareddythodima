import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NotificationsInbox } from '@/components/notifications-inbox';
import { requireStaff } from '@/lib/auth';
import { fetchNotifications } from '@/lib/notifications';

export default async function NotificationsPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  const items = await fetchNotifications(staff.supabase, { limit: 50 });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="max-w-2xl text-muted">
          {staff.role === 'admin'
            ? 'Overflow queue alerts and clinic payment nudges for hospital ops.'
            : 'Assigned offline bookings and same-day schedule updates.'}
        </p>
        <p className="text-sm text-muted">
          <Link href="/dashboard" className="font-semibold text-primary hover:underline">
            Back to dashboard
          </Link>
        </p>
      </div>

      <NotificationsInbox initialItems={items} />
    </div>
  );
}
