import type { PatientOnboardingInput, PatientRow } from '@teleconsult/shared-types';
import { mapPatientRow } from '@teleconsult/shared-types';

import { supabase } from '@/lib/supabase';

export async function fetchPatientProfile(userId: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapPatientRow(data as PatientRow);
}

export async function completePatientOnboarding(
  userId: string,
  input: PatientOnboardingInput
) {
  const { data, error } = await supabase
    .from('patients')
    .update({
      allergies: input.allergies,
      chronic_ailments: input.chronicAilments,
      past_surgeries: input.pastSurgeries,
      family_history: input.familyHistory,
      current_medications: input.currentMedications,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      blood_group: input.bloodGroup,
      profile_completed: true,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return mapPatientRow(data as PatientRow);
}
