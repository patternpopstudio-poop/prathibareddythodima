import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: Variant;
};

export function Button({
  title,
  loading = false,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.white : Colors.primary900} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghost' && styles.labelGhost,
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primary: {
    backgroundColor: Colors.primary900,
  },
  secondary: {
    backgroundColor: Colors.primary50,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: FontFamily.label,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  labelPrimary: {
    color: Colors.white,
  },
  labelSecondary: {
    color: Colors.primary900,
  },
  labelGhost: {
    color: Colors.primary900,
  },
});
