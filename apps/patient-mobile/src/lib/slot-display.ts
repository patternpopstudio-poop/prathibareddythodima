import type { AppointmentSlot } from '@teleconsult/shared-types';

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
    const d = new Date(slot.startsAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
