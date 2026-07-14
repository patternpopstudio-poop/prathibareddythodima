import type { BloodGroup, Gender, Patient } from '@teleconsult/shared-types';

export const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const GENDER_OPTIONS: { label: string; value: Gender }[] = (
  Object.entries(GENDER_LABELS) as [Gender, string][]
).map(([value, label]) => ({ label, value }));

export const BLOOD_GROUP_OPTIONS: { label: string; value: BloodGroup }[] = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
];

export function getInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return 'TC';
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'TC'
  );
}

export function getFirstName(fullName?: string | null): string {
  if (!fullName?.trim()) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
}

export function formatGender(gender: Gender | null | undefined): string {
  if (!gender) return '—';
  return GENDER_LABELS[gender] ?? gender;
}

export function formatDateOfBirth(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMetric(value: number | null | undefined, unit: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value} ${unit}`;
}

export function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export type ProfileField = {
  label: string;
  value: string;
};

export function getRegistrationFields(patient: Patient | null): ProfileField[] {
  if (!patient) return [];
  return [
    { label: 'Full name', value: displayOrDash(patient.fullName) },
    { label: 'Date of birth', value: formatDateOfBirth(patient.dateOfBirth) },
    { label: 'Gender', value: formatGender(patient.gender) },
    { label: 'Email', value: displayOrDash(patient.email) },
    { label: 'Mobile', value: displayOrDash(patient.mobile) },
  ];
}

export function getBiometricFields(patient: Patient | null): ProfileField[] {
  if (!patient) return [];
  return [
    { label: 'Height', value: formatMetric(patient.heightCm, 'cm') },
    { label: 'Weight', value: formatMetric(patient.weightKg, 'kg') },
    { label: 'Blood group', value: displayOrDash(patient.bloodGroup) },
  ];
}

export function getHealthFields(patient: Patient | null): ProfileField[] {
  if (!patient) return [];
  return [
    { label: 'Allergies', value: displayOrDash(patient.allergies) },
    { label: 'Chronic ailments', value: displayOrDash(patient.chronicAilments) },
    { label: 'Past surgeries', value: displayOrDash(patient.pastSurgeries) },
    { label: 'Family history', value: displayOrDash(patient.familyHistory) },
    { label: 'Current medications', value: displayOrDash(patient.currentMedications) },
  ];
}

/** Declarative profile sections — screens just map this, no duplicated card chrome. */
export function getProfileSections(patient: Patient | null) {
  return [
    {
      id: 'registration',
      title: 'REGISTRATION',
      icon: 'person' as const,
      variant: 'rows' as const,
      fields: getRegistrationFields(patient),
    },
    {
      id: 'biometrics',
      title: 'BIOMETRICS',
      icon: 'health' as const,
      variant: 'metrics' as const,
      fields: getBiometricFields(patient),
    },
    {
      id: 'health',
      title: 'HEALTH HISTORY',
      icon: 'notes' as const,
      variant: 'rows' as const,
      fields: getHealthFields(patient),
    },
  ];
}
