import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { localDayKey, type CalendarDayChip } from '@/lib/slot-display';

type AvailabilityMiniCalendarProps = {
  days: CalendarDayChip[];
  loading?: boolean;
};

/** Single-line 4-day availability strip for doctor list cards. */
export function AvailabilityMiniCalendar({
  days,
  loading = false,
}: AvailabilityMiniCalendarProps) {
  const todayKey = localDayKey(new Date());

  return (
    <View style={styles.row} accessibilityRole="text">
      {(loading ? PLACEHOLDER_DAYS : days).map((chip, index) => {
        const isToday = !loading && chip.dayKey === todayKey;
        const available = !loading && chip.hasSlots;
        return (
          <View
            key={loading ? `ph-${index}` : chip.dayKey}
            style={[
              styles.day,
              available && styles.dayAvailable,
              isToday && styles.dayToday,
              loading && styles.dayLoading,
            ]}>
            <AppText
              variant="label"
              style={[
                styles.weekday,
                available && styles.weekdayAvailable,
                !available && !loading && styles.weekdayMuted,
              ]}>
              {loading ? '·' : chip.weekday.slice(0, 3)}
            </AppText>
            <AppText
              variant="bodyMedium"
              style={[
                styles.dayNumber,
                available && styles.dayNumberAvailable,
                !available && !loading && styles.dayNumberMuted,
              ]}>
              {loading ? '—' : chip.dayNumber}
            </AppText>
            <View
              style={[
                styles.dot,
                available ? styles.dotOn : styles.dotOff,
                loading && styles.dotLoading,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const PLACEHOLDER_DAYS: CalendarDayChip[] = Array.from({ length: 4 }, (_, i) => ({
  dayKey: `ph-${i}`,
  weekday: '',
  dayNumber: '',
  hasSlots: false,
}));

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.chip,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayAvailable: {
    backgroundColor: Colors.primary50,
    borderColor: Colors.primary100,
  },
  dayToday: {
    borderColor: Colors.primary400,
  },
  dayLoading: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.border,
  },
  weekday: {
    fontSize: 10,
    letterSpacing: 0.2,
    color: Colors.gray500,
    textTransform: 'capitalize',
  },
  weekdayAvailable: {
    color: Colors.primary700,
  },
  weekdayMuted: {
    color: Colors.gray400,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 18,
    color: Colors.text,
  },
  dayNumberAvailable: {
    color: Colors.primary900,
  },
  dayNumberMuted: {
    color: Colors.gray400,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  dotOn: {
    backgroundColor: Colors.primary900,
  },
  dotOff: {
    backgroundColor: Colors.gray300,
  },
  dotLoading: {
    backgroundColor: Colors.gray200,
  },
});
