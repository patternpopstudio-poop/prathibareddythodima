import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { Icon } from '@/components/ui/icon';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { Screen } from '@/components/ui/screen';
import { CLINIC, EXPLORE_CARE, QUICK_ACTIONS } from '@/constants/clinic';
import { BrandImages } from '@/constants/images';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { fetchNextUpcomingBooking, type UpcomingBooking } from '@/lib/bookings';
import { getFirstName } from '@/lib/patient-display';
import { formatSlotShortDate, formatSlotTimeLabel } from '@/lib/slot-display';

export default function HomeScreen() {
  const { patient } = useAuth();
  const firstName = getFirstName(patient?.fullName);
  const [upcoming, setUpcoming] = useState<UpcomingBooking | null>(null);
  const [apptLoading, setApptLoading] = useState(true);

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
        <InitialsAvatar
          name={patient?.fullName}
          size={44}
          accessibilityLabel="Open profile"
          onPress={() => router.push('/(app)/profile')}
        />
      </View>

      <View style={styles.greeting}>
        <AppText variant="h2" style={styles.hello}>
          Hello, {firstName} 👋
        </AppText>
        <AppText variant="muted" style={styles.greetingSub}>
          How can we help with your health today?
        </AppText>
      </View>

      <View style={styles.bookCard}>
        <View style={styles.bookCopy}>
          <View style={styles.startBadge}>
            <AppText variant="label" style={styles.startBadgeText}>
              ✨ START HERE
            </AppText>
          </View>
          <AppText variant="h3" style={styles.bookTitle}>
            Book a consultation
          </AppText>
          <AppText variant="muted" style={styles.bookSub}>
            {CLINIC.tagline}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Book now"
            onPress={() => router.push('/(app)/book')}
            style={({ pressed }) => [styles.bookBtn, pressed && styles.pressed]}>
            <AppText variant="bodyMedium" style={styles.bookBtnLabel}>
              Book now
            </AppText>
            <View style={styles.bookBtnArrow}>
              <Icon name="chevron" size={16} color={Colors.primary900} />
            </View>
          </Pressable>
        </View>
        <Image
          source={BrandImages.bookConsultHero}
          style={styles.bookArt}
          contentFit="contain"
          transition={0}
        />
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
          onPress={() =>
            router.push(`/(app)/booking-confirmed?id=${upcoming.booking.id}` as Href)
          }
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
                  Teleconsult
                </AppText>
              </View>
              <Icon name="chevron" size={18} color={Colors.gray400} />
            </View>

            <View style={styles.apptMetaRow}>
              <View style={styles.apptMetaItem}>
                <Icon name="calendar" size={14} color={Colors.gray500} />
                <AppText variant="muted" style={styles.apptMetaText}>
                  {formatSlotShortDate(upcoming.slot.startsAt)}
                </AppText>
              </View>
              <View style={styles.apptMetaItem}>
                <Icon name="clock" size={14} color={Colors.gray500} />
                <AppText variant="muted" style={styles.apptMetaText}>
                  {formatSlotTimeLabel(upcoming.slot.startsAt)}
                </AppText>
              </View>
            </View>

            <View style={styles.confirmedPill}>
              <AppText variant="label" style={styles.confirmedText}>
                Confirmed
              </AppText>
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/book')}
          style={({ pressed }) => [styles.apptEmpty, pressed && styles.pressed]}>
          <View style={styles.apptEmptyIcon}>
            <Icon name="calendar" size={22} color={Colors.primary900} />
          </View>
          <View style={styles.apptEmptyCopy}>
            <AppText variant="bodyMedium">No upcoming appointments</AppText>
            <AppText variant="muted" style={styles.apptSpecialty}>
              Book a consultation to get started.
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
  brand: {
    letterSpacing: 1.8,
    fontSize: 12,
  },
  greeting: {
    gap: 4,
    marginTop: -Spacing.xs,
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
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary50,
    borderRadius: Radius.card,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    gap: Spacing.sm,
    overflow: 'hidden',
    minHeight: 188,
  },
  bookCopy: {
    flex: 1,
    gap: Spacing.sm,
    zIndex: 1,
  },
  startBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
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
    maxWidth: 180,
  },
  bookBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    minHeight: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary900,
    paddingLeft: Spacing.lg,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bookBtnLabel: {
    color: Colors.white,
    fontFamily: FontFamily.label,
    fontSize: 15,
  },
  bookBtnArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookArt: {
    width: 128,
    height: 128,
    marginRight: -Spacing.xs,
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
