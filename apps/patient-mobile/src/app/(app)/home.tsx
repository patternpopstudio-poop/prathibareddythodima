import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, IconBadge } from '@/components/ui/icon';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { MediaHero } from '@/components/ui/media-hero';
import { SectionHeading } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import {
  CARE_SERVICES,
  CLINIC,
  CLINICIAN_META,
  QUICK_ACTIONS,
} from '@/constants/clinic';
import { ClinicImages } from '@/constants/images';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getFirstName } from '@/lib/patient-display';

export default function HomeScreen() {
  const { patient } = useAuth();
  const firstName = getFirstName(patient?.fullName);

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.greeting}>
          <AppText variant="eyebrow" style={styles.brand}>
            TELECONSULT
          </AppText>
          <AppText variant="h2">Hello, {firstName}</AppText>
          <AppText variant="muted">What would you like to do today?</AppText>
        </View>
        <InitialsAvatar
          name={patient?.fullName}
          accessibilityLabel="Open profile"
          onPress={() => router.push('/(app)/profile')}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(app)/book')}
        style={({ pressed }) => [styles.heroPress, pressed && styles.pressed]}>
        <MediaHero
          source={ClinicImages.hero}
          height={240}
          scrim="rgba(33, 48, 8, 0.72)"
          contentStyle={styles.heroBody}>
          <View style={styles.heroTop}>
            <IconBadge
              name="book"
              size={24}
              badgeSize={52}
              backgroundColor="rgba(255,255,255,0.18)"
              color={Colors.white}
            />
            <View style={styles.ratingPill}>
              <Icon name="star" size={14} color={Colors.primary400} />
              <AppText variant="label" style={styles.ratingText}>
                {CLINIC.rating.toFixed(1)} · {CLINIC.reviewCount} reviews
              </AppText>
            </View>
          </View>
          <AppText variant="label" style={styles.heroEyebrow}>
            ONLINE BOOKING
          </AppText>
          <AppText variant="h3" style={styles.heroTitle}>
            Book a consultation
          </AppText>
          <AppText variant="muted" style={styles.heroCopy}>
            {CLINIC.tagline}
          </AppText>
          <View style={styles.heroCta}>
            <AppText variant="bodyMedium" style={styles.heroCtaText}>
              Book online
            </AppText>
            <Icon name="chevron" size={18} color={Colors.white} />
          </View>
        </MediaHero>
      </Pressable>

      <SectionHeading title="Quick access" description="Your care tools in one place." />

      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            onPress={() => router.push(action.href)}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
            <IconBadge name={action.icon} size={22} badgeSize={44} />
            <AppText variant="bodyMedium">{action.title}</AppText>
            <AppText variant="muted" style={styles.quickSub} numberOfLines={2}>
              {action.subtitle}
            </AppText>
          </Pressable>
        ))}
      </View>

      <SectionHeading title="Care services" description="Tap a specialty to start booking." />

      <View style={styles.serviceGrid}>
        {CARE_SERVICES.map((service) => (
          <Pressable
            key={service.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/(app)/book', params: { service: service.id } })
            }
            style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}>
            <Image
              source={service.image}
              style={styles.serviceImage}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.serviceBody}>
              <IconBadge name={service.icon} size={18} badgeSize={36} />
              <AppText variant="bodyMedium">{service.title}</AppText>
              <AppText variant="muted" numberOfLines={2} style={styles.serviceCopy}>
                {service.description}
              </AppText>
            </View>
          </Pressable>
        ))}
      </View>

      <Card style={styles.clinicianCard} padded={false}>
        <Image
          source={CLINIC.photo}
          style={styles.clinicianPhoto}
          contentFit="cover"
          transition={250}
        />
        <View style={styles.clinicianContent}>
          <View style={styles.clinicianHeader}>
            <IconBadge name="stethoscope" size={20} badgeSize={44} />
            <View style={styles.clinicianCopy}>
              <AppText variant="section">YOUR CLINICIAN</AppText>
              <AppText variant="h3">{CLINIC.doctorName}</AppText>
              <AppText variant="muted">{CLINIC.specialty}</AppText>
            </View>
          </View>
          <AppText variant="body">{CLINIC.about}</AppText>
          <View style={styles.clinicMeta}>
            {CLINICIAN_META.map((row) => (
              <View key={row.text} style={styles.metaRow}>
                <Icon name={row.icon} size={16} color={Colors.primary600} />
                {row.strong ? (
                  <AppText variant="bodyMedium">{row.text}</AppText>
                ) : (
                  <AppText variant="muted">{row.text}</AppText>
                )}
              </View>
            ))}
          </View>
          <Button title="Book with Dr. Reddy" onPress={() => router.push('/(app)/book')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  greeting: {
    flex: 1,
    gap: 2,
  },
  brand: {
    letterSpacing: 1.6,
    marginBottom: Spacing.xs,
  },
  heroPress: {
    borderRadius: Radius.card,
    ...Shadow.soft,
  },
  heroBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    minHeight: 240,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  ratingText: {
    color: Colors.white,
    letterSpacing: 0.2,
  },
  heroEyebrow: {
    color: Colors.primary400,
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: Colors.white,
  },
  heroCopy: {
    color: 'rgba(255,255,255,0.78)',
    marginBottom: Spacing.xs,
  },
  heroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.button,
  },
  heroCtaText: {
    color: Colors.white,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  quickSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  serviceCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  serviceImage: {
    width: '100%',
    height: 88,
    backgroundColor: Colors.primary50,
  },
  serviceBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  serviceCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  clinicianCard: {
    overflow: 'hidden',
  },
  clinicianPhoto: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.primary50,
  },
  clinicianContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  clinicianHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  clinicianCopy: {
    flex: 1,
    gap: 2,
  },
  clinicMeta: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
