'use client';

import type { AppointmentSlot } from '@teleconsult/shared-types';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildMonthDayChips,
    filterSlotsByPeriod,
    firstPeriodWithSlots,
    formatMonthYear,
    formatSlotChipTime,
    groupSlotsByDay,
    monthKeyFromDate,
    monthKeyFromDayKey,
    shiftMonthKey,
    SLOT_PERIODS,
    type SlotPeriod
} from '@/lib/slot-calendar';

const MAX_MONTHS_AHEAD = 6;

type Props = {
  slots: AppointmentSlot[];
  busy?: boolean;
  onDeleteSlot: (slotId: string) => void;
};

export function SlotsCalendar({ slots, busy = false, onDeleteSlot }: Props) {
  const dateStripRef = useRef<HTMLDivElement>(null);
  const slotsByDay = useMemo(() => groupSlotsByDay(slots), [slots]);

  const firstAvailableDay = useMemo(() => {
    const keys = Array.from(slotsByDay.keys()).sort();
    return keys[0] ?? null;
  }, [slotsByDay]);

  const [selectedMonthKey, setSelectedMonthKey] = useState(
    () =>
      (firstAvailableDay
        ? monthKeyFromDayKey(firstAvailableDay)
        : monthKeyFromDate(new Date()))
  );
  const [selectedDayChoice, setSelectedDayChoice] = useState<
    string | null | undefined
  >(
    () => firstAvailableDay
  );
  const [selectedPeriod, setSelectedPeriod] = useState<SlotPeriod>('morning');

  const selectedDayKey =
    selectedDayChoice === null
      ? null
      : selectedDayChoice && slotsByDay.has(selectedDayChoice)
        ? selectedDayChoice
        : firstAvailableDay;
  const selectionNeedsFallback =
    selectedDayChoice !== null &&
    (!selectedDayChoice || !slotsByDay.has(selectedDayChoice));
  const monthKey =
    selectionNeedsFallback && selectedDayKey
      ? monthKeyFromDayKey(selectedDayKey)
      : selectedMonthKey;

  const daySlots = useMemo(
    () => (selectedDayKey ? (slotsByDay.get(selectedDayKey) ?? []) : []),
    [selectedDayKey, slotsByDay]
  );

  const period =
    daySlots.length > 0 &&
    filterSlotsByPeriod(daySlots, selectedPeriod).length === 0
      ? firstPeriodWithSlots(daySlots)
      : selectedPeriod;

  const periodSlots = useMemo(
    () => filterSlotsByPeriod(daySlots, period),
    [daySlots, period]
  );

  const chips = useMemo(
    () => buildMonthDayChips(monthKey, slotsByDay),
    [monthKey, slotsByDay]
  );

  const todayMonthKey = monthKeyFromDate(new Date());
  const maxMonthKey = shiftMonthKey(todayMonthKey, MAX_MONTHS_AHEAD);
  const canGoPrev = monthKey > todayMonthKey;
  const canGoNext = monthKey < maxMonthKey;

  function goMonth(delta: number) {
    const next = shiftMonthKey(monthKey, delta);
    if (next < todayMonthKey || next > maxMonthKey) return;
    setSelectedMonthKey(next);
    const firstInMonth = buildMonthDayChips(next, slotsByDay).find((c) => c.hasSlots);
    if (firstInMonth) {
      const list = slotsByDay.get(firstInMonth.dayKey) ?? [];
      setSelectedDayChoice(firstInMonth.dayKey);
      setSelectedPeriod(firstPeriodWithSlots(list));
    } else {
      setSelectedDayChoice(null);
    }
  }

  function selectDay(dayKey: string) {
    const list = slotsByDay.get(dayKey);
    if (!list?.length) return;
    setSelectedDayChoice(dayKey);
    setSelectedPeriod(firstPeriodWithSlots(list));
  }

  useEffect(() => {
    if (!selectedDayKey || !dateStripRef.current) return;
    const el = dateStripRef.current.querySelector<HTMLElement>(
      `[data-day="${selectedDayKey}"]`
    );
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDayKey, monthKey]);

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl bg-background px-4 py-6 text-sm text-muted">
        No open slots yet. Generate from weekly hours above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!canGoPrev || busy}
          onClick={() => goMonth(-1)}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:border-primary disabled:opacity-40"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-foreground">{formatMonthYear(monthKey)}</p>
        <button
          type="button"
          disabled={!canGoNext || busy}
          onClick={() => goMonth(1)}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:border-primary disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <div
        ref={dateStripRef}
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((chip) => {
          const selected = chip.dayKey === selectedDayKey;
          return (
            <button
              key={chip.dayKey}
              type="button"
              data-day={chip.dayKey}
              disabled={!chip.hasSlots || busy}
              onClick={() => selectDay(chip.dayKey)}
              className={[
                'flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition',
                selected
                  ? 'border-primary bg-primary text-white'
                  : chip.hasSlots
                    ? 'border-border bg-background text-foreground hover:border-primary'
                    : 'cursor-not-allowed border-border bg-background/60 text-muted opacity-45',
              ].join(' ')}
            >
              <span className={`text-[11px] font-semibold ${selected ? 'text-white/90' : ''}`}>
                {chip.weekday}
              </span>
              <span className="text-base font-semibold">{chip.dayNumber}</span>
            </button>
          );
        })}
      </div>

      <div className="flex border-b border-border">
        {SLOT_PERIODS.map(({ id, label }) => {
          const active = period === id;
          const count = filterSlotsByPeriod(daySlots, id).length;
          return (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => setSelectedPeriod(id)}
              className="relative flex-1 px-1 py-2 text-center text-sm font-medium transition disabled:opacity-60"
            >
              <span
                className={[
                  active ? 'font-semibold text-primary' : 'text-muted',
                  count === 0 ? 'opacity-55' : '',
                ].join(' ')}
              >
                {label}
              </span>
              <span
                className={[
                  'absolute inset-x-[15%] bottom-0 h-0.5 rounded-full',
                  active ? 'bg-primary' : 'bg-transparent',
                ].join(' ')}
              />
            </button>
          );
        })}
      </div>

      {selectedDayKey == null ? (
        <p className="py-6 text-center text-sm text-muted">
          No open slots in this month. Try another month.
        </p>
      ) : periodSlots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No {period} slots
          {daySlots.length > 0 ? ' — try another time of day' : ' on this day'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {periodSlots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {formatSlotChipTime(slot.startsAt)}
                </p>
                <p className="truncate text-xs text-muted">
                  to {formatSlotChipTime(slot.endsAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeleteSlot(slot.id)}
                className="shrink-0 text-xs font-semibold text-danger hover:underline disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedDayKey && daySlots.length > 0 ? (
        <p className="text-xs text-muted">
          {daySlots.length} open slot{daySlots.length === 1 ? '' : 's'} on this day
          {periodSlots.length > 0 ? ` · ${periodSlots.length} in ${period}` : ''}
        </p>
      ) : null}
    </div>
  );
}
