import type { BloodGroup } from '@teleconsult/shared-types';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  parseHealthProfile,
  validateHealthProfile,
  type HealthProfileFieldErrors,
} from '@/lib/health-profile-validation';
import { BLOOD_GROUP_OPTIONS } from '@/lib/patient-display';

function metricToInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(value);
}

export default function ProfileOnboardingScreen() {
  const { patient, completeOnboarding } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const fromMyHealth = params.mode === 'edit' || params.mode === 'complete';
  const isEdit = params.mode === 'edit' || Boolean(patient?.profileCompleted);

  const [heightCm, setHeightCm] = useState(() => metricToInput(patient?.heightCm));
  const [weightKg, setWeightKg] = useState(() => metricToInput(patient?.weightKg));
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(patient?.bloodGroup ?? null);
  const [allergies, setAllergies] = useState(patient?.allergies ?? '');
  const [chronicAilments, setChronicAilments] = useState(patient?.chronicAilments ?? '');
  const [pastSurgeries, setPastSurgeries] = useState(patient?.pastSurgeries ?? '');
  const [familyHistory, setFamilyHistory] = useState(patient?.familyHistory ?? '');
  const [currentMedications, setCurrentMedications] = useState(patient?.currentMedications ?? '');
  const [fieldErrors, setFieldErrors] = useState<HealthProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const values = useMemo(
    () => ({
      heightCm,
      weightKg,
      bloodGroup,
      allergies,
      chronicAilments,
      pastSurgeries,
      familyHistory,
      currentMedications,
    }),
    [
      heightCm,
      weightKg,
      bloodGroup,
      allergies,
      chronicAilments,
      pastSurgeries,
      familyHistory,
      currentMedications,
    ]
  );

  function finish() {
    if (fromMyHealth) {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace('/(app)/profile');
      return;
    }
    router.replace('/(app)/home');
  }

  async function onSubmit() {
    setFormError(null);
    const errors = validateHealthProfile(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const parsed = parseHealthProfile(values);
    if (!parsed) return;

    setLoading(true);
    try {
      await completeOnboarding(parsed);
      finish();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      {fromMyHealth ? (
        <ScreenNav title={isEdit ? 'Edit health profile' : 'Health profile'} onBack={finish} />
      ) : null}

      <PageHeader
        eyebrow={fromMyHealth ? 'MY HEALTH' : 'OPTIONAL'}
        title={isEdit ? 'Update health details' : 'Health profile'}
        description={
          isEdit
            ? 'Height and weight help your clinician prepare. Other fields are optional.'
            : `Helps your clinician prepare${patient?.fullName ? ` — hi ${patient.fullName}` : ''}. Height and weight are required to save; you can skip for now.`
        }
      />

      <Card style={styles.card}>
        <AppText variant="h3">Biometrics</AppText>
        <AppText variant="muted">Height and weight are required.</AppText>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label="Height (cm)"
              value={heightCm}
              onChangeText={(text) => {
                setHeightCm(text);
                if (fieldErrors.heightCm) {
                  setFieldErrors((prev) => ({ ...prev, heightCm: undefined }));
                }
              }}
              keyboardType="decimal-pad"
              error={fieldErrors.heightCm}
              placeholder="e.g. 170"
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="Weight (kg)"
              value={weightKg}
              onChangeText={(text) => {
                setWeightKg(text);
                if (fieldErrors.weightKg) {
                  setFieldErrors((prev) => ({ ...prev, weightKg: undefined }));
                }
              }}
              keyboardType="decimal-pad"
              error={fieldErrors.weightKg}
              placeholder="e.g. 68"
            />
          </View>
        </View>
        <ChipSelect
          label="Blood group (optional)"
          options={BLOOD_GROUP_OPTIONS}
          value={bloodGroup}
          onChange={setBloodGroup}
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">Medical history</AppText>
        <AppText variant="muted">Optional — leave blank or write None if not applicable.</AppText>
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
          placeholder="Optional"
        />
        <TextField
          label="Past surgeries"
          value={pastSurgeries}
          onChangeText={setPastSurgeries}
          placeholder="Optional"
        />
        <TextField
          label="Family history"
          value={familyHistory}
          onChangeText={setFamilyHistory}
          placeholder="Optional"
        />
        <TextField
          label="Current medications"
          value={currentMedications}
          onChangeText={setCurrentMedications}
          placeholder="Optional"
        />
      </Card>

      <View style={styles.actions}>
        {formError ? <AppText variant="error">{formError}</AppText> : null}
        <Button
          title={isEdit ? 'Save changes' : 'Save health profile'}
          loading={loading}
          onPress={onSubmit}
        />
        {fromMyHealth ? (
          <Button title="Cancel" variant="secondary" onPress={finish} />
        ) : (
          <Button title="Skip for now" variant="secondary" onPress={finish} />
        )}
      </View>
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
  actions: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
});
