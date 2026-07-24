import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  /** Leading calendar icon + chevron (basic-details redesign) */
  withIcons?: boolean;
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplay(value: string, withIcons: boolean): string {
  const date = parseDate(value);
  if (!date) return '';
  if (withIcons) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day} / ${month} / ${year}`;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DateField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Select date of birth',
  maximumDate = new Date(),
  minimumDate = new Date(1900, 0, 1),
  withIcons = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value) ?? new Date(1990, 0, 1);
  const displayPlaceholder = withIcons ? 'DD / MM / YYYY' : placeholder;

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (date) onChange(formatDate(date));
    if (Platform.OS === 'android') setOpen(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
        <View style={[styles.field, withIcons && styles.fieldIcons, error ? styles.fieldError : null]}>
          {withIcons ? <Icon name="calendar" size={18} color={Colors.gray400} /> : null}
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={displayPlaceholder}
            placeholderTextColor={Colors.placeholder}
            // @ts-expect-error web-only native input type
            type="date"
            max={formatDate(maximumDate)}
            min={formatDate(minimumDate)}
            style={[styles.webInput, withIcons && styles.webInputFlex]}
          />
          {withIcons ? <Icon name="chevronDown" size={18} color={Colors.gray400} /> : null}
        </View>
        {error ? <AppText variant="error">{error}</AppText> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.field, withIcons && styles.fieldIcons, error ? styles.fieldError : null]}>
        {withIcons ? <Icon name="calendar" size={18} color={Colors.gray400} /> : null}
        <AppText
          variant="body"
          style={[
            styles.value,
            withIcons && styles.valueFlex,
            !value && styles.placeholder,
          ]}>
          {value ? formatDisplay(value, withIcons) : displayPlaceholder}
        </AppText>
        {withIcons ? <Icon name="chevronDown" size={18} color={Colors.gray400} /> : null}
      </Pressable>
      {error ? <AppText variant="error">{error}</AppText> : null}

      {open ? (
        Platform.OS === 'ios' ? (
          <View style={styles.iosPicker}>
            <DateTimePicker
              mode="date"
              display="spinner"
              value={selected}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              themeVariant="light"
              onChange={handleChange}
            />
            <Pressable onPress={() => setOpen(false)} style={styles.doneButton}>
              <AppText variant="bodyMedium" style={styles.doneText}>
                Done
              </AppText>
            </Pressable>
          </View>
        ) : (
          <DateTimePicker
            mode="date"
            display="default"
            value={selected}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onChange={handleChange}
          />
        )
      ) : null}
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
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  fieldIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fieldError: {
    borderColor: Colors.accentRed,
    backgroundColor: '#fdf6f7',
  },
  webInput: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  webInputFlex: {
    flex: 1,
  },
  value: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  valueFlex: {
    flex: 1,
  },
  placeholder: {
    color: Colors.placeholder,
  },
  iosPicker: {
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    overflow: 'hidden',
  },
  doneButton: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  doneText: {
    color: Colors.primary900,
  },
});
