import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth';
import { isStaffRole } from '@teleconsult/shared-types';

export default async function HomePage() {
  const session = await getSessionUser();

  if (!session?.role || !isStaffRole(session.role)) {
    redirect('/login');
  }

  redirect('/dashboard');
}
