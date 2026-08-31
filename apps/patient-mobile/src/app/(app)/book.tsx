import { type ConsultationMode, type Doctor } from '@teleconsult/shared-types';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BookingCancelButton } from '@/components/booking-cancel-button';
import { DoctorBookingCard } from '@/components/doctor-booking-card';
import { AppText } from '@/components/ui/app-text';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type AppIconName } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchUpcomingBookings, type UpcomingBooking } from '@/lib/bookings';
import {
  consultationModeLabel,
  consultationModeSubtitle,
  parseConsultationMode,
} from '@/lib/consultation-mode';
import { fetchActiveDoctors, fetchOpenSlotsForDoctors } from '@/lib/doctors';
import {
  buildNextDayChips,
  formatSlotShortDate,
  formatSlotTimeLabel,
  slotsByDayMap,
  type CalendarDayChip,
} from '@/lib/slot-display';

const MODE_CHOICES: { mode: ConsultationMode; icon: AppIconName }[] = [
  { mode: 'online', icon: 'video' },
  { mode: 'offline', icon: 'hospital' },
];

const AVAILABILITY_PREVIEW_DAYS = 4;

function emptyAvailabilityChips(): CalendarDayChip[] {
  return buildNextDayChips(AVAILABILITY_PREVIEW_DAYS, new Map());
}

