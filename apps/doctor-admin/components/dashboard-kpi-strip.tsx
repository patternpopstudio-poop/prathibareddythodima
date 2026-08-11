import type { ReactNode } from 'react';

export type DashboardKpi = {
  label: string;
  value: string;
  tone: 'green' | 'amber' | 'blue';
  icon: ReactNode;
};

const TONE_CLASSES: Record<DashboardKpi['tone'], string> = {
  green: 'bg-primary text-white',
  amber: 'bg-amber-500 text-white',
  blue: 'bg-sky-500 text-white',
};

export function DashboardKpiStrip({ items }: { items: DashboardKpi[] }) {
  return (
    <div className="grid gap-0 overflow-hidden rounded-[24px] bg-surface shadow-[0_4px_20px_rgba(0,0,0,0.05)] sm:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex items-center gap-4 px-6 py-5 ${
            index > 0 ? 'border-t border-border sm:border-t-0 sm:border-l' : ''
          }`}
        >
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[item.tone]}`}
            aria-hidden
          >
            {item.icon}
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {item.label}
            </p>
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KpiCalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

export function KpiBellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6Z"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function KpiSlotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiQueueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h10M4 17h13" strokeLinecap="round" />
    </svg>
  );
}

export function KpiPaymentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" strokeLinecap="round" />
    </svg>
  );
}
