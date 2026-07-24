import { redirect } from 'next/navigation';

import { InviteForm } from '@/components/invite-form';
import { requireStaff } from '@/lib/auth';

export default async function InvitesPage() {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');
  if (staff.role !== 'admin') redirect('/dashboard');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Invite users</h1>
        <p className="mt-2 max-w-xl text-muted">
          Create a one-time setup link for doctors or admins. Requires the backend service with the
          Supabase service role key.
        </p>
      </div>
      <InviteForm />
    </div>
  );
}
