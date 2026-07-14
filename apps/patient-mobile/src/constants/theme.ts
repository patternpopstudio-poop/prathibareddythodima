/**
 * Design tokens — docs/DESIGN_SYSTEM.md
 * Colors are canonical; radius/shadow/spacing refined for a calmer modern feel.
 */

export const Colors = {
  primary900: '#49630b',
  primary700: '#5b7a12',
  primary600: '#68852a',
  primary400: '#8fb837',
  primary50: '#f0f5e4',
  black: '#000000',
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
  /** Page canvas */
  background: '#f3f4f6',
  /** Card / input surface */
  surface: '#ffffff',
  text: '#000000',
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
    shadowColor: '#49630b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
} as const;
