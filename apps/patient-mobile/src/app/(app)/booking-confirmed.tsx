import { BOOKING_CANCEL_CUTOFF_HOURS } from '@teleconsult/shared-types';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BookingCancelButton } from '@/components/booking-cancel-button';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { fetchBookingById, type UpcomingBooking } from '@/lib/bookings';
import {
  formatSlotDayLabel,
  formatSlotShortDate,
  formatSlotTimeRange,
} from '@/lib/slot-display';

export default function BookingConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = typeof id === 'string' ? id : id?.[0];

  const [item, setItem] = useState<UpcomingBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) {
      setError('Booking not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const row = await fetchBookingById(bookingId);
      if (!row || row.booking.status !== 'confirmed') {
        setItem(null);
        setError(
          row?.booking.status === 'cancelled'
            ? 'This booking was cancelled.'
            : 'Booking not found.'
        );
        return;
      }
      setItem(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load confirmation.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : null}

      {error && !item ? (
        <EmptyState icon="calendar" title="No confirmation" description={error}>
          <Button title="Back to bookings" variant="secondary" onPress={() => router.replace('/(app)/book')} />
        </EmptyState>
      ) : null}

      {item ? (
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.checkBadge}>
              <Icon name="check" size={28} color={Colors.white} />
            </View>
            <AppText variant="eyebrow" style={styles.eyebrow}>
              BOOKING CONFIRMED
            </AppText>
            <AppText variant="h2" style={styles.title}>
              You're all set
            </AppText>
            <AppText variant="muted" style={styles.subtitle}>
              Your consultation is reserved. The doctor can see this booking on their schedule.
            </AppText>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop}>
              <DoctorAvatar
                name={item.doctor.fullName}
                photoUrl={item.doctor.photoUrl}
                size={64}
              />
              <View style={styles.cardCopy}>
                <AppText variant="h3" style={styles.doctorName}>
                  {item.doctor.fullName || 'Doctor'}
                </AppText>
                <View style={styles.confirmedPill}>
                  <AppText variant="label" style={styles.confirmedText}>
                    Confirmed
                  </AppText>
                </View>
              </View>
            </View>

            <View style={styles.metaBlock}>
              <View style={styles.metaRow}>
                <Icon name="calendar" size={18} color={Colors.primary900} />
                <View style={styles.metaText}>
                  <AppText variant="muted" style={styles.metaLabel}>
                    Date
                  </AppText>
                  <AppText variant="bodyMedium">
                    {formatSlotDayLabel(item.slot.startsAt)}
                  </AppText>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Icon name="clock" size={18} color={Colors.primary900} />
                <View style={styles.metaText}>
                  <AppText variant="muted" style={styles.metaLabel}>
                    Time
                  </AppText>
                  <AppText variant="bodyMedium">
                    {formatSlotTimeRange(item.slot.startsAt, item.slot.endsAt)}
                  </AppText>
                </View>
              </View>
            </View>

            <AppText variant="muted" style={styles.footnote}>
              Free online cancel until {BOOKING_CANCEL_CUTOFF_HOURS} hours before{' '}
              {formatSlotShortDate(item.slot.startsAt)}. After that, contact the hospital.
            </AppText>

            <BookingCancelButton
              bookingId={item.booking.id}
              slotStartsAt={item.slot.startsAt}
              cancelRequested={Boolean(item.booking.cancelRequestAt)}
              onDone={(result) => {
                if (result.outcome === 'cancelled') {
                  router.replace('/(app)/book');
                } else {
                  void load();
                }
              }}
            />
          </View>

          <Button
            title="Done"
            showArrow
            onPress={() => router.replace('/(app)/home')}
          />
          <Button
            title="View all bookings"
            variant="secondary"
            onPress={() => router.replace('/(app)/book' as Href)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  content: {
    gap: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  checkBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    color: Colors.primary900,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardCopy: {
    flex: 1,
    gap: Spacing.sm,
  },
  doctorName: {
    color: Colors.text,
  },
  confirmedPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary50,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  confirmedText: {
    color: Colors.primary700,
    fontSize: 11,
  },
  metaBlock: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  metaText: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    fontSize: 12,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
  },
});
