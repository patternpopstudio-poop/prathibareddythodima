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

/**
 * Consultation fee bounds in INR paise (₹400–₹700).
 * Must stay in sync with `doctors_consultation_fee_paise_range` in Postgres.
 */
export const CONSULTATION_FEE_MIN_PAISE = 40_000;
export const CONSULTATION_FEE_MAX_PAISE = 70_000;
/** Default fee for new doctors (₹500). */
export const CONSULTATION_FEE_DEFAULT_PAISE = 50_000;
export const BOOKING_CURRENCY = 'INR' as const;

/** Format INR paise as a display string (e.g. 50000 → "₹500"). */
export function formatInrFromPaise(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** True when fee is within the allowed ₹400–₹700 band. */
export function isValidConsultationFeePaise(paise: number): boolean {
  return (
    Number.isInteger(paise) &&
    paise >= CONSULTATION_FEE_MIN_PAISE &&
    paise <= CONSULTATION_FEE_MAX_PAISE
  );
}

/** Doctor profile (admin-managed; photo expected in Phase 2 soft gate). */
export interface Doctor extends BaseEntity {
  fullName: string;
  email: string;
  mobile: string | null;
  photoUrl: string | null;
  isActive: boolean;
  /** Clinical specialty shown to patients (ENT-focused clinic). */
  specialty: string;
  /** Qualification string, e.g. MBBS, MS (ENT). */
  degrees: string;
  /** Consultation fee in INR paise (₹400–₹700). Admin-managed. */
  consultationFeePaise: number;
}

/** Doctor self-service profile update (Phase 2). Fee is admin-only. */
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
  /**
   * Doctor only: consultation fee in INR paise (₹400–₹700).
   * Defaults to {@link CONSULTATION_FEE_DEFAULT_PAISE} when omitted.
   */
  consultationFeePaise?: number;
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

/**
 * Online (teleconsult + chat) vs offline (in-clinic; no chat).
 * Must stay in sync with `public.consultation_mode` in Postgres.
 */
export type ConsultationMode = 'online' | 'offline';

/**
 * How the patient pays for a booking.
 * `clinic` is only valid when `mode = offline` (enforced in DB).
 */
export type BookingPaymentMethod = 'online' | 'clinic';

export type BookingStatus =
  | 'confirmed'
  | 'pending_payment'
  | 'pending_admin'
  | 'rejected'
  | 'cancelled';

/** How a booking is billed (set when booking is created in Phase 4 Slice 2+). */
export type BillingChannel = 'b2c_prepaid' | 'b2b_employer';

/** Payment lifecycle on a booking. */
export type BookingPaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'not_required';

/** Status of a `payments` row (Razorpay attempt). */
export type PaymentRecordStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentGateway = 'razorpay';

/** Status of a `refunds` ledger row (Phase 4 Slice 6). */
export type RefundStatus = 'pending' | 'succeeded' | 'failed';

/**
 * Why a refund exists.
 * `reschedule_failed` is reserved for Phase 7 — not wired in Phase 4.
 */
export type RefundReason =
  | 'patient_free_cancel'
  | 'hold_expired_after_pay'
  | 'reschedule_failed';

/**
 * Consultation case lifecycle (Phase 5).
 * `closed` ships in Phase 7 — not in the DB enum yet.
 */
export type ConsultationStatus = 'open' | 'in_progress';

/** Who sent a chat message (admins are read-only on chat). */
export type MessageSenderRole = 'patient' | 'doctor';

/** Max UTF-16 / Postgres character length for `messages.body`. */
export const MESSAGE_BODY_MAX_LENGTH = 8000;

/** Private Storage bucket for consultation chat files (Slice 5.5). */
export const CONSULTATION_ATTACHMENTS_BUCKET = 'consultation-attachments';

/** Max attachment size (10 MiB) — matches bucket + DB check. */
export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Allowed chat attachment MIME types (PDF, JPG, PNG). */
export const MESSAGE_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export type MessageAttachmentMime = (typeof MESSAGE_ATTACHMENT_MIME_TYPES)[number];

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
  /** Online vs offline inventory (Slice 5.7). */
  mode: ConsultationMode;
}

