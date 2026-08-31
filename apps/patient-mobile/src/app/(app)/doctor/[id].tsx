import {
  BOOKING_PAYMENT_HOLD_MINUTES,
  formatInrFromPaise,
  type AppointmentSlot,
  type BookingPaymentMethod,
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
import { DateField } from '@/components/ui/date-field';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { SlotPicker } from '@/components/ui/slot-picker';
import { TextField } from '@/components/ui/text-field';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  bookAppointmentSlot,
  requestOfflineOverflowBooking,
} from '@/lib/bookings';
import {
  consultationModeLabel,
  parseConsultationMode,
} from '@/lib/consultation-mode';
import { fetchDoctorById, fetchOpenSlotsForDoctor } from '@/lib/doctors';
import {
  formatBookingSummaryDate,
  formatSlotDayLabel,
  formatSlotTimeLabel,
  formatSlotTimeRange,
} from '@/lib/slot-display';

const PREFERRED_WINDOWS = [
  { id: 'morning', label: 'Morning', startHour: 9, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 17 },
  { id: 'evening', label: 'Evening', startHour: 17, endHour: 20 },
] as const;

type PreferredWindowId = (typeof PREFERRED_WINDOWS)[number]['id'];

function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function preferredWindowIso(
  dateYmd: string,
  windowId: PreferredWindowId
): { startsAt: string; endsAt: string } | null {
  const window = PREFERRED_WINDOWS.find((w) => w.id === windowId);
  if (!window || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const [y, m, d] = dateYmd.split('-').map(Number);
  const starts = new Date(y, m - 1, d, window.startHour, 0, 0);
  const ends = new Date(y, m - 1, d, window.endHour, 0, 0);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return null;
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

export default function DoctorDetailScreen() {
  const { id, mode: modeParam } = useLocalSearchParams<{
    id: string;
    mode?: string | string[];
  }>();
  const doctorId = typeof id === 'string' ? id : id?.[0];
  const mode = parseConsultationMode(modeParam);
  const modeLabel = consultationModeLabel(mode);
  const modeLower = modeLabel.toLowerCase();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState(tomorrowYmd);
  const [preferredWindow, setPreferredWindow] =
    useState<PreferredWindowId>('morning');
  const [preferredNote, setPreferredNote] = useState('');
  const [preferredDateBounds] = useState(() => {
    const minimum = new Date();
    const maximum = new Date(minimum);
    maximum.setDate(maximum.getDate() + 60);
    return { minimum, maximum };
  });

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
        fetchOpenSlotsForDoctor(doctorId, { mode }),
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
  }, [doctorId, mode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId]
  );

  async function confirmBooking(paymentMethod: BookingPaymentMethod) {
    if (!selectedSlot || !doctor) return;

    setBooking(true);
    setError(null);
    try {
      const booked = await bookAppointmentSlot(selectedSlot.id, {
        mode,
        paymentMethod,
      });
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

  async function submitOverflowRequest(paymentMethod: BookingPaymentMethod) {
    if (!doctor || mode !== 'offline') return;

    const window = preferredWindowIso(preferredDate, preferredWindow);
    if (!window) {
      setError('Choose a valid preferred date and time window.');
      return;
    }
    if (new Date(window.startsAt).getTime() <= Date.now()) {
      setError('Preferred window must be in the future.');
      return;
    }

    setBooking(true);
    setError(null);
    try {
      const requested = await requestOfflineOverflowBooking({
        doctorId: doctor.id,
        preferredStartsAt: window.startsAt,
        preferredEndsAt: window.endsAt,
        preferredNote: preferredNote.trim() || null,
        paymentMethod,
      });
      router.replace(`/(app)/booking-confirmed?id=${requested.id}` as Href);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not submit request.';
      setError(message);
      await load();
    } finally {
      setBooking(false);
    }
  }

  function onOverflowPayPress() {
    if (!doctor) return;
    const fee = formatInrFromPaise(doctor.consultationFeePaise);
    Alert.alert(
      'How would you like to pay?',
      `Request an offline visit with ${doctor.fullName || 'this doctor'} for ${fee}. The hospital will assign a time if capacity opens.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay at clinic',
          onPress: () => void submitOverflowRequest('clinic'),
        },
        {
          text: 'Pay online',
          onPress: () => void submitOverflowRequest('online'),
        },
      ]
    );
  }

  function onBookPress() {
    if (!selectedSlot || !doctor) return;

    const when = `${formatSlotDayLabel(selectedSlot.startsAt)} at ${formatSlotTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)}`;
    const fee = formatInrFromPaise(doctor.consultationFeePaise);
    const name = doctor.fullName || 'this doctor';

    if (mode === 'offline') {
      Alert.alert(
        'How would you like to pay?',
        `Reserve ${name} on ${when} for ${fee}.\n\nPay online now, or pay at the clinic on the day of your visit.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Pay at clinic',
            onPress: () => void confirmBooking('clinic'),
          },
          {
            text: 'Pay online',
            onPress: () => void confirmBooking('online'),
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Reserve ${modeLower} slot`,
      `Hold ${name} (${modeLabel}) on ${when} for ${fee}?\n\nYour slot is reserved for ${BOOKING_PAYMENT_HOLD_MINUTES} minutes while you complete payment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reserve', onPress: () => void confirmBooking('online') },
      ]
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.navPad}>
        <ScreenNav title={`${modeLabel} · Doctor`} />
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
                <AppText variant="muted" style={styles.specialty}>
                  {doctor.specialty}
                </AppText>
                <AppText variant="muted" style={styles.degrees}>
                  {doctor.degrees}
                </AppText>
                <AppText variant="muted">
                  {formatInrFromPaise(doctor.consultationFeePaise)} · {modeLabel} ·{' '}
                  {slots.length > 0
                    ? `${slots.length} open slot${slots.length === 1 ? '' : 's'} ahead`
                    : `No open ${modeLower} slots right now`}
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
              mode === 'offline' ? (
                <View style={styles.overflowCard}>
                  <AppText variant="h3" style={styles.overflowTitle}>
                    No open offline slots
                  </AppText>
                  <AppText variant="muted" style={styles.overflowCopy}>
                    Request a preferred window. The hospital will assign a time if
                    capacity opens, or decline with a reason.
                  </AppText>
                  <DateField
                    label="Preferred date"
                    value={preferredDate}
                    onChange={setPreferredDate}
                    minimumDate={preferredDateBounds.minimum}
                    maximumDate={preferredDateBounds.maximum}
                    placeholder="Select preferred date"
                  />
                  <View style={styles.windowBlock}>
                    <AppText variant="label" style={styles.windowLabel}>
                      Preferred window
                    </AppText>
                    <View style={styles.windowRow}>
                      {PREFERRED_WINDOWS.map((window) => {
                        const selected = preferredWindow === window.id;
                        return (
                          <Pressable
                            key={window.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => setPreferredWindow(window.id)}
                            disabled={booking}
                            style={({ pressed }) => [
                              styles.windowChip,
                              selected && styles.windowChipSelected,
                              pressed && styles.pressed,
                            ]}>
                            <AppText
                              variant="bodyMedium"
                              style={[
                                styles.windowChipText,
                                selected && styles.windowChipTextSelected,
                              ]}>
                              {window.label}
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <TextField
                    label="Note (optional)"
                    value={preferredNote}
                    onChangeText={setPreferredNote}
                    placeholder="Any timing constraints"
                    maxLength={500}
                    editable={!booking}
                  />
                </View>
              ) : (
                <EmptyState
                  icon="calendar"
                  title={`No open ${modeLower} slots`}
                  description={`This doctor has no open ${modeLower} times yet. Try the other consultation type or check back later.`}
                />
              )
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

              {mode === 'offline' && selectedSlot ? (
                <View style={styles.payChoices}>
                  <Button
                    title="Pay online"
                    showArrow
                    loading={booking}
                    disabled={booking}
                    onPress={() => void confirmBooking('online')}
                  />
                  <Button
                    title="Pay at clinic"
                    variant="secondary"
                    loading={booking}
                    disabled={booking}
                    onPress={() => void confirmBooking('clinic')}
                  />
                  <AppText variant="muted" style={styles.secureText}>
                    Online payment holds the slot {BOOKING_PAYMENT_HOLD_MINUTES}{' '}
                    min. Pay at clinic confirms immediately — pay when you visit.
                  </AppText>
                </View>
              ) : (
                <>
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
                </>
              )}
            </View>
          ) : mode === 'offline' ? (
            <View style={styles.footer}>
              <View style={styles.payChoices}>
                <Button
                  title="Request visit"
                  showArrow
                  loading={booking}
                  disabled={booking || !preferredDate}
                  onPress={onOverflowPayPress}
                />
                <AppText variant="muted" style={styles.secureText}>
                  No slot is held until the hospital confirms. Choose pay online or
                  pay at clinic when you submit.
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
  specialty: {
    fontSize: 14,
    lineHeight: 18,
    color: Colors.gray600,
  },
  degrees: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.gray500,
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
  overflowCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  overflowTitle: {
    color: Colors.text,
  },
  overflowCopy: {
    lineHeight: 20,
  },
  windowBlock: {
    gap: Spacing.sm,
  },
  windowLabel: {
    color: Colors.gray600,
  },
  windowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  windowChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  windowChipSelected: {
    borderColor: Colors.primary900,
    backgroundColor: Colors.primary50,
  },
  windowChipText: {
    color: Colors.text,
    fontSize: 14,
  },
  windowChipTextSelected: {
    color: Colors.primary900,
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
  payChoices: {
    gap: Spacing.sm,
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
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
});
