import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';

export default function LabReportsScreen() {
  return (
    <Screen>
      <PageHeader
        eyebrow="RECORDS"
        title="Lab reports"
        description="Your uploads and reports shared by the hospital will live here."
      />

      <Card style={styles.card}>
        <AppText variant="section">YOUR UPLOADS</AppText>
        <EmptyState
          icon="lab"
          title="No uploads yet"
          description="Reports you add from your phone will show in this section."
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="section">HOSPITAL REPORTS</AppText>
        <EmptyState
          icon="notes"
          title="No hospital reports yet"
          description="When the clinic shares lab results, they’ll appear here."
        />
      </Card>

      <Button title="Back to home" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
});