/** Concrete bookable window for a doctor. */
export interface AppointmentSlot extends BaseEntity {
  doctorId: string;
  availabilityId: string | null;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  /** Online vs offline; must not overlap other non-cancelled slots for the doctor. */
  mode: ConsultationMode;
}

/**
 * Hours before slot start when patients may still self-cancel online.
 * Must stay in sync with `public.booking_cancel_cutoff_hours()` in Postgres.
 */
export const BOOKING_CANCEL_CUTOFF_HOURS = 2;

/**
 * Minutes a B2C `pending_payment` hold may keep a slot before auto-expiry.
 * Must stay in sync with `public.booking_payment_hold_minutes()` in Postgres.
 */
export const BOOKING_PAYMENT_HOLD_MINUTES = 15;

/** Map patient account source → booking billing channel. */
export function billingChannelForAccountSource(
  source: AccountSource
): BillingChannel {
  return source === 'b2b' ? 'b2b_employer' : 'b2c_prepaid';
}

export type CancelBookingOutcome = 'cancelled' | 'contact_hospital';

/** Patient reservation of an appointment slot (or overflow request without a slot). */
export interface Booking extends BaseEntity {
  /**
   * Null when `status = pending_admin` (overflow request awaiting admin capacity).
   * Required for `confirmed` / `pending_payment`.
   */
  slotId: string | null;
  patientId: string;
  doctorId: string;
  status: BookingStatus;
  /** Online vs offline consultation. */
  mode: ConsultationMode;
  /**
   * How the patient pays. Defaults to `online` on slot books; `clinic` only for offline.
   * Null on legacy pre-5.7 rows.
   */
  paymentMethod: BookingPaymentMethod | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Set when patient requests cancel after the free-cancel cutoff. */
  cancelRequestAt: string | null;
  cancelRequestNote: string | null;
  /** Null on legacy pre-Phase-4 rows until Slice 2 backfills on new books. */
  billingChannel: BillingChannel | null;
  paymentStatus: BookingPaymentStatus;
  /** Fee snapshot at booking time (INR paise). */
  amountPaise: number | null;
  currency: typeof BOOKING_CURRENCY;
  /** Preferred window for `pending_admin` overflow requests (Slice 5.11). */
  preferredStartsAt: string | null;
  preferredEndsAt: string | null;
  preferredNote: string | null;
  /** Admin reason when `status = rejected` (Slice 5.11). */
  rejectReason: string | null;
}

/** Razorpay payment attempt tied to a booking. */
export interface Payment extends BaseEntity {
  bookingId: string;
  patientId: string;
  amountPaise: number;
  currency: typeof BOOKING_CURRENCY;
  status: PaymentRecordStatus;
  gateway: PaymentGateway;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  gatewaySignature: string | null;
  /** Set after a successful full refund (Slice 5 free-cancel). */
  gatewayRefundId: string | null;
  failureReason: string | null;
  paidAt: string | null;
}

/**
 * Refund ledger row for a B2C payment.
 * Phase 4 wires free-cancel + hold-expired pending; Phase 7 adds reschedule_failed.
 */
export interface Refund extends BaseEntity {
  paymentId: string;
  bookingId: string;
  patientId: string;
  amountPaise: number;
  currency: typeof BOOKING_CURRENCY;
  status: RefundStatus;
  reason: RefundReason;
  gatewayRefundId: string | null;
  failureReason: string | null;
  notes: string | null;
  processedAt: string | null;
}

/**
 * Doctor case-list queue filters (Phase 5 Slice 5.6).
 * - unreplied: never received a doctor reply (`status = open`)
 * - response_awaited: in progress and patient spoke last
 */
