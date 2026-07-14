import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';
import { BLOOD_GROUP_OPTIONS } from '@/lib/patient-display';
import type { BloodGroup } from '@teleconsult/shared-types';

export default function ProfileOnboardingScreen() {
  const { patient, completeOnboarding, signOut } = useAuth();
  const [allergies, setAllergies] = useState('');
  const [chronicAilments, setChronicAilments] = useState('');
  const [pastSurgeries, setPastSurgeries] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);

    const height = Number(heightCm);
    const weight = Number(weightKg);

    if (
      !allergies.trim() ||
      !chronicAilments.trim() ||
      !pastSurgeries.trim() ||
      !familyHistory.trim() ||
      !currentMedications.trim() ||
      !bloodGroup ||
      !Number.isFinite(height) ||
      !Number.isFinite(weight) ||
      height <= 0 ||
      weight <= 0
    ) {
      setError('Complete all health and biometric fields before continuing.');
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding({
        allergies: allergies.trim(),
        chronicAilments: chronicAilments.trim(),
        pastSurgeries: pastSurgeries.trim(),
        familyHistory: familyHistory.trim(),
        currentMedications: currentMedications.trim(),
        heightCm: height,
        weightKg: weight,
        bloodGroup,
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="HEALTH PROFILE"
        title="Complete your profile"
        description={`Required before your first booking${patient?.fullName ? ` — hi ${patient.fullName}` : ''}.`}
      />

      <Card style={styles.card}>
        <AppText variant="h3">Health information</AppText>
        <AppText variant="muted">Share what helps your clinician prepare.</AppText>
        <TextField
          label="Allergies"
          value={allergies}
          onChangeText={setAllergies}
          placeholder="None, or list allergies"
        />
        <TextField
          label="Chronic ailments"
          value={chronicAilments}
          onChangeText={setChronicAilments}
        />
        <TextField
          label="Past surgeries"
          value={pastSurgeries}
          onChangeText={setPastSurgeries}
        />
        <TextField
          label="Family history"
          value={familyHistory}
          onChangeText={setFamilyHistory}
        />
        <TextField
          label="Current medications"
          value={currentMedications}
          onChangeText={setCurrentMedications}
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">Physical information</AppText>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label="Height (cm)"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="Weight (kg)"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <ChipSelect
          label="Blood group"
          options={BLOOD_GROUP_OPTIONS}
          value={bloodGroup}
          onChange={setBloodGroup}
        />
        {error ? <AppText variant="error">{error}</AppText> : null}
        <Button title="Save and continue" loading={loading} onPress={onSubmit} />
        <Button
          title="Sign out"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  half: {
    flex: 1,
  },
});
