import type { AppointmentSlot } from '@teleconsult/shared-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import {
  availableMonthKeys,
  buildMonthDayChips,
  dayKeyFromIso,
  filterSlotsByPeriod,
  firstPeriodWithSlots,
  formatMonthYear,
  formatSlotTimeLabel,
  monthKeyFromDate,
  monthKeyFromDayKey,
  shiftMonthKey,
  SLOT_PERIODS,
  type SlotPeriod,
} from '@/lib/slot-display';

/** How far ahead patients can browse beyond the current month. */
const MAX_MONTHS_AHEAD = 6;

type Props = {
  slots: AppointmentSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SlotPicker({
  slots,
  selectedSlotId,
  onSelectSlot,
  disabled = false,
  style,
}: Props) {
  const dateScrollRef = useRef<ScrollView>(null);
  const monthKeys = useMemo(() => availableMonthKeys(slots), [slots]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, AppointmentSlot[]>();
    for (const slot of slots) {
      const key = dayKeyFromIso(slot.startsAt);
      const list = map.get(key);
      if (list) list.push(slot);
      else map.set(key, [slot]);
    }
    return map;
  }, [slots]);

  const firstAvailableDay = useMemo(() => {
    const keys = Array.from(slotsByDay.keys()).sort();
    return keys[0] ?? null;
  }, [slotsByDay]);

  const [monthKey, setMonthKey] = useState(
    () => monthKeys[0] ?? monthKeyFromDayKey(firstAvailableDay ?? localTodayKey())
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(
    () => firstAvailableDay
  );
  const [period, setPeriod] = useState<SlotPeriod>('morning');
  const didAutoSelect = useRef(false);

  // First load: jump to the earliest day that has open slots.
  useEffect(() => {
    if (didAutoSelect.current || !firstAvailableDay) return;
    didAutoSelect.current = true;
    setSelectedDayKey(firstAvailableDay);
    setMonthKey(monthKeyFromDayKey(firstAvailableDay));
    setPeriod(firstPeriodWithSlots(slotsByDay.get(firstAvailableDay) ?? []));
  }, [firstAvailableDay, slotsByDay]);

  // Keep calendar aligned when a slot is selected, or recover after refresh.
  useEffect(() => {
    if (slots.length === 0) {
      setSelectedDayKey(null);
      return;
    }

    if (selectedSlotId) {
      const slot = slots.find((s) => s.id === selectedSlotId);
      if (slot) {
        const dayKey = dayKeyFromIso(slot.startsAt);
        setSelectedDayKey(dayKey);
        setMonthKey(monthKeyFromDayKey(dayKey));
        setPeriod(firstPeriodWithSlots([slot]));
      }
      return;
    }

    // selectedSlotId is null (user cleared / browsing) — don't force month back.
    setSelectedDayKey((prev) => {
      if (prev == null) return prev;
      if (slotsByDay.has(prev)) return prev;
      return firstAvailableDay;
    });
  }, [slots, selectedSlotId, slotsByDay, firstAvailableDay]);

  const daySlots = useMemo(
    () => (selectedDayKey ? (slotsByDay.get(selectedDayKey) ?? []) : []),
    [selectedDayKey, slotsByDay]
  );

  useEffect(() => {
    if (daySlots.length === 0) return;
    const stillInPeriod = daySlots.some((s) => {
      const p = filterSlotsByPeriod([s], period);
      return p.length > 0;
    });
    if (!stillInPeriod) {
      setPeriod(firstPeriodWithSlots(daySlots));
    }
  }, [daySlots, period]);

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
  // Always allow calendar browsing — not limited to months that already have slots.
  const canGoPrev = monthKey > todayMonthKey;
  const canGoNext = monthKey < maxMonthKey;

  function goMonth(delta: number) {
    const next = shiftMonthKey(monthKey, delta);
    if (next < todayMonthKey || next > maxMonthKey) return;

    setMonthKey(next);
    const firstInMonth = buildMonthDayChips(next, slotsByDay).find((c) => c.hasSlots);
    if (firstInMonth) {
      const dayList = slotsByDay.get(firstInMonth.dayKey) ?? [];
      setSelectedDayKey(firstInMonth.dayKey);
      setPeriod(firstPeriodWithSlots(dayList));
      if (
        selectedSlotId &&
        !dayList.some((slot) => slot.id === selectedSlotId)
      ) {
        onSelectSlot(null);
      }
      return;
    }

    // Empty month — keep browsing; clear day selection.
    setSelectedDayKey(null);
    if (selectedSlotId) onSelectSlot(null);
  }

  function selectDay(dayKey: string) {
    if (disabled) return;
    const dayList = slotsByDay.get(dayKey);
    if (!dayList?.length) return;
    setSelectedDayKey(dayKey);
    setPeriod(firstPeriodWithSlots(dayList));
    if (
      selectedSlotId &&
      !dayList.some((slot) => slot.id === selectedSlotId)
    ) {
      onSelectSlot(null);
    }
  }

  // Scroll selected day into view when month/day changes.
  useEffect(() => {
    if (!selectedDayKey) return;
    const index = chips.findIndex((c) => c.dayKey === selectedDayKey);
    if (index < 0) return;
    const timer = setTimeout(() => {
      dateScrollRef.current?.scrollTo({
        x: Math.max(0, index * 64 - 24),
        animated: true,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedDayKey, chips]);

  return (
    <View style={[styles.root, style]}>
      <AppText variant="h3" style={styles.heading}>
        Select date & time
      </AppText>

      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={!canGoPrev || disabled}
          onPress={() => goMonth(-1)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.monthArrow,
            (!canGoPrev || disabled) && styles.monthArrowDisabled,
            pressed && canGoPrev && styles.pressed,
          ]}>
          <Icon
            name="chevronLeft"
            size={20}
            color={canGoPrev ? Colors.text : Colors.gray300}
          />
        </Pressable>
        <AppText variant="bodyMedium" style={styles.monthLabel}>
          {formatMonthYear(monthKey)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoNext || disabled}
          onPress={() => goMonth(1)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.monthArrow,
            (!canGoNext || disabled) && styles.monthArrowDisabled,
            pressed && canGoNext && styles.pressed,
          ]}>
          <View style={styles.chevronRight}>
            <Icon
              name="chevronLeft"
              size={20}
              color={canGoNext ? Colors.text : Colors.gray300}
            />
          </View>
        </Pressable>
      </View>

      <ScrollView
        ref={dateScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}>
        {chips.map((chip) => {
          const selected = chip.dayKey === selectedDayKey;
          const unavailable = !chip.hasSlots;
          return (
            <Pressable
              key={chip.dayKey}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: unavailable }}
              disabled={unavailable || disabled}
              onPress={() => selectDay(chip.dayKey)}
              style={({ pressed }) => [
                styles.dayChip,
                selected && styles.dayChipSelected,
                unavailable && styles.dayChipUnavailable,
                pressed && !unavailable && styles.pressed,
              ]}>
              <AppText
                variant="label"
                style={[
                  styles.dayWeekday,
                  selected && styles.dayTextSelected,
                  unavailable && styles.dayTextUnavailable,
                ]}>
                {chip.weekday}
              </AppText>
              <AppText
                variant="bodyMedium"
                style={[
                  styles.dayNumber,
                  selected && styles.dayTextSelected,
                  unavailable && styles.dayTextUnavailable,
                ]}>
                {chip.dayNumber}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.periodTabs}>
        {SLOT_PERIODS.map(({ id, label }) => {
          const active = period === id;
          const count = filterSlotsByPeriod(daySlots, id).length;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              disabled={disabled}
              onPress={() => setPeriod(id)}
              style={styles.periodTab}>
              <AppText
                variant="bodyMedium"
                style={[
                  styles.periodLabel,
                  active && styles.periodLabelActive,
                  count === 0 && styles.periodLabelEmpty,
                ]}>
                {label}
              </AppText>
              <View
                style={[styles.periodUnderline, active && styles.periodUnderlineActive]}
              />
            </Pressable>
          );
        })}
      </View>

      {periodSlots.length === 0 ? (
        <View style={styles.emptyPeriod}>
          <AppText variant="muted" style={styles.emptyPeriodText}>
            No {period} slots
            {daySlots.length > 0 ? ' — try another time of day' : ' on this day'}
          </AppText>
        </View>
      ) : (
        <View style={styles.timeGrid}>
          {periodSlots.map((slot) => {
            const selected = slot.id === selectedSlotId;
            return (
              <Pressable
                key={slot.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={disabled}
                onPress={() => onSelectSlot(slot.id)}
                style={({ pressed }) => [
                  styles.timeChip,
                  selected && styles.timeChipSelected,
                  pressed && styles.pressed,
                ]}>
                <AppText
                  variant="bodyMedium"
                  style={[styles.timeLabel, selected && styles.timeLabelSelected]}>
                  {formatSlotTimeLabel(slot.startsAt)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function localTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.md,
  },
  heading: {
    color: Colors.text,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthArrowDisabled: {
    opacity: 0.5,
  },
  chevronRight: {
    transform: [{ scaleX: -1 }],
  },
  monthLabel: {
    color: Colors.text,
    fontFamily: FontFamily.label,
  },
  dateStrip: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dayChip: {
    width: 56,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.chip,
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChipSelected: {
    backgroundColor: Colors.primary900,
    borderColor: Colors.primary900,
  },
  dayChipUnavailable: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray200,
  },
  dayWeekday: {
    fontSize: 11,
    color: Colors.gray500,
    textTransform: 'capitalize',
  },
  dayNumber: {
    color: Colors.text,
    fontSize: 16,
  },
  dayTextSelected: {
    color: Colors.white,
  },
  dayTextUnavailable: {
    color: Colors.gray300,
  },
  periodTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  periodTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  periodLabel: {
    fontSize: 13,
    color: Colors.gray500,
  },
  periodLabelActive: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
  periodLabelEmpty: {
    opacity: 0.55,
  },
  periodUnderline: {
    marginTop: Spacing.sm,
    height: 2,
    width: '70%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  periodUnderlineActive: {
    backgroundColor: Colors.primary900,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  timeChip: {
    width: '31.5%',
    minWidth: 96,
    flexGrow: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timeChipSelected: {
    borderColor: Colors.primary900,
    backgroundColor: Colors.primary50,
  },
  timeLabel: {
    color: Colors.text,
    fontSize: 14,
  },
  timeLabelSelected: {
    color: Colors.primary700,
    fontFamily: FontFamily.label,
  },
  emptyPeriod: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyPeriodText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
