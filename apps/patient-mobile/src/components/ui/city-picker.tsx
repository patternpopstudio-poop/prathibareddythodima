import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { IconTextField } from '@/components/ui/icon-text-field';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

/** Common Indian cities for v1 location picker — expand later as needed. */
export const CITY_OPTIONS = [
  'Hyderabad',
  'Bengaluru',
  'Chennai',
  'Mumbai',
  'Delhi',
  'Pune',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Kochi',
  'Visakhapatnam',
  'Warangal',
  'Vijayawada',
  'Other',
] as const;

type Props = {
  label?: string;
  value: string;
  onChange: (city: string) => void;
  error?: string | null;
};

export function CityPicker({
  label = 'Location',
  value,
  onChange,
  error,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
        <View pointerEvents="none">
          <IconTextField
            label={label}
            icon="pin"
            value={value}
            placeholder="Select your city"
            editable={false}
            error={error}
            trailing={<Icon name="chevronDown" size={18} color={Colors.gray400} />}
          />
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <View style={styles.sheetHeader}>
            <AppText variant="h3">Select your city</AppText>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <AppText variant="bodyMedium" style={styles.close}>
                Close
              </AppText>
            </Pressable>
          </View>
          <FlatList
            data={CITY_OPTIONS}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}>
                  <AppText
                    variant="bodyMedium"
                    style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {item}
                  </AppText>
                  {selected ? <Icon name="check" size={18} color={Colors.primary900} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  sheet: {
    maxHeight: '55%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  close: {
    color: Colors.primary900,
  },
  option: {
    minHeight: 48,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: {
    backgroundColor: Colors.primary50,
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
  },
  optionTextSelected: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
  pressed: {
    opacity: 0.88,
  },
});
