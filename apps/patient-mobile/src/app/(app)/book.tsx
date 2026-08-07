import { formatInrFromPaise, type Doctor } from '@teleconsult/shared-types';
import { useFocusEffect } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BookingCancelButton } from '@/components/booking-cancel-button';
import { AppText } from '@/components/ui/app-text';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { fetchUpcomingBookings, type UpcomingBooking } from '@/lib/bookings';
import { fetchActiveDoctors } from '@/lib/doctors';
import { formatSlotShortDate, formatSlotTimeLabel } from '@/lib/slot-display';

export default function BookScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [doctorRows, bookingRows] = await Promise.all([
        fetchActiveDoctors(),
        fetchUpcomingBookings(10),
      ]);
      setDoctors(doctorRows);
      setUpcoming(bookingRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load booking data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load])
  );

  return (
    <Screen>
      <PageHeader
        eyebrow="FIND A DOCTOR"
        title="Book a consultation"
        description="Choose a doctor, pick a time, and reserve. Pay within 15 minutes to confirm — free cancel until 2 hours before the appointment."
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <AppText variant="muted" style={styles.errorText}>
            {error}
          </AppText>
          <Pressable onPress={() => void load('initial')} hitSlop={8}>
            <AppText variant="bodyMedium" style={styles.retry}>
              Try again
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {!loading && upcoming.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="h3">Your upcoming</AppText>
          {upcoming.map((item) => (
            <View key={item.booking.id} style={styles.bookingCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(`/(app)/booking-confirmed?id=${item.booking.id}` as Href)
                }
                style={({ pressed }) => [styles.bookingMain, pressed && styles.pressed]}>
                <DoctorAvatar
                  name={item.doctor.fullName}
                  photoUrl={item.doctor.photoUrl}
                  size={48}
                />
                <View style={styles.cardBody}>
                  <AppText variant="bodyMedium" style={styles.name}>
                    {item.doctor.fullName || 'Doctor'}
                  </AppText>
                  <AppText variant="muted" style={styles.meta}>
                    {formatSlotShortDate(item.slot.startsAt)} ·{' '}
                    {formatSlotTimeLabel(item.slot.startsAt)}
                  </AppText>
                  {item.booking.cancelRequestAt ? (
                    <AppText variant="muted" style={styles.requestNote}>
                      Cancel request sent — contact hospital
                    </AppText>
                  ) : item.booking.status === 'pending_payment' ? (
                    <AppText variant="muted" style={styles.pendingNote}>
                      Awaiting payment
                    </AppText>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.pill,
                    item.booking.status === 'pending_payment' && styles.pillPending,
                  ]}>
                  <AppText
                    variant="label"
                    style={[
                      styles.pillText,
                      item.booking.status === 'pending_payment' && styles.pillPendingText,
                    ]}>
                    {item.booking.status === 'pending_payment' ? 'Unpaid' : 'Confirmed'}
                  </AppText>
                </View>
              </Pressable>
              <View style={styles.cancelRow}>
                <BookingCancelButton
                  bookingId={item.booking.id}
                  slotStartsAt={item.slot.startsAt}
                  cancelRequested={Boolean(item.booking.cancelRequestAt)}
                  pendingPayment={item.booking.status === 'pending_payment'}
                  willRefund={
                    item.booking.status === 'confirmed' &&
                    item.booking.paymentStatus === 'paid'
                  }
                  onDone={() => void load('refresh')}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <AppText variant="h3">Doctors</AppText>
            <Pressable
              onPress={() => void load('refresh')}
              disabled={refreshing}
              hitSlop={8}>
              <AppText variant="bodyMedium" style={styles.refreshLabel}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </AppText>
            </Pressable>
          </View>

          {doctors.length === 0 ? (
            <EmptyState
              icon="stethoscope"
              title="No doctors available"
              description="Check back soon — doctors will appear here once they publish open slots."
            />
          ) : (
            doctors.map((doctor) => (
              <Pressable
                key={doctor.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${doctor.fullName}`}
                onPress={() => router.push(`/(app)/doctor/${doctor.id}` as Href)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <DoctorAvatar name={doctor.fullName} photoUrl={doctor.photoUrl} size={56} />
                <View style={styles.cardBody}>
                  <AppText variant="bodyMedium" style={styles.name}>
                    {doctor.fullName || 'Doctor'}
                  </AppText>
                  <AppText variant="muted" style={styles.meta}>
                    {formatInrFromPaise(doctor.consultationFeePaise)} · View open slots
                  </AppText>
                </View>
                <Icon name="chevron" size={20} color={Colors.gray400} />
              </Pressable>
            ))
          )}
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
  errorBox: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorText: {
    color: Colors.accentRed,
  },
  retry: {
    color: Colors.primary900,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshLabel: {
    color: Colors.primary900,
  },
  bookingCard: {
    backgroundColor: Colors.primary50,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.primary100,
    overflow: 'hidden',
  },
  bookingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  cancelRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.primary100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignItems: 'flex-start',
  },
  requestNote: {
    fontSize: 12,
    color: Colors.accentRed,
    marginTop: 2,
  },
  pendingNote: {
    fontSize: 12,
    color: Colors.primary700,
    marginTop: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: Colors.text,
  },
  meta: {
    fontSize: 13,
  },
  pill: {
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  pillPending: {
    backgroundColor: Colors.primary100,
  },
  pillText: {
    color: Colors.primary700,
    fontSize: 11,
  },
  pillPendingText: {
    color: Colors.primary900,
  },
  pressed: {
    opacity: 0.9,
  },
});
