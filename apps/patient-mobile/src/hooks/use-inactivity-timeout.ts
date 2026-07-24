import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

const INACTIVITY_MS = 30 * 60 * 1000;

/**
 * Client-side inactivity guard (pairs with Supabase auth.sessions.inactivity_timeout).
 * Signs out after 30 minutes without app interaction / foreground activity.
 */
export function useInactivityTimeout(enabled: boolean, onTimeout: () => void) {
  const lastActiveRef = useRef(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;

    const bump = () => {
      lastActiveRef.current = Date.now();
    };

    bump();

    const interval = setInterval(() => {
      if (Date.now() - lastActiveRef.current >= INACTIVITY_MS) {
        onTimeoutRef.current();
      }
    }, 30_000);

    let appSub: NativeEventSubscription | undefined;
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        if (Date.now() - lastActiveRef.current >= INACTIVITY_MS) {
          onTimeoutRef.current();
        } else {
          bump();
        }
      }
    };
    appSub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(interval);
      appSub?.remove();
    };
  }, [enabled]);
}