export type DoctorCaseQueue = 'all' | 'unreplied' | 'response_awaited';

/**
 * Chat case for a confirmed booking (Phase 5).
 * Opened in Slice 5.2 when booking becomes `confirmed` (DB trigger + backend heal).
 * Chat messaging is for `mode = online` only (Slice 5.12 RLS + UI).
 */
export interface Consultation extends BaseEntity {
  bookingId: string;
  patientId: string;
  doctorId: string;
  status: ConsultationStatus;
  /** Copied from booking at open. */
  mode: ConsultationMode;
  /** Null until the first message. */
  lastMessageAt: string | null;
  /** Sender role of the latest message; null until first message. */
  lastMessageSenderRole: MessageSenderRole | null;
}

/**
 * Consultation chat message (text and/or file attachment).
 * Content is immutable; `readAt` may be set by the peer (Slice 5.13).
 */
export interface Message {
  id: string;
  consultationId: string;
  senderId: string;
  senderRole: MessageSenderRole;
  /** Null when the message is attachment-only. */
  body: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentMime: MessageAttachmentMime | null;
  attachmentSizeBytes: number | null;
  createdAt: string;
  /** When the peer first read this message; null until then. */
  readAt: string | null;
}

/** Metadata persisted on `messages` after a Storage upload. */
export interface MessageAttachmentInput {
  path: string;
  name: string;
  mime: MessageAttachmentMime;
  sizeBytes: number;
}

/** Patient / doctor sends a text and/or attachment message. */
export interface SendMessageInput {
  consultationId: string;
  body?: string | null;
  attachment?: MessageAttachmentInput | null;
}

/** Patient creates a Razorpay order for a `pending_payment` booking. */
export interface CreatePaymentOrderInput {
  bookingId: string;
}

/**
 * Checkout payload returned by `POST /payments/orders`.
 * `mode: 'dev_bypass'` when Razorpay keys are unset (local/dev only).
 */
export interface CreatePaymentOrderResult {
  mode: 'razorpay' | 'dev_bypass';
  paymentId: string;
  bookingId: string;
  amountPaise: number;
  currency: typeof BOOKING_CURRENCY;
  /** Present for Razorpay mode (public key id). */
  razorpayKeyId: string | null;
  /** Present for Razorpay mode. */
  razorpayOrderId: string | null;
  /**
   * Hosted Checkout.js page (open with WebBrowser).
   * Null in `dev_bypass` mode — call verify with empty gateway fields.
   */
  checkoutUrl: string | null;
}

/** Client → backend after Checkout success (or dev bypass). */
export interface VerifyPaymentInput {
  bookingId: string;
  paymentId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
}

export interface VerifyPaymentResult {
  booking: Booking;
  payment: Payment;
}

export interface CancelBookingResult {
  outcome: CancelBookingOutcome;
  cutoffHours: number;
  message: string;
  booking: Booking;
  /** True when a paid fee was refunded as part of free cancel. */
  refunded?: boolean;
}

/** Patient cancel via backend (handles refunds for paid bookings). */
export interface CancelBookingInput {
  bookingId: string;
  reason?: string | null;
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
  /** Defaults to `online` when omitted (pre-tab UI). */
  mode?: ConsultationMode;
}

/** Doctor creates a concrete open slot (manual or generated). */
export interface AppointmentSlotInput {
  startsAt: string;
  endsAt: string;
  availabilityId?: string | null;
  status?: Extract<SlotStatus, 'open' | 'blocked'>;
  /** Defaults to `online` when omitted (pre-tab UI). */
  mode?: ConsultationMode;
}

