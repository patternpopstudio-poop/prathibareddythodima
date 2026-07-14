import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';

type Variant =
  | 'display'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyMedium'
  | 'label'
  | 'eyebrow'
  | 'section'
  | 'muted'
  | 'error';

type Props = TextProps & {
  variant?: Variant;
};

export function AppText({ variant = 'body', style, ...rest }: Props) {
  return <Text style={[styles.base, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    color: Colors.text,
  },
  display: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
  },
  h2: {
    fontFamily: FontFamily.heading,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
  },
  h3: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  eyebrow: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    color: Colors.primary900,
  },
  section: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.1,
    color: Colors.primary900,
  },
  muted: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.accentRed,
  },
});
