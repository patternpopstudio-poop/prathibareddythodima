import type { Gender } from '@teleconsult/shared-types';

export type RegisterFormValues = {
  fullName: string;
  dateOfBirth: string;
  gender: Gender | null;
  email: string;
  mobile: string;
  password: string;
};

export type RegisterFieldErrors = Partial<Record<keyof RegisterFormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[0-9]{10,15}$/;

function parseDob(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageFromDob(dob: Date, today = new Date()): number {
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function validateRegisterForm(values: RegisterFormValues): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const mobile = values.mobile.trim().replace(/[\s-]/g, '');

  if (!fullName) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.length < 2) {
    errors.fullName = 'Enter your full name.';
  }

  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else {
    const dob = parseDob(values.dateOfBirth);
    if (!dob) {
      errors.dateOfBirth = 'Select a valid date of birth.';
    } else if (dob > new Date()) {
      errors.dateOfBirth = 'Date of birth cannot be in the future.';
    } else if (ageFromDob(dob) < 13) {
      errors.dateOfBirth = 'You must be at least 13 years old.';
    }
  }

  if (!values.gender) {
    errors.gender = 'Please select a gender option.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!mobile) {
    errors.mobile = 'Mobile number is required.';
  } else if (!MOBILE_RE.test(mobile)) {
    errors.mobile = 'Enter a valid mobile number (10–15 digits).';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
}
