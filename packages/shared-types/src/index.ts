/**
 * Shared database interfaces and types for the teleconsult platform.
 * Import from @teleconsult/shared-types across apps and packages.
 */

export type UserRole = 'patient' | 'doctor' | 'admin';

export type AccountSource = 'b2c' | 'b2b';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

/** Roles that may use the doctor-admin web app. */
export const STAFF_ROLES: readonly UserRole[] = ['doctor', 'admin'] as const;

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
 * Patient profile: registration fields + optional health / biometrics.
 * `profileCompleted` tracks health-profile completeness for nudges — not a booking gate.
 */
export interface Patient extends BaseEntity {
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  email: string;
  mobile: string | null;
  city: string | null;
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

/** Doctor profile (admin-managed; photo expected in Phase 2 soft gate). */
export interface Doctor extends BaseEntity {
  fullName: string;
  email: string;
  mobile: string | null;
  photoUrl: string | null;
  isActive: boolean;
}

/** Doctor self-service profile update (Phase 2). */
export interface DoctorProfileInput {
  fullName: string;
  mobile?: string | null;
  photoUrl?: string | null;
}

/** True when doctor still needs a profile photo (nudge / soft gate). */
export function needsDoctorPhoto(doctor: Doctor | null | undefined): boolean {
  return !doctor?.photoUrl?.trim();
}

/** Metadata passed to Supabase Auth `signUp` / admin `createUser` for B2C or B2B. */
export interface PatientAuthMetadata {
  role: 'patient';
  full_name: string;
  mobile: string;
  account_source: AccountSource;
  /** Optional at signup — can be filled later from profile. */
  date_of_birth?: string;
  gender?: Gender;
  /** Required when account_source is `b2b`. */
  employer_id?: string;
}

/** B2C self-registration — essentials only so users can book quickly. */
export interface B2CRegistrationInput {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
}

/** Basic profile collected after phone OTP (Phase 2). */
export interface PatientBasicDetailsInput {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  /** Optional contact email — mainly for phone-auth users. */
  email?: string;
  city: string;
}

/**
 * Health / biometric profile (nudged after signup — not a booking gate).
 * Height + weight required on save; blood group and history optional.
 */
export interface PatientOnboardingInput {
  heightCm: number;
  weightKg: number;
  bloodGroup?: BloodGroup | null;
  allergies?: string | null;
  chronicAilments?: string | null;
  pastSurgeries?: string | null;
  familyHistory?: string | null;
  currentMedications?: string | null;
}

/** Admin invite payload (backend service-role). Staff only — B2B patients deferred. */
export interface InviteUserInput {
  email: string;
  role: 'doctor' | 'admin';
  fullName: string;
  mobile?: string;
  /** Absolute URL where the invitee lands after accepting the setup link. */
  redirectTo?: string;
}

export interface InviteUserResult {
  userId: string;
  email: string;
  role: UserRole;
  /** One-time setup / invite action link (dev: return in response; prod: email only). */
  actionLink: string | null;
}

/** Day of week for availability rules — matches JS `Date.getDay()` (0 = Sunday). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SlotStatus = 'open' | 'booked' | 'blocked' | 'cancelled';

export type BookingStatus = 'confirmed' | 'cancelled';

/** Weekly working-hour rule used to generate concrete slots. */
export interface DoctorAvailability extends BaseEntity {
  doctorId: string;
  dayOfWeek: DayOfWeek;
  /** Local wall-clock time `HH:mm:ss` or `HH:mm`. */
  startTime: string;
  endTime: string;
  /** Minimum 15 minutes. */
  slotDurationMinutes: number;
  bufferMinutes: number;
  quietStart: string | null;
  quietEnd: string | null;
  isActive: boolean;
}

/** Concrete bookable window for a doctor. */
export interface AppointmentSlot extends BaseEntity {
  doctorId: string;
  availabilityId: string | null;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
}

/**
 * Hours before slot start when patients may still self-cancel online.
 * Must stay in sync with `public.booking_cancel_cutoff_hours()` in Postgres.
 */
export const BOOKING_CANCEL_CUTOFF_HOURS = 2;

export type CancelBookingOutcome = 'cancelled' | 'contact_hospital';

/** Patient reservation of an appointment slot. */
export interface Booking extends BaseEntity {
  slotId: string;
  patientId: string;
  doctorId: string;
  status: BookingStatus;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Set when patient requests cancel after the free-cancel cutoff. */
  cancelRequestAt: string | null;
  cancelRequestNote: string | null;
}

export interface CancelBookingResult {
  outcome: CancelBookingOutcome;
  cutoffHours: number;
  message: string;
  booking: Booking;
}

/** True when `now` is still before the free-cancel deadline. */
export function canCancelBookingOnline(
  slotStartsAt: string | Date,
  options?: { now?: Date; cutoffHours?: number }
): boolean {
  const now = options?.now ?? new Date();
  const cutoffHours = options?.cutoffHours ?? BOOKING_CANCEL_CUTOFF_HOURS;
  const starts = new Date(slotStartsAt);
  const deadline = new Date(starts.getTime() - cutoffHours * 60 * 60 * 1000);
  return now.getTime() < deadline.getTime() && now.getTime() < starts.getTime();
}

/** Doctor creates / updates a weekly availability rule. */
export interface DoctorAvailabilityInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  bufferMinutes?: number;
  quietStart?: string | null;
  quietEnd?: string | null;
  isActive?: boolean;
}

