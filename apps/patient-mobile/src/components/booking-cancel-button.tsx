import {
  BOOKING_CANCEL_CUTOFF_HOURS,
  canCancelBookingOnline,
  type CancelBookingResult,
} from '@teleconsult/shared-types';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CLINIC } from '@/constants/clinic';
import { Colors, Spacing } from '@/constants/theme';
import { cancelAppointmentBooking } from '@/lib/bookings';

type Props = {
  bookingId: string;
  slotStartsAt: string;
  /** True when a late cancel request was already flagged. */
  cancelRequested?: boolean;
  onDone?: (result: CancelBookingResult) => void;
};

export function BookingCancelButton({
  bookingId,
  slotStartsAt,
  cancelRequested = false,
  onDone,
}: Props) {
  const [busy, setBusy] = useState(false);
  const onlineOk = canCancelBookingOnline(slotStartsAt);

  async function runCancel() {
    setBusy(true);
    try {
      const result = await cancelAppointmentBooking(bookingId);
      if (result.outcome === 'cancelled') {
        Alert.alert('Booking cancelled', result.message);
      } else {
        Alert.alert('Contact the hospital', `${result.message}\n\n${CLINIC.cancelContactMessage}`);
      }
      onDone?.(result);
    } catch (err) {
      Alert.alert(
        'Could not cancel',
        err instanceof Error ? err.message : 'Please try again or contact the hospital.'
      );
    } finally {
      setBusy(false);
    }
  }

  function onPress() {
    if (cancelRequested && !onlineOk) {
      Alert.alert(
        'Contact the hospital',
        `A cancellation request is already on file.\n\n${CLINIC.cancelContactMessage}`
      );
      return;
    }

    if (onlineOk) {
      Alert.alert(
        'Cancel booking?',
        `You can cancel free of charge until ${BOOKING_CANCEL_CUTOFF_HOURS} hours before the appointment. The slot will open for others.`,
        [
          { text: 'Keep', style: 'cancel' },
          { text: 'Cancel booking', style: 'destructive', onPress: () => void runCancel() },
        ]
      );
      return;
    }

    Alert.alert(
      'Contact the hospital',
      `Online cancel closes ${BOOKING_CANCEL_CUTOFF_HOURS} hours before the appointment.\n\n${CLINIC.cancelContactMessage}\n\nWe can flag this for the care team.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Flag for hospital', onPress: () => void runCancel() },
      ]
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy && styles.disabled]}>
      <AppText variant="bodyMedium" style={styles.label}>
        {busy
          ? 'Working…'
          : cancelRequested && !onlineOk
            ? 'Contact hospital'
            : onlineOk
              ? 'Cancel'
              : 'Cancel / contact'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  label: {
    color: Colors.accentRed,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
});
