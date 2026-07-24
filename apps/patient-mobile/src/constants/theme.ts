/**
 * Design tokens — docs/DESIGN_SYSTEM.md
 * Fresh grass-green palette aligned with TeleConsult redesign mockups.
 */

export const Colors = {
  /** Matches splash / TeleConsult mockup green (~#6BAE3D) */
  primary900: '#6bae3d',
  primary700: '#5c9a32',
  primary600: '#7bbc52',
  primary400: '#9fd07a',
  primary100: '#e5f3d8',
  primary50: '#f2f8eb',
  black: '#111827',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5363',
  gray500Alt: '#838996',
  accentRed: '#a6021a',
  /** Splash / auth canvas from mockup */
  splashBackground: '#fafaf8',
  /** Page canvas — soft gray for app shell; auth screens may use white */
  background: '#f5f6f8',
  /** Card / input surface */
  surface: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  placeholder: '#9ca3af',
} as const;

export const FontFamily = {
  /** Display / H1 — Stack Sans Headline unavailable as package; Manrope used with display sizing */
  display: 'Manrope_600SemiBold',
  heading: 'Manrope_600SemiBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  label: 'Manrope_600SemiBold',
} as const;

export const Radius = {
  input: 14,
  button: 16,
  card: 24,
  chip: 12,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  soft: {
    shadowColor: '#4c9a2a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 2,
  },
} as const;

export const Brand = {
  name: 'TeleConsult',
  tagline: 'Expert Care. Anywhere. Anytime.',
  footerTagline: 'Connecting Care, Building Healthier Tomorrows',
} as const;
