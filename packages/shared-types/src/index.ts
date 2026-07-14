/**
 * Shared database interfaces and types for the teleconsult platform.
 * Import from @teleconsult/shared-types across apps and packages.
 */

export type UserRole = 'patient' | 'doctor' | 'admin';

export type AccountSource = 'b2c' | 'b2b';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Employer entity used to link B2B-managed patient accounts. */
export interface Employer extends BaseEntity {
  name: string;
}

/**
 * Patient profile: registration fields + onboarding (health / biometrics).
 * `profileCompleted` must be true before first booking.
 */
export interface Patient extends BaseEntity {
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  email: string;
  mobile: string | null;
  accountSource: AccountSource;
  employerId: string | null;
  profileCompleted: boolean;
  allergies: string | null;
  chronicAilments: string | null;
  pastSurgeries: string | null;
  familyHistory: string | null;
  currentMedications: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodGroup: BloodGroup | null;
}

/** Metadata passed to Supabase Auth `signUp` / admin `createUser` for B2C or B2B. */
export interface PatientAuthMetadata {
  role: 'patient';
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  mobile: string;
  account_source: AccountSource;
  /** Required when account_source is `b2b`. */
  employer_id?: string;
}

/** B2C self-registration form payload (password stays client → Auth only). */
export interface B2CRegistrationInput {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  email: string;
  mobile: string;
  password: string;
}

/** Profile completion form — required before first booking. */
export interface PatientOnboardingInput {
  allergies: string;
  chronicAilments: string;
  pastSurgeries: string;
  familyHistory: string;
  currentMedications: string;
  heightCm: number;
  weightKg: number;
  bloodGroup: BloodGroup;
}

/** Row shape returned from PostgREST `patients` (snake_case). */
export interface PatientRow {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  email: string;
  mobile: string | null;
  account_source: AccountSource;
  employer_id: string | null;
  profile_completed: boolean;
  allergies: string | null;
  chronic_ailments: string | null;
  past_surgeries: string | null;
  family_history: string | null;
  current_medications: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  blood_group: BloodGroup | null;
  created_at: string;
  updated_at: string;
}

export function mapPatientRow(row: PatientRow): Patient {
  return {
    id: row.id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    email: row.email,
    mobile: row.mobile,
    accountSource: row.account_source,
    employerId: row.employer_id,
    profileCompleted: row.profile_completed,
    allergies: row.allergies,
    chronicAilments: row.chronic_ailments,
    pastSurgeries: row.past_surgeries,
    familyHistory: row.family_history,
    currentMedications: row.current_medications,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bloodGroup: row.blood_group,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
