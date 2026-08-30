import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  rightAccessory?: ReactNode;
};

export function TextField({ label, error, style, rightAccessory, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor={Colors.placeholder}
          style={[
            styles.input,
            rightAccessory ? styles.inputWithAccessory : null,
            error ? styles.inputError : null,
            style,
          ]}
          {...rest}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PasswordVisibilityToggle({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.accessoryPressed}>
      <Icon name={visible ? 'eyeOff' : 'eye'} size={22} color={Colors.gray500} />
    </Pressable>
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
  inputWithAccessory: {
    paddingRight: 48,
  },
  accessory: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessoryPressed: {
    opacity: 0.7,
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
