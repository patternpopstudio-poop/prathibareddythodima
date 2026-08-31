import type { AppNotification, ConsultationMode } from '@teleconsult/shared-types';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { Icon, type AppIconName } from '@/components/ui/icon';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { Screen } from '@/components/ui/screen';
import { EXPLORE_CARE, QUICK_ACTIONS } from '@/constants/clinic';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { fetchNextUpcomingBooking, type UpcomingBooking } from '@/lib/bookings';
import {
  consultationModeLabel,
  consultationModeSpecialtyLabel,
  consultationModeSubtitle,
} from '@/lib/consultation-mode';
import { fetchNotifications, markNotificationsRead } from '@/lib/notifications';
import { getFirstName } from '@/lib/patient-display';
import { formatSlotShortDate, formatSlotTimeLabel } from '@/lib/slot-display';

const BOOK_MODES: {
  mode: ConsultationMode;
  icon: AppIconName;
}[] = [
  { mode: 'online', icon: 'video' },
  { mode: 'offline', icon: 'hospital' },
];

function pushBook(mode: ConsultationMode) {
  router.push({ pathname: '/(app)/book', params: { mode } });
}

export default function HomeScreen() {
  const { patient } = useAuth();
  const firstName = getFirstName(patient?.fullName);
  const [upcoming, setUpcoming] = useState<UpcomingBooking | null>(null);
  const [apptLoading, setApptLoading] = useState(true);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setApptLoading(true);
      void fetchNextUpcomingBooking()
        .then((row) => {
          if (active) setUpcoming(row);
        })
        .catch(() => {
          if (active) setUpcoming(null);
        })
        .finally(() => {
          if (active) setApptLoading(false);
        });
      void fetchNotifications({ unreadOnly: true, limit: 3 })
        .then((rows) => {
          if (active) setAlerts(rows);
        })
        .catch(() => {
          if (active) setAlerts([]);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <AppText variant="eyebrow" style={styles.brand}>
          TELECONSULT
        </AppText>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            hitSlop={8}
            onPress={() => router.push('/(app)/notifications' as Href)}
            style={({ pressed }) => [styles.bellBtn, pressed && styles.pressed]}>
            <Icon name="mail" size={20} color={Colors.primary900} />
            {alerts.length > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
          <InitialsAvatar
            name={patient?.fullName}
            size={44}
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(app)/profile')}
          />
        </View>
      </View>

      <View style={styles.greeting}>
        <AppText variant="h2" style={styles.hello}>
          Hello, {firstName} 👋
        </AppText>
        <AppText variant="muted" style={styles.greetingSub}>
          How can we help with your health today?
        </AppText>
      </View>

      {alerts.length > 0 ? (
        <View style={styles.alertBlock}>
          {alerts.map((alert) => (
            <Pressable
              key={alert.id}
              accessibilityRole="button"
              onPress={() => {
                void markNotificationsRead([alert.id]).catch(() => undefined);
                setAlerts((prev) => prev.filter((n) => n.id !== alert.id));
                if (alert.entityType === 'bookings' && alert.entityId) {
                  router.push(
                    `/(app)/booking-confirmed?id=${alert.entityId}` as Href
                  );
                  return;
                }
                router.push('/(app)/notifications' as Href);
              }}
              style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}>
              <View style={styles.alertCopy}>
                <AppText variant="bodyMedium" style={styles.alertTitle}>
                  {alert.title}
                </AppText>
                <AppText variant="muted" style={styles.alertBody} numberOfLines={2}>
                  {alert.body}
                </AppText>
              </View>
              <Icon name="chevron" size={18} color={Colors.gray400} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.bookSection}>
        <View style={styles.bookSectionHead}>
          <AppText variant="label" style={styles.startBadgeText}>
            START HERE
          </AppText>
          <AppText variant="h3" style={styles.bookTitle}>
            Book a consultation
          </AppText>
          <AppText variant="muted" style={styles.bookSub}>
            Choose online chat or an in-clinic visit.
          </AppText>
        </View>
        <View style={styles.modeRow}>
          {BOOK_MODES.map(({ mode, icon }) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={`Book ${consultationModeLabel(mode).toLowerCase()} consultation`}
              onPress={() => pushBook(mode)}
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
              <View style={styles.modeCta}>
                <AppText variant="label" style={styles.modeCtaText}>
                  Book
                </AppText>
                <Icon name="chevron" size={14} color={Colors.primary900} />
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sectionHead}>
        <AppText variant="h3" style={styles.sectionTitle}>
          Upcoming appointment
        </AppText>
        <Pressable onPress={() => router.push('/(app)/book')} hitSlop={8}>
          <AppText variant="bodyMedium" style={styles.viewAll}>
            View all
          </AppText>
        </Pressable>
      </View>

      {apptLoading ? (
        <View style={styles.apptLoading}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : upcoming ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            upcoming.booking.mode === 'online' && upcoming.consultationId
              ? 'Open consultation chat'
              : 'Open appointment details'
          }
          onPress={() => {
            const goChat =
              upcoming.booking.mode === 'online' &&
              upcoming.booking.status === 'confirmed' &&
              upcoming.consultationId;
            if (goChat) {
              router.push(`/(app)/consultation/${upcoming.consultationId}` as Href);
              return;
            }
            router.push(`/(app)/booking-confirmed?id=${upcoming.booking.id}` as Href);
          }}
          style={({ pressed }) => [styles.apptCard, pressed && styles.pressed]}>
          <DoctorAvatar
            name={upcoming.doctor.fullName}
            photoUrl={upcoming.doctor.photoUrl}
            size={56}
          />
          <View style={styles.apptBody}>
            <View style={styles.apptTop}>
              <View style={styles.apptCopy}>
                <AppText variant="bodyMedium" style={styles.apptName}>
                  {upcoming.doctor.fullName || 'Doctor'}
                </AppText>
                <AppText variant="muted" style={styles.apptSpecialty}>
                  {consultationModeSpecialtyLabel(upcoming.booking.mode)}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View appointment details"
                hitSlop={8}
                onPress={() =>
                  router.push(`/(app)/booking-confirmed?id=${upcoming.booking.id}` as Href)
                }
                style={({ pressed }) => [styles.detailsBtn, pressed && styles.pressed]}>
                <Icon name="notes" size={20} color={Colors.primary900} />
              </Pressable>
            </View>

            <View style={styles.apptMetaRow}>
              <View style={styles.apptMetaItem}>
                <Icon name="calendar" size={14} color={Colors.gray500} />
                <AppText variant="muted" style={styles.apptMetaText}>
                  {upcoming.slot
                    ? formatSlotShortDate(upcoming.slot.startsAt)
                    : upcoming.booking.preferredStartsAt
                      ? formatSlotShortDate(upcoming.booking.preferredStartsAt)
                      : 'Awaiting time'}
                </AppText>
              </View>
              <View style={styles.apptMetaItem}>
                <Icon name="clock" size={14} color={Colors.gray500} />
                <AppText variant="muted" style={styles.apptMetaText}>
                  {upcoming.slot
                    ? formatSlotTimeLabel(upcoming.slot.startsAt)
                    : upcoming.booking.status === 'pending_admin'
                      ? 'Awaiting hospital'
                      : 'Time TBD'}
                </AppText>
              </View>
            </View>

            <View style={styles.apptPills}>
              <View style={styles.modePill}>
                <AppText variant="label" style={styles.modePillText}>
                  {consultationModeLabel(upcoming.booking.mode)}
                </AppText>
              </View>
              <View style={styles.confirmedPill}>
                <AppText variant="label" style={styles.confirmedText}>
                  Confirmed
                </AppText>
              </View>
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => pushBook('online')}
          style={({ pressed }) => [styles.apptEmpty, pressed && styles.pressed]}>
          <View style={styles.apptEmptyIcon}>
            <Icon name="calendar" size={22} color={Colors.primary900} />
          </View>
          <View style={styles.apptEmptyCopy}>
            <AppText variant="bodyMedium">No upcoming appointments</AppText>
            <AppText variant="muted" style={styles.apptSpecialty}>
              Pick online or offline above to get started.
            </AppText>
          </View>
          <Icon name="chevron" size={18} color={Colors.gray400} />
        </Pressable>
      )}

      <View style={styles.sectionBlock}>
        <AppText variant="h3" style={styles.sectionTitle}>
          Quick access
        </AppText>
        <AppText variant="muted" style={styles.sectionSub}>
          Your health tools in one place.
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRow}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            onPress={() => router.push(action.href as Href)}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
            <Image
              source={action.image}
              style={styles.quickImage}
              contentFit="contain"
              transition={0}
            />
            <AppText variant="bodyMedium" style={styles.quickTitle}>
              {action.title}
            </AppText>
            <AppText variant="muted" style={styles.quickSub} numberOfLines={2}>
              {action.subtitle}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.exploreHeader}>
        <View style={styles.sectionHead}>
          <AppText variant="h3" style={styles.sectionTitle}>
            Explore care
          </AppText>
          <Pressable onPress={() => router.push('/(app)/book')} hitSlop={8}>
            <AppText variant="bodyMedium" style={styles.viewAll}>
              View all
            </AppText>
          </Pressable>
        </View>
        <AppText variant="muted" style={styles.sectionSub}>
          Find the right care for you.
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.exploreRow}>
        {EXPLORE_CARE.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/(app)/book', params: { service: item.id } })
            }
            style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}>
            <View style={styles.exploreImageWrap}>
              <Image source={item.image} style={styles.exploreImage} contentFit="contain" />
            </View>
            <View style={styles.exploreBody}>
              <AppText variant="bodyMedium" style={styles.exploreTitle}>
                {item.title}
              </AppText>
              <AppText variant="muted" style={styles.exploreSub} numberOfLines={2}>
                {item.description}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary50,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary900,
  },
  brand: {
    letterSpacing: 1.8,
    fontSize: 12,
  },
  greeting: {
    gap: 4,
    marginTop: -Spacing.xs,
  },
  alertBlock: {
    gap: Spacing.sm,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.primary100,
    backgroundColor: Colors.primary50,
  },
  alertCopy: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: Colors.text,
  },
  alertBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  hello: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontSize: 15,
    lineHeight: 22,
  },
  bookSection: {
    gap: Spacing.md,
  },
  bookSectionHead: {
    gap: 4,
  },
  startBadgeText: {
    color: Colors.primary900,
    letterSpacing: 0.5,
    fontSize: 11,
  },
  bookTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  bookSub: {
    fontSize: 13,
    lineHeight: 18,
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
    minHeight: 168,
  },
  modeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: Colors.text,
  },
  modeSub: {
    fontSize: 12,
    lineHeight: 16,
    flexGrow: 1,
  },
  modeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: Spacing.xs,
  },
  modeCtaText: {
    color: Colors.primary900,
    fontSize: 12,
  },
  apptPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  modePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  modePillText: {
    color: Colors.gray600,
    letterSpacing: 0,
    fontSize: 11,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionBlock: {
    gap: 2,
  },
  exploreHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  sectionSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  viewAll: {
    color: Colors.primary900,
    fontSize: 14,
  },
  apptLoading: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  apptCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.card,
  },
  apptEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.card,
  },
  apptEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apptEmptyCopy: {
    flex: 1,
    gap: 2,
  },
  apptBody: {
    flex: 1,
    gap: Spacing.sm,
  },
  apptTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  apptCopy: {
    flex: 1,
    gap: 2,
  },
  detailsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apptName: {
    fontSize: 15,
    lineHeight: 20,
  },
  apptSpecialty: {
    fontSize: 13,
    lineHeight: 18,
  },
  apptMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  apptMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  apptMetaText: {
    fontSize: 13,
    lineHeight: 18,
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
    letterSpacing: 0,
    fontSize: 11,
  },
  quickRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  quickCard: {
    width: 128,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.soft,
  },
  quickImage: {
    width: 44,
    height: 44,
  },
  quickTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  quickSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  exploreRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  exploreCard: {
    width: 148,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.soft,
  },
  exploreImageWrap: {
    height: 110,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  exploreImage: {
    width: 88,
    height: 88,
  },
  exploreBody: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 4,
  },
  exploreTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  exploreSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
