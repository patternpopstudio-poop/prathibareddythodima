import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MediaHero } from '@/components/ui/media-hero';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { ClinicImages } from '@/constants/images';
import { Spacing } from '@/constants/theme';

export default function BookScreen() {
  return (
    <Screen>
      <PageHeader
        eyebrow="ONLINE BOOKING"
        title="Book a consultation"
        description="Doctor availability and slot booking come next in the roadmap. Your profile is ready — booking will use it automatically."
      />

      <MediaHero source={ClinicImages.care} height={180} scrim={false} />

      <Card style={styles.card}>
        <AppText variant="bodyMedium">Coming soon</AppText>
        <AppText variant="muted">
          You’ll be able to pick a service, choose a slot, and confirm your visit from here.
        </AppText>
        <Button title="Back to home" variant="secondary" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
});
