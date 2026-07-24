import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: Variant;
  /** Trailing chevron — used on Continue / Book CTAs in the redesign */
  showArrow?: boolean;
};

export function Button({
  title,
  loading = false,
  variant = 'primary',
  showArrow = false,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  const labelColor = variant === 'primary' ? Colors.white : Colors.primary900;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'outline' && styles.outline,
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.row}>
          <Text
            style={[
              styles.label,
              variant === 'primary' && styles.labelPrimary,
              variant === 'secondary' && styles.labelSecondary,
              variant === 'ghost' && styles.labelGhost,
              variant === 'outline' && styles.labelOutline,
            ]}>
            {title}
          </Text>
          {showArrow ? (
            <View style={styles.arrowSlot}>
              <Icon
                name="chevron"
                size={18}
                color={variant === 'primary' ? Colors.white : Colors.primary900}
              />
            </View>
          ) : null}
        </View>
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
  outline: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  labelOutline: {
    color: Colors.text,
  },
  arrowSlot: {
    position: 'absolute',
    right: 0,
  },
});
