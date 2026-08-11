'use client';

import Link from 'next/link';
import { useState } from 'react';

export type CasePreviewItem = {
  id: string;
  patientName: string;
  preview: string;
  activityLabel: string;
};

type TabId = 'unreplied' | 'response_awaited' | 'latest';

type Props = {
  unrepliedCount: number;
  responseAwaitedCount: number;
  unreplied: CasePreviewItem[];
  responseAwaited: CasePreviewItem[];
  latest: CasePreviewItem[];
};

const TABS: { id: TabId; label: (p: Props) => string; href: string }[] = [
  {
    id: 'unreplied',
    label: (p) => `Unreplied (${p.unrepliedCount})`,
    href: '/cases?queue=unreplied',
  },
  {
    id: 'response_awaited',
    label: (p) => `Response Awaited (${p.responseAwaitedCount})`,
    href: '/cases?queue=response_awaited',
  },
  {
    id: 'latest',
    label: () => 'Latest',
    href: '/cases',
  },
];

function itemsForTab(tab: TabId, props: Props): CasePreviewItem[] {
  if (tab === 'unreplied') return props.unreplied;
  if (tab === 'response_awaited') return props.responseAwaited;
  return props.latest;
}

function emptyCopy(tab: TabId): string {
  if (tab === 'unreplied') return 'No unreplied cases right now.';
  if (tab === 'response_awaited') return 'No patient replies waiting on you.';
  return 'No recent case activity.';
}

export function DoctorCasesPreview(props: Props) {
  const [tab, setTab] = useState<TabId>('unreplied');
  const items = itemsForTab(tab, props);
  const activeHref = TABS.find((t) => t.id === tab)?.href ?? '/cases';

  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Cases & Messages
        </h2>
        <Link href={activeHref} className="text-xs font-semibold text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="mb-4 flex gap-4 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative -mb-px shrink-0 pb-2.5 text-xs font-semibold transition-colors ${
                active ? 'text-primary' : 'text-muted hover:text-foreground'
              }`}
            >
              {t.label(props)}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">
          {emptyCopy(tab)}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/cases/${item.id}`}
                className="flex items-start gap-3 rounded-2xl bg-background px-3 py-3 transition hover:bg-primary-soft/60"
              >
                <span
                  className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
                  aria-hidden
                >
                  {item.patientName.trim().charAt(0).toUpperCase() || 'P'}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.patientName.trim() || 'Patient'}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted">
                    {item.preview || 'No messages yet'}
                    {item.activityLabel ? ` (${item.activityLabel})` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
