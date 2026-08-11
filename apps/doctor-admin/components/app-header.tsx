'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { SignOutButton } from '@/components/sign-out-button';

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

type Props = {
  role: 'doctor' | 'admin';
  unreadCount: number;
  photoUrl?: string | null;
  displayName?: string | null;
};

function buildNavItems(role: Props['role']): NavItem[] {
  const items: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      match: (p) => p === '/dashboard' || p === '/',
    },
  ];

  if (role === 'doctor') {
    items.push(
      {
        href: '/bookings',
        label: 'Bookings',
        match: (p) => p.startsWith('/bookings'),
      },
      {
        href: '/cases',
        label: 'Cases',
        match: (p) => p.startsWith('/cases'),
      },
      {
        href: '/availability',
        label: 'Availability',
        match: (p) => p.startsWith('/availability'),
      },
      {
        href: '/profile',
        label: 'Profile',
        match: (p) => p.startsWith('/profile'),
      }
    );
  }

  if (role === 'admin') {
    items.push(
      {
        href: '/overflow',
        label: 'Overflow',
        match: (p) => p.startsWith('/overflow'),
      },
      {
        href: '/clinic-payments',
        label: 'Clinic payments',
        match: (p) => p.startsWith('/clinic-payments'),
      },
      {
        href: '/invites',
        label: 'Invites',
        match: (p) => p.startsWith('/invites'),
      }
    );
  }

  return items;
}

function avatarInitial(name: string | null | undefined, role: Props['role']): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed.charAt(0).toUpperCase();
  return role === 'admin' ? 'A' : 'D';
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function AppHeader({ role, unreadCount, photoUrl, displayName }: Props) {
  const pathname = usePathname();
  const items = buildNavItems(role);
  const initial = avatarInitial(displayName, role);
  const profileHref = role === 'doctor' ? '/profile' : '/dashboard';
  const notificationsActive = pathname.startsWith('/notifications');
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.match(pathname))
  );

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const nav = navRef.current;
    const el = itemRefs.current[activeIndex];
    if (!nav || !el) return;

    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPill({
      left: elRect.left - navRect.left + nav.scrollLeft,
      width: elRect.width,
      ready: true,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure, pathname, items.length]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(nav);

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [measure]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/dashboard"
            className="shrink-0 text-sm font-semibold tracking-[0.14em] text-primary"
          >
            TELECONSULT
          </Link>

          <nav
            ref={navRef}
            className="relative flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-background/80 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Primary"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                width: pill.width,
                transform: `translateX(${pill.left}px)`,
                opacity: pill.ready && !notificationsActive ? 1 : 0,
              }}
            />

            {items.map((item, index) => {
              const active = !notificationsActive && index === activeIndex;
              return (
                <Link
                  key={item.href}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  href={item.href}
                  prefetch
                  className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    active
                      ? 'text-foreground'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/notifications"
            prefetch
            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
              notificationsActive
                ? 'bg-primary-soft text-primary ring-primary/30'
                : 'bg-background text-muted ring-border/70 hover:text-foreground hover:ring-primary/40'
            }`}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            title="Notifications"
          >
            <BellIcon />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Link>
          <Link
            href={profileHref}
            className="inline-flex h-9 w-9 overflow-hidden rounded-full bg-primary-soft ring-1 ring-border/70 transition hover:ring-primary/40"
            aria-label={role === 'doctor' ? 'Open profile' : 'Account'}
            title={displayName?.trim() || (role === 'doctor' ? 'Profile' : 'Admin')}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote storage URL
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-primary">
                {initial}
              </span>
            )}
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
