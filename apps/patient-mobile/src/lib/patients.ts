import type {
  PatientBasicDetailsInput,
  PatientOnboardingInput,
  PatientRow,
} from '@teleconsult/shared-types';
import { mapPatientRow } from '@teleconsult/shared-types';

import { supabase } from '@/lib/supabase';

function optionalOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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

export async function savePatientBasicDetails(
  userId: string,
  input: PatientBasicDetailsInput
) {
  const payload: Record<string, string> = {
    full_name: input.fullName.trim(),
    date_of_birth: input.dateOfBirth,
    gender: input.gender,
    city: input.city.trim(),
  };

  const email = input.email?.trim().toLowerCase();
  if (email) {
    payload.email = email;
  }

  const { data, error } = await supabase
    .from('patients')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return mapPatientRow(data as PatientRow);
}

export async function completePatientOnboarding(
  userId: string,
  input: PatientOnboardingInput
) {
  const { data, error } = await supabase
    .from('patients')
    .update({
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      blood_group: input.bloodGroup ?? null,
      allergies: optionalOrNull(input.allergies),
      chronic_ailments: optionalOrNull(input.chronicAilments),
      past_surgeries: optionalOrNull(input.pastSurgeries),
      family_history: optionalOrNull(input.familyHistory),
      current_medications: optionalOrNull(input.currentMedications),
      profile_completed: true,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return mapPatientRow(data as PatientRow);
}
