export type RegisterFormValues = {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
};

export type RegisterFieldErrors = Partial<Record<keyof RegisterFormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[0-9]{10,15}$/;

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
