import type { BloodGroup } from '@teleconsult/shared-types';

export type HealthProfileValues = {
  heightCm: string;
  weightKg: string;
  bloodGroup: BloodGroup | null;
  allergies: string;
  chronicAilments: string;
  pastSurgeries: string;
  familyHistory: string;
  currentMedications: string;
};

export type HealthProfileFieldErrors = Partial<
  Record<'heightCm' | 'weightKg' | 'form', string>
>;

export type ParsedHealthProfile = {
  heightCm: number;
  weightKg: number;
  bloodGroup: BloodGroup | null;
  allergies: string | null;
  chronicAilments: string | null;
  pastSurgeries: string | null;
  familyHistory: string | null;
  currentMedications: string | null;
};

/** Reasonable adult ranges for teleconsult intake (cm / kg). */
const HEIGHT_MIN = 50;
const HEIGHT_MAX = 250;
const WEIGHT_MIN = 10;
const WEIGHT_MAX = 300;

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function validateHealthProfile(values: HealthProfileValues): HealthProfileFieldErrors {
  const errors: HealthProfileFieldErrors = {};
  const height = Number(values.heightCm);
  const weight = Number(values.weightKg);

  if (!values.heightCm.trim()) {
    errors.heightCm = 'Height is required.';
  } else if (!Number.isFinite(height) || height < HEIGHT_MIN || height > HEIGHT_MAX) {
    errors.heightCm = `Enter height between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm.`;
  }

  if (!values.weightKg.trim()) {
    errors.weightKg = 'Weight is required.';
  } else if (!Number.isFinite(weight) || weight < WEIGHT_MIN || weight > WEIGHT_MAX) {
    errors.weightKg = `Enter weight between ${WEIGHT_MIN} and ${WEIGHT_MAX} kg.`;
  }

  return errors;
}

export function parseHealthProfile(values: HealthProfileValues): ParsedHealthProfile | null {
  const errors = validateHealthProfile(values);
  if (Object.keys(errors).length > 0) return null;

  return {
    heightCm: Number(values.heightCm),
    weightKg: Number(values.weightKg),
    bloodGroup: values.bloodGroup,
    allergies: optionalText(values.allergies),
    chronicAilments: optionalText(values.chronicAilments),
    pastSurgeries: optionalText(values.pastSurgeries),
    familyHistory: optionalText(values.familyHistory),
    currentMedications: optionalText(values.currentMedications),
  };
}
