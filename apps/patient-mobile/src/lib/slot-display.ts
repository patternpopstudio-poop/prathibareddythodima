import type { AppointmentSlot } from '@teleconsult/shared-types';

export type SlotPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export const SLOT_PERIODS: { id: SlotPeriod; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
];

export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

export function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function formatMonthYear(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1));
}

export function formatSlotDayLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

/** Compact date for home / list cards — e.g. `22 May 2026`. */
export function formatSlotShortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Booking summary line — e.g. `Wed, 14 Feb 2026`. */
export function formatBookingSummaryDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatSlotTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatSlotTimeRange(startsAt: string, endsAt: string): string {
  return `${formatSlotTimeLabel(startsAt)} – ${formatSlotTimeLabel(endsAt)}`;
}

export type SlotDayGroup = {
  dayKey: string;
  dayLabel: string;
  slots: AppointmentSlot[];
};

/** Group open slots by local calendar day, preserving start-time order. */
export function groupSlotsByDay(slots: AppointmentSlot[]): SlotDayGroup[] {
  const groups = new Map<string, SlotDayGroup>();

  for (const slot of slots) {
    const dayKey = dayKeyFromIso(slot.startsAt);
    const existing = groups.get(dayKey);
    if (existing) {
      existing.slots.push(slot);
    } else {
      groups.set(dayKey, {
        dayKey,
        dayLabel: formatSlotDayLabel(slot.startsAt),
        slots: [slot],
      });
    }
  }

  return Array.from(groups.values());
}

export function getSlotPeriod(iso: string): SlotPeriod {
  const hour = new Date(iso).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function filterSlotsByPeriod(
  slots: AppointmentSlot[],
  period: SlotPeriod
): AppointmentSlot[] {
  return slots.filter((slot) => getSlotPeriod(slot.startsAt) === period);
}

export function firstPeriodWithSlots(slots: AppointmentSlot[]): SlotPeriod {
  for (const { id } of SLOT_PERIODS) {
    if (slots.some((slot) => getSlotPeriod(slot.startsAt) === id)) return id;
  }
  return 'morning';
}

export type CalendarDayChip = {
  dayKey: string;
  weekday: string;
  dayNumber: string;
  hasSlots: boolean;
};

/** All local calendar days in a YYYY-MM month, with slot availability flags. */
export function buildMonthDayChips(
  monthKey: string,
  slotsByDay: Map<string, AppointmentSlot[]>
): CalendarDayChip[] {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const chips: CalendarDayChip[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(y, m - 1, day);
    const dayKey = localDayKey(date);
    chips.push({
      dayKey,
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      dayNumber: String(day),
      hasSlots: (slotsByDay.get(dayKey)?.length ?? 0) > 0,
    });
  }

  return chips;
}

/** Next N local calendar days starting today, with slot availability flags. */
export function buildNextDayChips(
  dayCount: number,
  slotsByDay: Map<string, AppointmentSlot[]>
): CalendarDayChip[] {
  const chips: CalendarDayChip[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < dayCount; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dayKey = localDayKey(date);
    chips.push({
      dayKey,
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      dayNumber: String(date.getDate()),
      hasSlots: (slotsByDay.get(dayKey)?.length ?? 0) > 0,
    });
  }

  return chips;
}

/** Group slots into a dayKey → slots map (local calendar days). */
export function slotsByDayMap(slots: AppointmentSlot[]): Map<string, AppointmentSlot[]> {
  const map = new Map<string, AppointmentSlot[]>();
  for (const slot of slots) {
    const dayKey = dayKeyFromIso(slot.startsAt);
    const existing = map.get(dayKey);
    if (existing) existing.push(slot);
    else map.set(dayKey, [slot]);
  }
  return map;
}

/** Unique month keys (YYYY-MM) that contain at least one open slot, sorted. */
export function availableMonthKeys(slots: AppointmentSlot[]): string[] {
  const keys = new Set<string>();
  for (const slot of slots) {
    keys.add(monthKeyFromDayKey(dayKeyFromIso(slot.startsAt)));
  }
  return Array.from(keys).sort();
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return monthKeyFromDate(date);
}
