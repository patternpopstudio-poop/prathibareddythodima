'use client';

import type { AppNotification } from '@teleconsult/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  markNotificationsRead,
  notificationDestination,
} from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';

type Props = {
  initialItems: AppNotification[];
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationsInbox({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unread = items.filter((n) => !n.readAt);

  async function markAllRead() {
    if (busy || unread.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await markNotificationsRead(supabase);
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark notifications read.');
    } finally {
      setBusy(false);
    }
  }

  async function openItem(notification: AppNotification) {
    if (!notification.readAt) {
      try {
        const supabase = createClient();
        await markNotificationsRead(supabase, [notification.id]);
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
      } catch {
        // Navigation still useful even if mark-read fails.
      }
    }
    router.push(notificationDestination(notification));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-semibold text-foreground">No notifications yet</p>
        <p className="mt-1 text-sm text-muted">
          Overflow requests, clinic payment nudges, and assigned offline bookings appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {unread.length === 0
            ? 'All caught up.'
            : `${unread.length} unread notification${unread.length === 1 ? '' : 's'}.`}
        </p>
        {unread.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markAllRead()}
            className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {busy ? 'Updating…' : 'Mark all read'}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => void openItem(item)}
              className={`w-full rounded-3xl border px-5 py-4 text-left transition hover:border-primary ${
                item.readAt
                  ? 'border-border bg-surface'
                  : 'border-primary/25 bg-primary-soft'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted">{item.body}</p>
                </div>
                {!item.readAt ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted">{formatWhen(item.createdAt)}</p>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted">
        Tip: overflow requests also live on{' '}
        <Link href="/overflow" className="font-semibold text-primary hover:underline">
          Overflow
        </Link>
        ; unpaid clinic visits on{' '}
        <Link href="/clinic-payments" className="font-semibold text-primary hover:underline">
          Clinic payments
        </Link>
        .
      </p>
    </div>
  );
}
