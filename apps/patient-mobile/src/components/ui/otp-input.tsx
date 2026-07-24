import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
};

export function OtpInput({ value, onChange, autoFocus = true }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  function handleChange(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, LENGTH);
    onChange(cleaned);
  }

  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === 'Backspace' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {digits.map((digit, index) => {
        const filled = digit.trim().length > 0;
        const focused =
          index === value.length || (value.length === LENGTH && index === LENGTH - 1);
        return (
          <View
            key={index}
            style={[styles.box, focused && styles.boxFocused, filled && styles.boxFilled]}>
            {filled ? <Text style={styles.digit}>{digit}</Text> : null}
            {!filled && focused ? <View style={styles.caretBar} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onKeyPress={handleKeyPress}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  box: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 1,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    borderColor: Colors.primary900,
  },
  boxFilled: {
    borderColor: Colors.primary600,
  },
  digit: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  caretBar: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: Colors.primary900,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
