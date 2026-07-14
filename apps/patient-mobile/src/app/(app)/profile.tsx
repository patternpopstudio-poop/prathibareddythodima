import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InitialsAvatarStatic } from '@/components/ui/initials-avatar';
import {
  CardSectionHeader,
  MetricStrip,
  ProfileFieldList,
} from '@/components/ui/profile-fields';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getProfileSections } from '@/lib/patient-display';

export default function ProfileScreen() {
  const { patient, signOut } = useAuth();
  const sections = getProfileSections(patient);

  return (
    <Screen>
      <ScreenNav title="Profile" />

      <Card style={styles.heroCard}>
        <InitialsAvatarStatic name={patient?.fullName} />
        <View style={styles.heroCopy}>
          <AppText variant="h3">{patient?.fullName ?? 'Your profile'}</AppText>
          <AppText variant="muted">Registration and health details</AppText>
        </View>
      </Card>

      {sections.map((section) => (
        <Card key={section.id} style={styles.card}>
          <CardSectionHeader icon={section.icon} title={section.title} />
          {section.variant === 'metrics' ? (
            <MetricStrip fields={section.fields} />
          ) : (
            <ProfileFieldList fields={section.fields} />
          )}
        </Card>
      ))}

      <Button
        title="Sign out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  card: {
    gap: Spacing.md,
  },
});