/** Audit log actions written by DB triggers / backend. */
export type AuditAction =
  | 'patient.created'
  | 'patient.profile_updated'
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.cancel_requested'
  | 'booking.payment_hold_expired'
  | 'booking.payment_confirmed'
  | 'booking.pending_admin'
  | 'booking.rejected'
  | 'booking.admin_assigned'
  | 'payment.created'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.refunded'
  | 'refund.requested'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'consultation.created'
  | 'consultation.status_updated'
  | 'message.sent'
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
  specialty?: string | null;
  degrees?: string | null;
  consultation_fee_paise?: number;
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
    specialty: row.specialty?.trim() || 'ENT Specialist',
    degrees: row.degrees?.trim() || 'MBBS, MS (ENT)',
    consultationFeePaise:
      typeof row.consultation_fee_paise === 'number'
        ? row.consultation_fee_paise
        : CONSULTATION_FEE_DEFAULT_PAISE,
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
  mode?: ConsultationMode;
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
  mode?: ConsultationMode;
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  slot_id: string | null;
  patient_id: string;
  doctor_id: string;
  status: BookingStatus;
  mode?: ConsultationMode;
  payment_method?: BookingPaymentMethod | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancel_request_at: string | null;
  cancel_request_note: string | null;
  billing_channel?: BillingChannel | null;
  payment_status?: BookingPaymentStatus;
  amount_paise?: number | null;
  currency?: string;
  preferred_starts_at?: string | null;
  preferred_ends_at?: string | null;
  preferred_note?: string | null;
  reject_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  booking_id: string;
  patient_id: string;
  amount_paise: number;
  currency: string;
  status: PaymentRecordStatus;
  gateway: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  gateway_refund_id?: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundRow {
  id: string;
  payment_id: string;
  booking_id: string;
  patient_id: string;
  amount_paise: number;
  currency: string;
  status: RefundStatus;
  reason: RefundReason;
  gateway_refund_id: string | null;
  failure_reason: string | null;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationRow {
  id: string;
  booking_id: string;
  patient_id: string;
  doctor_id: string;
  status: ConsultationStatus;
  mode?: ConsultationMode;
  last_message_at: string | null;
  last_message_sender_role: MessageSenderRole | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  consultation_id: string;
  sender_id: string;
  sender_role: MessageSenderRole;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size_bytes: number | null;
  created_at: string;
  read_at?: string | null;
}

function asDayOfWeek(value: number): DayOfWeek {
  if (value >= 0 && value <= 6) return value as DayOfWeek;
  throw new Error(`Invalid day_of_week: ${value}`);
}

function asConsultationMode(value: ConsultationMode | undefined): ConsultationMode {
  return value === 'offline' ? 'offline' : 'online';
}

/** Chat is enabled only for online consultations (Slice 5.12). */
export function isChatEnabledForMode(mode: ConsultationMode): boolean {
  return mode === 'online';
}

/** Patient/doctor copy when an offline case has no messaging. */
export const OFFLINE_CHAT_UNAVAILABLE_COPY =
  'In-clinic visit — chat not available';

/** Normalize query/param values to a consultation mode (default online). */
export function parseConsultationMode(value: string | string[] | undefined | null): ConsultationMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'offline' ? 'offline' : 'online';
}

export function consultationModeLabel(mode: ConsultationMode): string {
  return mode === 'offline' ? 'Offline' : 'Online';
}

/** Patient/doctor-facing label for how a booking is paid. */
export function bookingPaymentMethodLabel(
  method: BookingPaymentMethod | null | undefined
): string {
  if (method === 'clinic') return 'Pay at clinic';
  if (method === 'online') return 'Pay online';
  return 'Payment';
}

