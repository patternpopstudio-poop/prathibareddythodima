import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Props = Omit<TextInputProps, 'keyboardType'> & {
  label?: string;
  error?: string | null;
};

export function PhoneField({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <View style={styles.code}>
          <AppText variant="bodyMedium" style={styles.flag}>
            🇮🇳
          </AppText>
          <AppText variant="bodyMedium" style={styles.codeText}>
            +91
          </AppText>
          <Icon name="chevron" size={14} color={Colors.gray400} style={styles.chevron} />
        </View>
        <View style={styles.divider} />
        <TextInput
          {...rest}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={10}
          placeholderTextColor={Colors.placeholder}
          style={[styles.input, style]}
        />
      </View>
      {error ? <AppText variant="error">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
  },
  label: {
    color: Colors.gray600,
    letterSpacing: 0,
  },
  field: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  fieldError: {
    borderColor: Colors.accentRed,
  },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flag: {
    fontSize: 18,
    lineHeight: 22,
  },
  codeText: {
    fontSize: 15,
  },
  chevron: {
    transform: [{ rotate: '90deg' }],
    marginLeft: 2,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.gray200,
    marginHorizontal: 2,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
});