export default function BookScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const selectedMode = useMemo(() => {
    const raw = params.mode;
    if (raw == null) return null;
    return parseConsultationMode(raw);
  }, [params.mode]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBooking[]>([]);
  const [availabilityByDoctor, setAvailabilityByDoctor] = useState<
    Record<string, CalendarDayChip[]>
  >({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (loadMode: 'initial' | 'refresh' = 'initial') => {
    if (loadMode === 'refresh') setRefreshing(true);
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

  const loadAvailability = useCallback(
    async (mode: ConsultationMode, doctorRows: Doctor[]) => {
      if (doctorRows.length === 0) {
        setAvailabilityByDoctor({});
        setAvailabilityLoading(false);
        return;
      }

      setAvailabilityLoading(true);
      try {
        const slotsByDoctor = await fetchOpenSlotsForDoctors(
          doctorRows.map((d) => d.id),
          { mode, daysAhead: AVAILABILITY_PREVIEW_DAYS }
        );
        const next: Record<string, CalendarDayChip[]> = {};
        for (const doctor of doctorRows) {
          const slots = slotsByDoctor.get(doctor.id) ?? [];
          next[doctor.id] = buildNextDayChips(
            AVAILABILITY_PREVIEW_DAYS,
            slotsByDayMap(slots)
          );
        }
        setAvailabilityByDoctor(next);
      } catch {
        const fallback: Record<string, CalendarDayChip[]> = {};
        for (const doctor of doctorRows) {
          fallback[doctor.id] = emptyAvailabilityChips();
        }
        setAvailabilityByDoctor(fallback);
      } finally {
        setAvailabilityLoading(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load])
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedMode || doctors.length === 0) {
        setAvailabilityByDoctor({});
        setAvailabilityLoading(false);
        return;
      }
      void loadAvailability(selectedMode, doctors);
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedMode, doctors, loadAvailability]);

  function setMode(mode: ConsultationMode) {
    router.setParams({ mode });
  }

  function clearMode() {
    router.replace('/(app)/book');
  }

  const headerTitle = selectedMode
    ? `Book ${consultationModeLabel(selectedMode).toLowerCase()}`
    : 'Your bookings';
  const headerDescription = selectedMode
    ? selectedMode === 'online'
      ? 'Choose a doctor and reserve an online slot. Pay within 15 minutes to confirm — free cancel until 2 hours before.'
      : 'Choose a doctor and reserve an in-clinic slot. Pay online now, or pay at the clinic on the day of your visit.'
    : 'Review upcoming appointments, or pick online / offline to book a new consultation.';

  return (
    <Screen>
      <PageHeader
        eyebrow={selectedMode ? consultationModeLabel(selectedMode).toUpperCase() : 'BOOKINGS'}
        title={headerTitle}
        description={headerDescription}
      />

      {selectedMode ? (
        <Pressable onPress={clearMode} hitSlop={8} style={styles.modeSwitch}>
          <Icon name="chevronLeft" size={16} color={Colors.primary900} />
          <AppText variant="bodyMedium" style={styles.modeSwitchLabel}>
            Change consultation type
          </AppText>
        </Pressable>
      ) : null}

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
                    {item.slot
                      ? `${formatSlotShortDate(item.slot.startsAt)} · ${formatSlotTimeLabel(item.slot.startsAt)}`
                      : item.booking.preferredStartsAt
                        ? `${formatSlotShortDate(item.booking.preferredStartsAt)} · preferred window`
                        : 'Time to be assigned'}
                  </AppText>
                  {item.booking.cancelRequestAt ? (
                    <AppText variant="muted" style={styles.requestNote}>
                      Cancel request sent — contact hospital
                    </AppText>
                  ) : item.booking.status === 'pending_admin' ? (
                    <AppText variant="muted" style={styles.pendingNote}>
                      Awaiting hospital confirmation
                    </AppText>
                  ) : item.booking.status === 'pending_payment' ? (
                    <AppText variant="muted" style={styles.pendingNote}>
                      Awaiting online payment
                    </AppText>
                  ) : item.booking.paymentMethod === 'clinic' &&
                    item.booking.paymentStatus === 'unpaid' ? (
                    <AppText variant="muted" style={styles.pendingNote}>
                      Pay at clinic
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.pillCol}>
                  <View style={styles.modePill}>
                    <AppText variant="label" style={styles.modePillText}>
                      {consultationModeLabel(item.booking.mode)}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      (item.booking.status === 'pending_payment' ||
                        item.booking.status === 'pending_admin' ||
                        (item.booking.paymentMethod === 'clinic' &&
                          item.booking.paymentStatus === 'unpaid')) &&
                        styles.pillPending,
                    ]}>
                    <AppText
                      variant="label"
                      style={[
                        styles.pillText,
                        (item.booking.status === 'pending_payment' ||
                          item.booking.status === 'pending_admin' ||
                          (item.booking.paymentMethod === 'clinic' &&
                            item.booking.paymentStatus === 'unpaid')) &&
                          styles.pillPendingText,
                      ]}>
                      {item.booking.status === 'pending_admin'
                        ? 'Pending'
                        : item.booking.status === 'pending_payment'
                          ? 'Unpaid'
                          : item.booking.paymentMethod === 'clinic' &&
                              item.booking.paymentStatus === 'unpaid'
                            ? 'Pay at clinic'
                            : item.booking.paymentMethod === 'clinic' &&
                                item.booking.paymentStatus === 'paid'
                              ? 'Paid at clinic'
                              : 'Confirmed'}
                    </AppText>
                  </View>
                </View>
              </Pressable>
              {item.slot ? (
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
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !selectedMode ? (
        <View style={styles.section}>
          <AppText variant="h3">Book a consultation</AppText>
          <View style={styles.modeRow}>
            {MODE_CHOICES.map(({ mode, icon }) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={`Book ${consultationModeLabel(mode).toLowerCase()}`}
                onPress={() => setMode(mode)}
                style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}>
                <View style={styles.modeIconWrap}>
                  <Icon name={icon} size={22} color={Colors.primary900} />
                </View>
                <AppText variant="bodyMedium" style={styles.modeTitle}>
                  {consultationModeLabel(mode)}
                </AppText>
                <AppText variant="muted" style={styles.modeSub} numberOfLines={2}>
                  {consultationModeSubtitle(mode)}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!loading && selectedMode ? (
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
              <DoctorBookingCard
                key={doctor.id}
                doctor={doctor}
                mode={selectedMode}
                days={availabilityByDoctor[doctor.id] ?? emptyAvailabilityChips()}
                availabilityLoading={availabilityLoading}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/doctor/[id]',
                    params: { id: doctor.id, mode: selectedMode },
                  })
                }
              />
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
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: -Spacing.sm,
  },
  modeSwitchLabel: {
    color: Colors.primary900,
    fontSize: 14,
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
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.primary50,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.primary100,
    padding: Spacing.md,
    gap: Spacing.sm,
    minHeight: 140,
  },
  modeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    color: Colors.text,
    fontSize: 15,
  },
  modeSub: {
    fontSize: 12,
    lineHeight: 16,
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
  pillCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  modePill: {
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primary100,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  modePillText: {
    color: Colors.gray600,
    fontSize: 11,
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
