import type { Gender } from '@teleconsult/shared-types';

export type BasicDetailsValues = {
  fullName: string;
  dateOfBirth: string;
  gender: Gender | null;
  email: string;
  city: string;
};

export type BasicDetailsFieldErrors = Partial<
  Record<'fullName' | 'dateOfBirth' | 'gender' | 'email' | 'city', string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBasicDetails(values: BasicDetailsValues): BasicDetailsFieldErrors {
  const errors: BasicDetailsFieldErrors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const city = values.city.trim();

  if (!fullName) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.length < 2) {
    errors.fullName = 'Enter your full name.';
  }

  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth)) {
    errors.dateOfBirth = 'Enter a valid date of birth.';
  }

  if (!values.gender) {
    errors.gender = 'Select your gender.';
  }

  if (email && !EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!city) {
    errors.city = 'Select your city.';
  }

  return errors;
}