/** Doctor creates a concrete open slot (manual or generated). */
export interface AppointmentSlotInput {
  startsAt: string;
  endsAt: string;
  availabilityId?: string | null;
  status?: Extract<SlotStatus, 'open' | 'blocked'>;
}

/** Audit log actions written by DB triggers / backend. */
export type AuditAction =
  | 'patient.created'
  | 'patient.profile_updated'
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.cancel_requested'
  | (string & {});

/** Field-level change recorded in audit metadata. */
export interface AuditFieldChange {
  from: unknown;
  to: unknown;
}

/**
 * Immutable audit trail row (`audit_logs`).
 * Clients cannot insert; populated by SECURITY DEFINER triggers / service role.
 */
export interface AuditLog {
  id: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  metadata: {
    changes?: Record<string, AuditFieldChange | unknown>;
    op?: 'INSERT' | 'UPDATE' | 'DELETE';
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

/** Row shape returned from PostgREST `patients` (snake_case). */
export interface PatientRow {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  email: string;
  mobile: string | null;
  city: string | null;
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

export interface DoctorRow {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  photo_url: string | null;
  is_active: boolean;
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
    city: row.city ?? null,
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

/** True when name / DOB / gender still need collecting (post-OTP gate). */
export function needsBasicDetails(patient: Patient | null | undefined): boolean {
  if (!patient) return true;
  return !patient.fullName.trim() || !patient.dateOfBirth || !patient.gender;
}

export function mapDoctorRow(row: DoctorRow): Doctor {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    mobile: row.mobile,
    photoUrl: row.photo_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Row shape from PostgREST `doctor_availability`. */
export interface DoctorAvailabilityRow {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  quiet_start: string | null;
  quiet_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentSlotRow {
  id: string;
  doctor_id: string;
  availability_id: string | null;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  slot_id: string;
  patient_id: string;
  doctor_id: string;
  status: BookingStatus;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancel_request_at: string | null;
  cancel_request_note: string | null;
  created_at: string;
  updated_at: string;
}

function asDayOfWeek(value: number): DayOfWeek {
  if (value >= 0 && value <= 6) return value as DayOfWeek;
  throw new Error(`Invalid day_of_week: ${value}`);
}

export function mapDoctorAvailabilityRow(row: DoctorAvailabilityRow): DoctorAvailability {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    dayOfWeek: asDayOfWeek(row.day_of_week),
    startTime: row.start_time,
    endTime: row.end_time,
    slotDurationMinutes: row.slot_duration_minutes,
    bufferMinutes: row.buffer_minutes,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAppointmentSlotRow(row: AppointmentSlotRow): AppointmentSlot {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    availabilityId: row.availability_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBookingRow(row: BookingRow): Booking {
  return {
    id: row.id,
    slotId: row.slot_id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    status: row.status,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    cancelRequestAt: row.cancel_request_at ?? null,
    cancelRequestNote: row.cancel_request_note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map RPC `cancel_appointment_booking` jsonb payload. */
export function mapCancelBookingResult(payload: {
  outcome: string;
  cutoffHours: number;
  message: string;
  booking: BookingRow;
}): CancelBookingResult {
  if (payload.outcome !== 'cancelled' && payload.outcome !== 'contact_hospital') {
    throw new Error(`Unexpected cancel outcome: ${payload.outcome}`);
  }
  return {
    outcome: payload.outcome,
    cutoffHours: payload.cutoffHours,
    message: payload.message,
    booking: mapBookingRow(payload.booking),
  };
}

/** Read app role from JWT `app_metadata` (never from user_metadata). */
export function getRoleFromAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined
): UserRole | null {
  const role = appMetadata?.role;
  if (role === 'patient' || role === 'doctor' || role === 'admin') return role;
  return null;
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === 'doctor' || role === 'admin';
}
