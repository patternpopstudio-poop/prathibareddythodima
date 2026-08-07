import type { AppointmentSlot } from '@teleconsult/shared-types';

import { formatDateTimeAsTime, toDateInputValue } from '@/lib/generate-slots';

export type SlotPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export const SLOT_PERIODS: { id: SlotPeriod; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
];

export type CalendarDayChip = {
  dayKey: string;
  weekday: string;
  dayNumber: string;
  hasSlots: boolean;
};

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function localDayKey(date: Date): string {
  return toDateInputValue(date);
}

export function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

export function monthKeyFromDate(date: Date): string {
  return toDateInputValue(date).slice(0, 7);
}

export function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function formatMonthYear(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS_LONG[(m ?? 1) - 1]} ${y}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1 + delta, 1);
  return monthKeyFromDate(date);
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

export function groupSlotsByDay(slots: AppointmentSlot[]): Map<string, AppointmentSlot[]> {
  const map = new Map<string, AppointmentSlot[]>();
  for (const slot of slots) {
    const key = dayKeyFromIso(slot.startsAt);
    const list = map.get(key);
    if (list) list.push(slot);
    else map.set(key, [slot]);
  }
  return map;
}

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
      weekday: WEEKDAYS_SHORT[date.getDay()],
      dayNumber: String(day),
      hasSlots: (slotsByDay.get(dayKey)?.length ?? 0) > 0,
    });
  }

  return chips;
}

export function formatSlotChipTime(iso: string): string {
  return formatDateTimeAsTime(new Date(iso));
}
