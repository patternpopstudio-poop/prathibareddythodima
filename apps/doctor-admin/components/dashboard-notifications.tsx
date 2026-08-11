import type { AppNotification } from '@teleconsult/shared-types';
import Link from 'next/link';

import { notificationDestination } from '@/lib/notifications';

type Props = {
  items: AppNotification[];
  unreadCount: number;
};

export function DashboardNotifications({ items, unreadCount }: Props) {
  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Notifications
          </h2>
          <p className="text-sm text-muted">
            {unreadCount === 0
              ? items.length === 0
                ? "You're all caught up"
                : 'Recent updates'
              : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link
          href="/notifications"
          className="text-xs font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-background px-4 py-6 text-sm text-muted">
          No new notifications. Booking and overflow updates will appear here.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={notificationDestination(item)}
                className={`block rounded-2xl border px-4 py-3.5 transition hover:border-primary ${
                  item.readAt
                    ? 'border-border/70 bg-background'
                    : 'border-primary/25 bg-primary-soft'
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
