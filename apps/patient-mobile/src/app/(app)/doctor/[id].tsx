import {
  BOOKING_PAYMENT_HOLD_MINUTES,
  formatInrFromPaise,
  type AppointmentSlot,
  type Doctor,
} from '@teleconsult/shared-types';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { SlotPicker } from '@/components/ui/slot-picker';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { bookAppointmentSlot } from '@/lib/bookings';
import { fetchDoctorById, fetchOpenSlotsForDoctor } from '@/lib/doctors';
import {
  formatBookingSummaryDate,
  formatSlotDayLabel,
  formatSlotTimeLabel,
  formatSlotTimeRange,
} from '@/lib/slot-display';

export default function DoctorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doctorId = typeof id === 'string' ? id : id?.[0];

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!doctorId) {
      setError('Doctor not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [doc, openSlots] = await Promise.all([
        fetchDoctorById(doctorId),
        fetchOpenSlotsForDoctor(doctorId),
      ]);
      if (!doc) {
        setDoctor(null);
        setSlots([]);
        setError('This doctor is not available.');
        return;
      }
      setDoctor(doc);
      setSlots(openSlots);
      setSelectedSlotId((prev) =>
        prev && openSlots.some((s) => s.id === prev) ? prev : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load doctor.');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId]
  );

  async function confirmBooking() {
    if (!selectedSlot || !doctor) return;

    setBooking(true);
    setError(null);
    try {
      const booked = await bookAppointmentSlot(selectedSlot.id);
      router.replace(`/(app)/booking-confirmed?id=${booked.id}` as Href);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not book this slot.';
      setError(message);
      await load();
    } finally {
      setBooking(false);
    }
  }

  function onBookPress() {
    if (!selectedSlot || !doctor) return;

    const when = `${formatSlotDayLabel(selectedSlot.startsAt)} at ${formatSlotTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)}`;
    const fee = formatInrFromPaise(doctor.consultationFeePaise);
    const name = doctor.fullName || 'this doctor';

    Alert.alert(
      'Reserve slot',
      `Hold ${name} on ${when} for ${fee}?\n\nYour slot is reserved for ${BOOKING_PAYMENT_HOLD_MINUTES} minutes while you complete payment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reserve', onPress: () => void confirmBooking() },
      ]
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.navPad}>
        <ScreenNav title="Doctor" />
      </View>

      {loading ? (
        <View style={[styles.centered, styles.padX]}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : null}

      {error && !doctor ? (
        <View style={styles.padX}>
          <EmptyState icon="stethoscope" title="Unavailable" description={error} />
        </View>
      ) : null}

      {doctor ? (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.profileCard}>
              <DoctorAvatar name={doctor.fullName} photoUrl={doctor.photoUrl} size={80} />
              <View style={styles.profileCopy}>
                <AppText variant="h3" style={styles.name}>
                  {doctor.fullName || 'Doctor'}
                </AppText>
                <AppText variant="muted">
                  {formatInrFromPaise(doctor.consultationFeePaise)} ·{' '}
                  {slots.length > 0
                    ? `${slots.length} open slot${slots.length === 1 ? '' : 's'} ahead`
                    : 'No open slots right now'}
                </AppText>
              </View>
              <Pressable
                onPress={() => void load()}
                hitSlop={8}
                disabled={booking}
                accessibilityRole="button"
                accessibilityLabel="Refresh slots"
                style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
                <Icon name="calendar" size={18} color={Colors.primary900} />
              </Pressable>
            </View>

            {error ? (
              <AppText variant="muted" style={styles.errorInline}>
                {error}
              </AppText>
            ) : null}

            {slots.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No open slots"
                description="This doctor has not published open times yet. Check back later or pick another doctor."
              />
            ) : (
              <SlotPicker
                slots={slots}
                selectedSlotId={selectedSlotId}
                onSelectSlot={setSelectedSlotId}
                disabled={booking}
              />
            )}
          </ScrollView>

          {slots.length > 0 ? (
            <View style={styles.footer}>
              {selectedSlot ? (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Icon name="calendar" size={16} color={Colors.primary900} />
                    <AppText variant="bodyMedium" style={styles.summaryText}>
                      {formatBookingSummaryDate(selectedSlot.startsAt)}
                      {' · '}
                      {formatSlotTimeLabel(selectedSlot.startsAt)}
                    </AppText>
                  </View>
                </View>
              ) : (
                <AppText variant="muted" style={styles.summaryHint}>
                  Select a date and time to continue
                </AppText>
              )}

              <Button
                title={selectedSlot ? 'Reserve & continue' : 'Select a time'}
                showArrow
                loading={booking}
                disabled={!selectedSlot || booking}
                onPress={onBookPress}
              />

              <View style={styles.secureRow}>
                <Icon name="lock" size={12} color={Colors.gray500} />
                <AppText variant="muted" style={styles.secureText}>
                  Slot held {BOOKING_PAYMENT_HOLD_MINUTES} min for payment.
                </AppText>
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  navPad: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  padX: {
    paddingHorizontal: Spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  centered: {
    flex: 1,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  profileCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  name: {
    color: Colors.text,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary50,
  },
  errorInline: {
    color: Colors.accentRed,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
  },
  summaryHint: {
    textAlign: 'center',
    fontSize: 13,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  secureText: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.92,
  },
});
