import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maximumDate?: Date;
  minimumDate?: Date;
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

function formatDisplay(value: string): string {
  const date = parseDate(value);
  if (!date) return '';
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
  maximumDate = new Date(),
  minimumDate = new Date(1900, 0, 1),
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value) ?? new Date(1990, 0, 1);

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
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Select date of birth"
          placeholderTextColor={Colors.placeholder}
          // @ts-expect-error web-only native input type
          type="date"
          max={formatDate(maximumDate)}
          min={formatDate(minimumDate)}
          style={[styles.input, styles.webInput, error ? styles.inputError : null]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.input, error ? styles.inputError : null]}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatDisplay(value) : 'Select date of birth'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
              <Text style={styles.doneText}>Done</Text>
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
    justifyContent: 'center',
  },
  webInput: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.accentRed,
    backgroundColor: '#fdf6f7',
  },
  value: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.text,
  },
  placeholder: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.placeholder,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.accentRed,
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
    fontFamily: FontFamily.label,
    fontSize: 16,
    color: Colors.primary900,
  },
});
