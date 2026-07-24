import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type AppIconName } from '@/components/ui/icon';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  icon: AppIconName;
  error?: string | null;
  trailing?: ReactNode;
};

export function IconTextField({
  label,
  icon,
  error,
  trailing,
  style,
  editable = true,
  ...rest
}: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.field, error ? styles.fieldError : null, !editable && styles.fieldReadonly]}>
        <Icon name={icon} size={18} color={Colors.gray400} />
        <TextInput
          {...rest}
          editable={editable}
          placeholderTextColor={Colors.placeholder}
          style={[styles.input, style]}
        />
        {trailing}
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
    fontSize: 13,
  },
  field: {
    minHeight: 52,
    borderRadius: 14,
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
  fieldReadonly: {
    backgroundColor: Colors.gray50,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
});
