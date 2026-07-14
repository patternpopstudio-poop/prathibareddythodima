import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors.placeholder}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    letterSpacing: 0.3,
    color: Colors.gray600,
  },
  input: {
    minHeight: 52,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.accentRed,
    backgroundColor: '#fdf6f7',
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.accentRed,
  },
});
