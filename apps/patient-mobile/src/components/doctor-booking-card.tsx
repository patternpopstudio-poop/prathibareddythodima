import { formatInrFromPaise, type ConsultationMode, type Doctor } from '@teleconsult/shared-types';
import { Pressable, StyleSheet, View } from 'react-native';

import { AvailabilityMiniCalendar } from '@/components/ui/availability-mini-calendar';
import { AppText } from '@/components/ui/app-text';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { Icon } from '@/components/ui/icon';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { consultationModeLabel } from '@/lib/consultation-mode';
import type { CalendarDayChip } from '@/lib/slot-display';

type DoctorBookingCardProps = {
  doctor: Doctor;
  mode: ConsultationMode;
  days: CalendarDayChip[];
  availabilityLoading?: boolean;
  onPress: () => void;
};

export function DoctorBookingCard({
  doctor,
  mode,
  days,
  availabilityLoading = false,
  onPress,
}: DoctorBookingCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${doctor.fullName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <DoctorAvatar name={doctor.fullName} photoUrl={doctor.photoUrl} size={64} />
        <View style={styles.body}>
          <AppText variant="bodyMedium" style={styles.name}>
            {doctor.fullName || 'Doctor'}
          </AppText>
          <AppText variant="muted" style={styles.specialty} numberOfLines={1}>
            {doctor.specialty}
          </AppText>
          <AppText variant="muted" style={styles.degrees} numberOfLines={1}>
            {doctor.degrees}
          </AppText>
          <AppText variant="muted" style={styles.meta}>
            {formatInrFromPaise(doctor.consultationFeePaise)} ·{' '}
            {consultationModeLabel(mode)}
          </AppText>
        </View>
        <Icon name="chevron" size={20} color={Colors.gray400} />
      </View>

      <View style={styles.calendarBlock}>
        <AppText variant="label" style={styles.calendarLabel}>
          Next 4 days
        </AppText>
        <AvailabilityMiniCalendar days={days} loading={availabilityLoading} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  specialty: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.gray600,
  },
  degrees: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.gray500,
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  calendarBlock: {
    gap: Spacing.sm,
  },
  calendarLabel: {
    fontSize: 11,
    color: Colors.gray500,
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.9,
  },
});
