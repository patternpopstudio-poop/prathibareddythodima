import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';

export default function PrescriptionsScreen() {
  return (
    <Screen>
      <PageHeader
        eyebrow="RECORDS"
        title="Prescriptions"
        description="Your prescription history will appear here after consultations."
      />

      <Card style={styles.card}>
        <EmptyState
          icon="medication"
          title="No prescriptions yet"
          description="When a doctor issues a prescription, you’ll find the PDF and details in this list.">
          <Button title="Back to home" variant="secondary" onPress={() => router.back()} />
        </EmptyState>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
});
