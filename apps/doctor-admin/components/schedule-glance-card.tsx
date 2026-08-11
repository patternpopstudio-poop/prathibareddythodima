import type { AppointmentSlot, DoctorAvailability } from '@teleconsult/shared-types';
import Link from 'next/link';

import { formatTime12h } from '@/lib/bookings';
import { dayKeyFromIso, localDayKey } from '@/lib/slot-calendar';

type Props = {
  availability: DoctorAvailability[];
  openSlots: AppointmentSlot[];
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatHourLabel(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12} ${period}`;
}

function todayWindowLabel(availability: DoctorAvailability[], now = new Date()): string | null {
  const day = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const todayRules = availability.filter((row) => row.isActive && row.dayOfWeek === day);
  if (todayRules.length === 0) return null;

  let earliest: number | null = null;
  let latest: number | null = null;
  for (const rule of todayRules) {
    const start = parseTimeToMinutes(rule.startTime);
    const end = parseTimeToMinutes(rule.endTime);
    if (start == null || end == null) continue;
    earliest = earliest == null ? start : Math.min(earliest, start);
    latest = latest == null ? end : Math.max(latest, end);
  }
  if (earliest == null || latest == null) return null;
  return `${formatHourLabel(earliest)} – ${formatHourLabel(latest)}`;
}

/** 7 days × 4 period cells; intensity from open-slot counts. */
function buildHeatmap(openSlots: AppointmentSlot[], now = new Date()): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + dayOffset);
    const key = localDayKey(day);
    for (const slot of openSlots) {
      if (dayKeyFromIso(slot.startsAt) !== key) continue;
      const hour = new Date(slot.startsAt).getHours();
      const period = hour < 12 ? 0 : hour < 16 ? 1 : hour < 20 ? 2 : 3;
      grid[dayOffset][period] += 1;
    }
  }
  return grid;
}

function cellClass(count: number, max: number): string {
  if (count <= 0) return 'bg-gray-100';
  const ratio = max <= 0 ? 0 : count / max;
  if (ratio > 0.66) return 'bg-primary';
  if (ratio > 0.33) return 'bg-primary/60';
  return 'bg-primary/30';
}

export function ScheduleGlanceCard({ availability, openSlots }: Props) {
  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const windowLabel = todayWindowLabel(availability, now);
  const heatmap = buildHeatmap(openSlots, now);
  const max = Math.max(0, ...heatmap.flat());

  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Schedule Glance
          </h2>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dateLabel}
          </p>
          <p className="text-sm text-muted">
            {windowLabel ?? 'No availability rules for today'}
          </p>
        </div>
        <Link
          href="/availability"
          className="shrink-0 text-xs font-semibold text-primary hover:underline"
        >
          [Edit]
        </Link>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1 text-xs text-muted">
          <p>
            Next open:{' '}
            <span className="font-semibold text-foreground">
              {openSlots[0]
                ? formatTime12h(new Date(openSlots[0].startsAt))
                : 'None'}
            </span>
          </p>
          <p>{openSlots.length} open slot{openSlots.length === 1 ? '' : 's'} ahead</p>
        </div>
        <div
          className="grid shrink-0 grid-cols-7 gap-1"
          aria-label="Next 7 days open-slot heatmap"
        >
          {heatmap.map((day, dayIndex) => (
            <div key={dayIndex} className="flex flex-col gap-1">
              {day.map((count, periodIndex) => (
                <span
                  key={periodIndex}
                  className={`h-2.5 w-2.5 rounded-[3px] ${cellClass(count, max)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
