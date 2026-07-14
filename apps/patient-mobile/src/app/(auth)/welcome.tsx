import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MediaHero } from '@/components/ui/media-hero';
import { Screen } from '@/components/ui/screen';
import { ClinicImages } from '@/constants/images';
import { Colors, Radius, Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <MediaHero source={ClinicImages.welcome} height={220} contentStyle={styles.heroBrand}>
          <View style={styles.mark}>
            <View style={styles.markInner} />
          </View>
          <AppText variant="label" style={styles.brandOnImage}>
            TELECONSULT
          </AppText>
        </MediaHero>

        <AppText variant="display">Care that starts with you</AppText>
        <AppText variant="muted" style={styles.support}>
          Create your account or sign in to complete your health profile and book consultations.
        </AppText>
      </View>

      <Card style={styles.card}>
        <Link href="/(auth)/register" asChild>
          <Button title="Create account" />
        </Link>
        <Link href="/(auth)/login" asChild>
          <Button title="Sign in" variant="secondary" />
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    justifyContent: 'flex-start',
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markInner: {
    width: 16,
    height: 16,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary900,
  },
  brandOnImage: {
    color: Colors.white,
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  support: {
    maxWidth: 320,
  },
  card: {
    gap: Spacing.sm,
  },
});
