import type { AppointmentSlot, Doctor } from '@teleconsult/shared-types';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { bookAppointmentSlot } from '@/lib/bookings';
import { fetchDoctorById, fetchOpenSlotsForDoctor } from '@/lib/doctors';
import {
  formatSlotDayLabel,
  formatSlotTimeRange,
  groupSlotsByDay,
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

  const groups = useMemo(() => groupSlotsByDay(slots), [slots]);
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
      // Slot may have been taken — refresh open times
      await load();
    } finally {
      setBooking(false);
    }
  }

  function onBookPress() {
    if (!selectedSlot || !doctor) return;

    Alert.alert(
      'Confirm booking',
      `Book ${doctor.fullName || 'this doctor'} on ${formatSlotDayLabel(selectedSlot.startsAt)} at ${formatSlotTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Book', onPress: () => void confirmBooking() },
      ]
    );
  }

  return (
    <Screen>
      <ScreenNav title="Doctor" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : null}

      {error && !doctor ? (
        <EmptyState icon="stethoscope" title="Unavailable" description={error} />
      ) : null}

      {doctor ? (
        <>
          <View style={styles.profileCard}>
            <DoctorAvatar name={doctor.fullName} photoUrl={doctor.photoUrl} size={80} />
            <View style={styles.profileCopy}>
              <AppText variant="h3" style={styles.name}>
                {doctor.fullName || 'Doctor'}
              </AppText>
              <AppText variant="muted">
                {slots.length > 0
                  ? `${slots.length} open slot${slots.length === 1 ? '' : 's'} ahead`
                  : 'No open slots right now'}
              </AppText>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <AppText variant="h3">Pick a time</AppText>
            <Pressable onPress={() => void load()} hitSlop={8} disabled={booking}>
              <AppText variant="bodyMedium" style={styles.refresh}>
                Refresh
              </AppText>
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
            <View style={styles.groups}>
              {groups.map((group) => (
                <View key={group.dayKey} style={styles.dayBlock}>
                  <AppText variant="label" style={styles.dayLabel}>
                    {group.dayLabel}
                  </AppText>
                  <View style={styles.slotList}>
                    {group.slots.map((slot) => {
                      const selected = slot.id === selectedSlotId;
                      return (
                        <Pressable
                          key={slot.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          disabled={booking}
                          onPress={() => setSelectedSlotId(slot.id)}
                          style={({ pressed }) => [
                            styles.slotRow,
                            selected && styles.slotRowSelected,
                            pressed && styles.pressed,
                          ]}>
                          <View
                            style={[styles.slotIcon, selected && styles.slotIconSelected]}>
                            <Icon
                              name="clock"
                              size={16}
                              color={selected ? Colors.white : Colors.primary900}
                            />
                          </View>
                          <AppText
                            variant="bodyMedium"
                            style={[styles.slotTime, selected && styles.slotTimeSelected]}>
                            {formatSlotTimeRange(slot.startsAt, slot.endsAt)}
                          </AppText>
                          {selected ? (
                            <Icon name="check" size={18} color={Colors.primary900} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Button
                title={selectedSlot ? 'Confirm booking' : 'Select a time'}
                showArrow
                loading={booking}
                disabled={!selectedSlot || booking}
                onPress={onBookPress}
              />
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
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
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refresh: {
    color: Colors.primary900,
  },
  errorInline: {
    color: Colors.accentRed,
  },
  groups: {
    gap: Spacing.lg,
  },
  dayBlock: {
    gap: Spacing.sm,
  },
  dayLabel: {
    color: Colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
  },
  slotList: {
    gap: Spacing.sm,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotRowSelected: {
    borderColor: Colors.primary900,
    backgroundColor: Colors.primary50,
  },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotIconSelected: {
    backgroundColor: Colors.primary900,
  },
  slotTime: {
    flex: 1,
    color: Colors.text,
  },
  slotTimeSelected: {
    color: Colors.primary700,
  },
  pressed: {
    opacity: 0.92,
  },
});
