import Link from 'next/link';
import { redirect } from 'next/navigation';

import { InactivityGuard } from '@/components/inactivity-guard';
import { SignOutButton } from '@/components/sign-out-button';
import { requireStaff } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  if (!staff.ok) {
    redirect('/login');
  }

  return (
    <InactivityGuard>
      <div className="min-h-full">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-sm font-semibold tracking-[0.12em] text-primary">
                TELECONSULT
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium text-muted">
                <Link href="/dashboard" className="hover:text-foreground">
                  Dashboard
                </Link>
                {staff.role === 'doctor' ? (
                  <>
                    <Link href="/bookings" className="hover:text-foreground">
                      Bookings
                    </Link>
                    <Link href="/availability" className="hover:text-foreground">
                      Availability
                    </Link>
                    <Link href="/profile" className="hover:text-foreground">
                      Profile
                    </Link>
                  </>
                ) : null}
                {staff.role === 'admin' ? (
                  <Link href="/invites" className="hover:text-foreground">
                    Invites
                  </Link>
                ) : null}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold capitalize text-primary">
                {staff.role}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </div>
    </InactivityGuard>
  );
}
