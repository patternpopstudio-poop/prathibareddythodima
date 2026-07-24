import type { DoctorAvailability } from '@teleconsult/shared-types';

export type GeneratedSlotDraft = {
  availabilityId: string;
  startsAt: string;
  endsAt: string;
};

/** Parse `HH:mm` or `HH:mm:ss` to minutes from midnight. */
export function parseTimeToMinutes(value: string): number {
  const parts = value.split(':').map((p) => Number(p));
  const hours = parts[0] ?? NaN;
  const minutes = parts[1] ?? 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid time: ${value}`);
  }
  return hours * 60 + minutes;
}

function localIsoFromParts(year: number, monthIndex: number, day: number, minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(year, monthIndex, day, hours, mins, 0, 0).toISOString();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Expand weekly availability rules into concrete open-slot drafts.
 * Uses the browser/runtime local timezone for wall-clock times.
 */
export function generateSlotsFromRules(
  rules: DoctorAvailability[],
  options: { fromDate?: Date; days: number; now?: Date }
): GeneratedSlotDraft[] {
  const now = options.now ?? new Date();
  const days = Math.max(1, Math.min(options.days, 60));
  const startDay = startOfLocalDay(options.fromDate ?? now);
  const activeRules = rules.filter((r) => r.isActive);

  const drafts: GeneratedSlotDraft[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(startDay);
    day.setDate(startDay.getDate() + offset);
    const dayOfWeek = day.getDay();
    const year = day.getFullYear();
    const month = day.getMonth();
    const date = day.getDate();

    for (const rule of activeRules) {
      if (rule.dayOfWeek !== dayOfWeek) continue;

      const startMin = parseTimeToMinutes(rule.startTime);
      const endMin = parseTimeToMinutes(rule.endTime);
      const duration = rule.slotDurationMinutes;
      const buffer = rule.bufferMinutes;
      const step = duration + buffer;

      if (duration < 15 || endMin <= startMin || step <= 0) continue;

      for (let cursor = startMin; cursor + duration <= endMin; cursor += step) {
        const startsAt = localIsoFromParts(year, month, date, cursor);
        const endsAt = localIsoFromParts(year, month, date, cursor + duration);
        if (new Date(startsAt) <= now) continue;

        drafts.push({
          availabilityId: rule.id,
          startsAt,
          endsAt,
        });
      }
    }
  }

  return drafts;
}

export const DAY_OF_WEEK_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function formatSlotRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const datePart = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(start);
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function formatTimeLabel(value: string): string {
  const minutes = parseTimeToMinutes(value);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const d = new Date();
  d.setHours(hours, mins, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
