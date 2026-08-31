'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { createClient } from '@/lib/supabase/client';

const INACTIVITY_MS = 30 * 60 * 1000;

/** Client inactivity timeout paired with Supabase auth.sessions.inactivity_timeout. */
export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastActive = useRef<number | null>(null);

  useEffect(() => {
    lastActive.current = Date.now();

    const bump = () => {
      lastActive.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    events.forEach((event) => window.addEventListener(event, bump, { passive: true }));

    const interval = setInterval(async () => {
      if (
        lastActive.current == null ||
        Date.now() - lastActive.current < INACTIVITY_MS
      ) {
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    }, 30_000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, bump));
      clearInterval(interval);
    };
  }, [router]);

  return children;
}
