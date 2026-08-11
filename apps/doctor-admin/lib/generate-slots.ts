import type { ConsultationMode, DoctorAvailability } from '@teleconsult/shared-types';
import { consultationModeLabel } from '@teleconsult/shared-types';

export type GeneratedSlotDraft = {
  availabilityId: string;
  mode: ConsultationMode;
  startsAt: string;
  endsAt: string;
};

/** Half-open overlap matching `tstzrange(starts_at, ends_at, '[)')`. */
export function slotRangesOverlap(
  aStartsAt: string,
  aEndsAt: string,
  bStartsAt: string,
  bEndsAt: string
): boolean {
  const aStart = new Date(aStartsAt).getTime();
  const aEnd = new Date(aEndsAt).getTime();
  const bStart = new Date(bStartsAt).getTime();
  const bEnd = new Date(bEndsAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export type ExistingSlotForConflict = {
  startsAt: string;
  endsAt: string;
  mode: ConsultationMode;
};

/**
 * Find the first existing non-cancelled slot that overlaps a draft.
 * Exact same start + mode is treated as "already exists" (caller skips), not a conflict.
 */
export function findOverlappingSlot(
  draft: Pick<GeneratedSlotDraft, 'startsAt' | 'endsAt' | 'mode'>,
  existing: ExistingSlotForConflict[]
): ExistingSlotForConflict | null {
  const draftStart = new Date(draft.startsAt).getTime();
  for (const slot of existing) {
    const sameStart = new Date(slot.startsAt).getTime() === draftStart;
    if (sameStart && slot.mode === draft.mode) continue;
    if (slotRangesOverlap(draft.startsAt, draft.endsAt, slot.startsAt, slot.endsAt)) {
      return slot;
    }
  }
  return null;
}

export function formatSlotConflictMessage(
  draft: Pick<GeneratedSlotDraft, 'startsAt' | 'endsAt' | 'mode'>,
  conflicting: ExistingSlotForConflict
): string {
  return (
    `Cannot create ${consultationModeLabel(draft.mode).toLowerCase()} slot ` +
    `${formatSlotRange(draft.startsAt, draft.endsAt)} — overlaps an existing ` +
    `${consultationModeLabel(conflicting.mode).toLowerCase()} slot ` +
    `${formatSlotRange(conflicting.startsAt, conflicting.endsAt)}.`
  );
}

/** Map Postgres exclusion / constraint errors to a doctor-facing message. */
export function formatSlotInsertError(err: unknown, fallback: string): string {
  const msg =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : err instanceof Error
        ? err.message
        : '';
  if (
    msg.includes('appointment_slots_no_overlap') ||
    msg.includes('appointment_slots_doctor_starts_unique') ||
    msg.includes('exclusion') ||
    msg.includes('duplicate key') ||
    msg.includes('23P01') ||
    msg.includes('23505')
  ) {
    return 'That time overlaps another online or offline slot. Choose a free window.';
  }
  return msg || fallback;
}

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
 *
 * Prefer `untilDate` (inclusive last calendar day). `days` is a fallback window length.
 */
export function generateSlotsFromRules(
  rules: DoctorAvailability[],
  options: { fromDate?: Date; days?: number; untilDate?: Date; now?: Date }
): GeneratedSlotDraft[] {
  const now = options.now ?? new Date();
  const startDay = startOfLocalDay(options.fromDate ?? now);
  const activeRules = rules.filter((r) => r.isActive);

  let days: number;
  if (options.untilDate) {
    const endDay = startOfLocalDay(options.untilDate);
    days = Math.floor((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1;
  } else {
    days = options.days ?? 14;
  }
  days = Math.max(0, Math.min(days, 60));

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
          mode: rule.mode,
          startsAt,
          endsAt,
        });
      }
    }
  }

  return drafts;
}

/** Local calendar YYYY-MM-DD for date inputs. */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local calendar day. */
export function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) throw new Error('Invalid date.');
  return new Date(y, m - 1, d);
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Deterministic 12h clock — avoids Node vs browser Intl mismatches (hydration). */
export function formatMinutesAsTime(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = ((totalMinutes % 60) + 60) % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
}

export function formatDateTimeAsTime(date: Date): string {
  return formatMinutesAsTime(date.getHours() * 60 + date.getMinutes());
}

export function formatSlotRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const datePart = `${WEEKDAYS[start.getDay()]} ${MONTHS[start.getMonth()]} ${start.getDate()}`;
  return `${datePart} · ${formatDateTimeAsTime(start)} – ${formatDateTimeAsTime(end)}`;
}

export function formatTimeLabel(value: string): string {
  return formatMinutesAsTime(parseTimeToMinutes(value));
}
