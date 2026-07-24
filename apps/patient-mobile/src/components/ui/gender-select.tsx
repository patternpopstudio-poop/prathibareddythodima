import type { Gender } from '@teleconsult/shared-types';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

const OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

type Props = {
  label?: string;
  value: Gender | null;
  onChange: (value: Gender) => void;
  error?: string | null;
};

export function GenderSelect({ label = 'Gender', value, onChange, error }: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}>
              <Icon
                name="person"
                size={16}
                color={selected ? Colors.primary900 : Colors.gray400}
              />
              <AppText
                variant="bodyMedium"
                style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
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
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
  },
  chipSelected: {
    borderColor: Colors.primary900,
    backgroundColor: Colors.primary50,
  },
  pressed: {
    opacity: 0.88,
  },
  chipText: {
    fontSize: 14,
    color: Colors.gray600,
  },
  chipTextSelected: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
});