/** Compact payment status for clinic / online bookings. */
export function bookingPaymentStatusLabel(booking: {
  paymentMethod: BookingPaymentMethod | null;
  paymentStatus: BookingPaymentStatus;
  status: BookingStatus;
}): string {
  if (booking.paymentMethod === 'clinic') {
    if (booking.paymentStatus === 'paid') return 'Paid at clinic';
    if (booking.paymentStatus === 'unpaid') return 'Pay at clinic';
  }
  if (booking.status === 'pending_payment') return 'Awaiting payment';
  if (booking.paymentStatus === 'paid') return 'Paid';
  if (booking.paymentStatus === 'unpaid') return 'Unpaid';
  return booking.paymentStatus;
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
    mode: asConsultationMode(row.mode),
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
    mode: asConsultationMode(row.mode),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBookingRow(row: BookingRow): Booking {
  const paymentMethod = row.payment_method;
  return {
    id: row.id,
    slotId: row.slot_id ?? null,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    status: row.status,
    mode: asConsultationMode(row.mode),
    paymentMethod:
      paymentMethod === 'online' || paymentMethod === 'clinic' ? paymentMethod : null,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    cancelRequestAt: row.cancel_request_at ?? null,
    cancelRequestNote: row.cancel_request_note ?? null,
    billingChannel: row.billing_channel ?? null,
    paymentStatus: row.payment_status ?? 'not_required',
    amountPaise: row.amount_paise ?? null,
    currency: BOOKING_CURRENCY,
    preferredStartsAt: row.preferred_starts_at ?? null,
    preferredEndsAt: row.preferred_ends_at ?? null,
    preferredNote: row.preferred_note ?? null,
    rejectReason: row.reject_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPaymentRow(row: PaymentRow): Payment {
  if (row.gateway !== 'razorpay') {
    throw new Error(`Unexpected payment gateway: ${row.gateway}`);
  }
  return {
    id: row.id,
    bookingId: row.booking_id,
    patientId: row.patient_id,
    amountPaise: row.amount_paise,
    currency: BOOKING_CURRENCY,
    status: row.status,
    gateway: 'razorpay',
    gatewayOrderId: row.gateway_order_id,
    gatewayPaymentId: row.gateway_payment_id,
    gatewaySignature: row.gateway_signature,
    gatewayRefundId: row.gateway_refund_id ?? null,
    failureReason: row.failure_reason,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRefundRow(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentId: row.payment_id,
    bookingId: row.booking_id,
    patientId: row.patient_id,
    amountPaise: row.amount_paise,
    currency: BOOKING_CURRENCY,
    status: row.status,
    reason: row.reason,
    gatewayRefundId: row.gateway_refund_id,
    failureReason: row.failure_reason,
    notes: row.notes,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConsultationRow(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    bookingId: row.booking_id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    status: row.status,
    mode: asConsultationMode(row.mode),
    lastMessageAt: row.last_message_at,
    lastMessageSenderRole: row.last_message_sender_role ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** True when the consultation belongs to a doctor case queue. */
export function consultationMatchesQueue(
  consultation: Pick<Consultation, 'status' | 'lastMessageSenderRole'>,
  queue: DoctorCaseQueue
): boolean {
  if (queue === 'all') return true;
  if (queue === 'unreplied') return consultation.status === 'open';
  return (
    consultation.status === 'in_progress' &&
    consultation.lastMessageSenderRole === 'patient'
  );
}

function asMessageAttachmentMime(value: string | null): MessageAttachmentMime | null {
  if (!value) return null;
  if ((MESSAGE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value)) {
    return value as MessageAttachmentMime;
  }
  return null;
}

export function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body ?? null,
    attachmentPath: row.attachment_path ?? null,
    attachmentName: row.attachment_name ?? null,
    attachmentMime: asMessageAttachmentMime(row.attachment_mime ?? null),
    attachmentSizeBytes: row.attachment_size_bytes ?? null,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
  };
}

/** Append a realtime/local message without duplicating by id. */
export function appendMessageIfNew(messages: Message[], next: Message): Message[] {
  if (messages.some((m) => m.id === next.id)) return messages;
  return [...messages, next];
}

/** Insert or replace a message by id (INSERT + read_at UPDATE from Realtime). */
export function upsertMessageById(messages: Message[], next: Message): Message[] {
  const idx = messages.findIndex((m) => m.id === next.id);
  if (idx === -1) return [...messages, next];
  const copy = messages.slice();
  copy[idx] = next;
  return copy;
}

/** Receipt label for the sender’s own bubble. */
export function messageReceiptLabel(message: Pick<Message, 'readAt'>): string {
  return message.readAt ? 'Seen' : 'Sent';
}

/** Case-list preview: body text, or a short attachment label. */
export function messageListPreview(
  message: Pick<Message, 'body' | 'attachmentName'> | null | undefined
): string | null {
  if (!message) return null;
  const body = message.body?.trim();
  if (body) return body;
  const name = message.attachmentName?.trim();
  if (name) return name;
  return null;
}

/** True when MIME is an image we can render inline. */
export function isImageAttachmentMime(
  mime: string | null | undefined
): mime is 'image/jpeg' | 'image/png' {
  return mime === 'image/jpeg' || mime === 'image/png';
}

/** Object path: `{consultationId}/{objectId}.{ext}`. */
export function consultationAttachmentObjectPath(
  consultationId: string,
  fileName: string,
  objectId: string = crypto.randomUUID()
): string {
  const rawExt = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase()
    : undefined;
  const safeExt =
    rawExt === 'pdf' || rawExt === 'png' || rawExt === 'jpeg' || rawExt === 'jpg'
      ? rawExt === 'jpeg'
        ? 'jpg'
        : rawExt
      : 'bin';
  return `${consultationId}/${objectId}.${safeExt}`;
}

/** Normalize browser/OS MIME quirks (e.g. empty type from extension). */
export function normalizeMessageAttachmentMime(
  mime: string | null | undefined,
  fileName: string
): MessageAttachmentMime | null {
  const lowered = mime?.toLowerCase().trim() ?? '';
  if ((MESSAGE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(lowered)) {
    return lowered as MessageAttachmentMime;
  }
  const ext = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase()
    : undefined;
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

/** Map RPC / backend cancel payload. */
export function mapCancelBookingResult(payload: {
  outcome: string;
  cutoffHours: number;
  message: string;
  booking: BookingRow;
  refunded?: boolean;
}): CancelBookingResult {
  if (payload.outcome !== 'cancelled' && payload.outcome !== 'contact_hospital') {
    throw new Error(`Unexpected cancel outcome: ${payload.outcome}`);
  }
  return {
    outcome: payload.outcome,
    cutoffHours: payload.cutoffHours,
    message: payload.message,
    booking: mapBookingRow(payload.booking),
    refunded: Boolean(payload.refunded),
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

/**
 * In-app notification kinds (Phase 5 Slice 5.14).
 * Email delivery can reuse these types later.
 */
export type NotificationType =
  | 'overflow.pending_admin'
  | 'overflow.accepted'
  | 'overflow.rejected'
  | 'overflow.assigned'
  | 'booking.offline_confirmed'
  | 'clinic.unpaid'
  | (string & {});

/** Recipient-facing in-app notification (`notifications` table). */
export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface AppNotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export function mapAppNotificationRow(row: AppNotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Deep-link hint for notification taps (apps map to routes). */
export function notificationHrefHint(notification: AppNotification): {
  kind: 'overflow' | 'clinic_payments' | 'booking' | 'bookings' | null;
  bookingId: string | null;
} {
  const bookingId =
    notification.entityType === 'bookings' && notification.entityId
      ? notification.entityId
      : null;

  switch (notification.type) {
    case 'overflow.pending_admin':
      return { kind: 'overflow', bookingId };
    case 'clinic.unpaid':
      return { kind: 'clinic_payments', bookingId };
    case 'overflow.accepted':
    case 'overflow.rejected':
      return { kind: 'booking', bookingId };
    case 'overflow.assigned':
    case 'booking.offline_confirmed':
      return { kind: 'bookings', bookingId };
    default:
      return { kind: bookingId ? 'booking' : null, bookingId };
  }
}
