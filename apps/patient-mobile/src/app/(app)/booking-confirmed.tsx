import {
  BOOKING_CANCEL_CUTOFF_HOURS,
  BOOKING_PAYMENT_HOLD_MINUTES,
  formatInrFromPaise,
} from '@teleconsult/shared-types';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { BookingCancelButton } from '@/components/booking-cancel-button';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { fetchBookingById, type UpcomingBooking } from '@/lib/bookings';
import { consultationModeLabel } from '@/lib/consultation-mode';
import { completeBookingPayment } from '@/lib/payments';
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
  const [paying, setPaying] = useState(false);
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
      const status = row?.booking.status;
      if (
        !row ||
        (status !== 'confirmed' &&
          status !== 'pending_payment' &&
          status !== 'pending_admin' &&
          status !== 'rejected')
      ) {
        setItem(null);
        setError(
          status === 'cancelled'
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
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const pendingAdmin = item?.booking.status === 'pending_admin';
  const rejected = item?.booking.status === 'rejected';
  const pendingPayment = item?.booking.status === 'pending_payment';
  const clinicPayUnpaid =
    item?.booking.status === 'confirmed' &&
    item.booking.paymentMethod === 'clinic' &&
    item.booking.paymentStatus === 'unpaid';
  const clinicPayPaid =
    item?.booking.paymentMethod === 'clinic' &&
    item.booking.paymentStatus === 'paid';
  const willRefund =
    item?.booking.status === 'confirmed' && item.booking.paymentStatus === 'paid';
  const feeLabel =
    item?.booking.amountPaise != null
      ? formatInrFromPaise(item.booking.amountPaise)
      : item
        ? formatInrFromPaise(item.doctor.consultationFeePaise)
        : null;
  const whenStartsAt =
    item?.slot?.startsAt ?? item?.booking.preferredStartsAt ?? null;
  const whenEndsAt = item?.slot?.endsAt ?? item?.booking.preferredEndsAt ?? null;

  const onPay = useCallback(async () => {
    if (!bookingId || paying) return;
    setPaying(true);
    try {
      const outcome = await completeBookingPayment(bookingId);
      if (outcome.status === 'paid') {
        await load();
        Alert.alert('Payment successful', 'Your consultation is confirmed.');
        return;
      }
      if (outcome.status === 'cancelled') {
        Alert.alert('Payment cancelled', 'Your slot is still held. You can try again anytime.');
        return;
      }
      // dismissed browser — hold remains
    } catch (err) {
      Alert.alert(
        'Payment failed',
        err instanceof Error ? err.message : 'Could not complete payment.'
      );
      void load();
    } finally {
      setPaying(false);
    }
  }, [bookingId, load, paying]);

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
            <View
              style={[
                styles.checkBadge,
                (pendingPayment || clinicPayUnpaid || pendingAdmin || rejected) &&
                  styles.checkBadgePending,
              ]}>
              <Icon
                name={
                  rejected
                    ? 'hospital'
                    : pendingPayment || clinicPayUnpaid || pendingAdmin
                      ? 'lock'
                      : 'check'
                }
                size={28}
                color={Colors.white}
              />
            </View>
            <AppText variant="eyebrow" style={styles.eyebrow}>
              {rejected
                ? 'REQUEST DECLINED'
                : pendingAdmin
                  ? 'AWAITING HOSPITAL'
                  : pendingPayment
                    ? 'PAYMENT REQUIRED'
                    : clinicPayUnpaid
                      ? 'PAY AT CLINIC'
                      : 'BOOKING CONFIRMED'}
            </AppText>
            <AppText variant="h2" style={styles.title}>
              {rejected
                ? 'Could not schedule'
                : pendingAdmin
                  ? 'Request submitted'
                  : pendingPayment
                    ? 'Slot reserved'
                    : clinicPayUnpaid
                      ? 'Visit confirmed'
                      : "You're all set"}
            </AppText>
            <AppText variant="muted" style={styles.subtitle}>
              {rejected
                ? item.booking.rejectReason ||
                  'The hospital could not assign an offline appointment. Please try another doctor or time.'
                : pendingAdmin
                  ? 'The hospital will review your preferred window and confirm a time. You will see the update here once assigned.'
                  : pendingPayment
                    ? `Complete payment within ${BOOKING_PAYMENT_HOLD_MINUTES} minutes to confirm your consultation. You can cancel anytime to release the slot.`
                    : clinicPayUnpaid
                      ? 'Your in-clinic appointment is confirmed. Please pay at the hospital when you arrive — the front desk will mark it paid.'
                      : clinicPayPaid
                        ? "Payment received at the clinic. Your consultation is on the doctor's schedule."
                        : 'Your consultation is reserved. The doctor can see this booking on their schedule.'}
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
                <View
                  style={[
                    styles.confirmedPill,
                    (pendingPayment || clinicPayUnpaid || pendingAdmin || rejected) &&
                      styles.pendingPill,
                  ]}>
                  <AppText
                    variant="label"
                    style={[
                      styles.confirmedText,
                      (pendingPayment || clinicPayUnpaid || pendingAdmin || rejected) &&
                        styles.pendingText,
                    ]}>
                    {rejected
                      ? 'Declined'
                      : pendingAdmin
                        ? 'Awaiting hospital'
                        : pendingPayment
                          ? 'Awaiting payment'
                          : clinicPayUnpaid
                            ? 'Pay at clinic'
                            : clinicPayPaid
                              ? 'Paid at clinic'
                              : 'Confirmed'}
                  </AppText>
                </View>
              </View>
            </View>

            <View style={styles.metaBlock}>
              <View style={styles.metaRow}>
                <Icon
                  name={item.booking.mode === 'offline' ? 'hospital' : 'video'}
                  size={18}
                  color={Colors.primary900}
                />
                <View style={styles.metaText}>
                  <AppText variant="muted" style={styles.metaLabel}>
                    Type
                  </AppText>
                  <AppText variant="bodyMedium">
                    {consultationModeLabel(item.booking.mode)}
                    {item.booking.mode === 'offline' ? ' · In-clinic' : ' · Chat'}
                  </AppText>
                </View>
              </View>
              {whenStartsAt ? (
                <View style={styles.metaRow}>
                  <Icon name="calendar" size={18} color={Colors.primary900} />
                  <View style={styles.metaText}>
                    <AppText variant="muted" style={styles.metaLabel}>
                      {pendingAdmin || (!item.slot && rejected) ? 'Preferred date' : 'Date'}
                    </AppText>
                    <AppText variant="bodyMedium">
                      {formatSlotDayLabel(whenStartsAt)}
                    </AppText>
                  </View>
                </View>
              ) : null}
              {whenStartsAt && whenEndsAt ? (
                <View style={styles.metaRow}>
                  <Icon name="clock" size={18} color={Colors.primary900} />
                  <View style={styles.metaText}>
                    <AppText variant="muted" style={styles.metaLabel}>
                      {pendingAdmin || (!item.slot && rejected) ? 'Preferred window' : 'Time'}
                    </AppText>
                    <AppText variant="bodyMedium">
                      {formatSlotTimeRange(whenStartsAt, whenEndsAt)}
                    </AppText>
                  </View>
                </View>
              ) : null}
              {item.booking.preferredNote && (pendingAdmin || rejected) ? (
                <View style={styles.metaRow}>
                  <Icon name="notes" size={18} color={Colors.primary900} />
                  <View style={styles.metaText}>
                    <AppText variant="muted" style={styles.metaLabel}>
                      Note
                    </AppText>
                    <AppText variant="bodyMedium">{item.booking.preferredNote}</AppText>
                  </View>
                </View>
              ) : null}
              {feeLabel ? (
                <View style={styles.metaRow}>
                  <Icon name="lock" size={18} color={Colors.primary900} />
                  <View style={styles.metaText}>
                    <AppText variant="muted" style={styles.metaLabel}>
                      Amount
                    </AppText>
                    <AppText variant="bodyMedium">{feeLabel}</AppText>
                  </View>
                </View>
              ) : null}
            </View>

            {pendingAdmin ? (
              <AppText variant="muted" style={styles.footnote}>
                No slot is reserved yet. If the hospital cannot place you, this request will be
                declined with a reason.
              </AppText>
            ) : rejected ? (
              <AppText variant="muted" style={styles.footnote}>
                You can submit a new request from the doctor’s offline booking page when no slots
                are open.
              </AppText>
            ) : pendingPayment ? (
              <AppText variant="muted" style={styles.footnote}>
                Cancel anytime before paying to free the slot. Holds expire after{' '}
                {BOOKING_PAYMENT_HOLD_MINUTES} minutes if unpaid.
              </AppText>
            ) : clinicPayUnpaid && whenStartsAt ? (
              <AppText variant="muted" style={styles.footnote}>
                No online payment needed. Bring {feeLabel ?? 'the consultation fee'} when you
                visit. Free cancel until {BOOKING_CANCEL_CUTOFF_HOURS} hours before{' '}
                {formatSlotShortDate(whenStartsAt)}.
              </AppText>
            ) : whenStartsAt ? (
              <AppText variant="muted" style={styles.footnote}>
                Free online cancel
                {willRefund ? ' (with refund)' : ''} until {BOOKING_CANCEL_CUTOFF_HOURS} hours
                before {formatSlotShortDate(whenStartsAt)}. After that, contact the hospital — no
                automatic refund.
              </AppText>
            ) : null}

            {pendingPayment ? (
              <Button
                title={feeLabel ? `Pay ${feeLabel}` : 'Complete payment'}
                showArrow
                loading={paying}
                onPress={() => void onPay()}
              />
            ) : null}

            {item.slot && !pendingAdmin && !rejected ? (
              <BookingCancelButton
                bookingId={item.booking.id}
                slotStartsAt={item.slot.startsAt}
                cancelRequested={Boolean(item.booking.cancelRequestAt)}
                willRefund={willRefund}
                pendingPayment={pendingPayment}
                onDone={(result) => {
                  if (result.outcome === 'cancelled') {
                    router.replace('/(app)/book');
                  } else {
                    void load();
                  }
                }}
              />
            ) : null}
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
  checkBadgePending: {
    backgroundColor: Colors.primary700,
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
  pendingPill: {
    backgroundColor: Colors.primary50,
  },
  confirmedText: {
    color: Colors.primary700,
    fontSize: 11,
  },
  pendingText: {
    color: Colors.primary900,
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
