import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
};

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: Colors.primary900,
    backgroundColor: Colors.primary50,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.gray600,
  },
  chipTextSelected: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.accentRed,
  },
});
