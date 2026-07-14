import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import { getInitials } from '@/lib/patient-display';

type Props = Omit<PressableProps, 'children'> & {
  name?: string | null;
  size?: number;
};

export function InitialsAvatar({ name, size = 52, style, ...rest }: Props) {
  const initials = getInitials(name);
  const fontSize = size >= 60 ? 20 : 16;

  return (
    <Pressable
      accessibilityRole={rest.onPress ? 'button' : undefined}
      style={(state) => [
        styles.avatar,
        { width: size, height: size },
        state.pressed && rest.onPress ? styles.pressed : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <AppText
        variant="bodyMedium"
        style={[styles.text, { fontSize, lineHeight: fontSize + 4 }]}>
        {initials}
      </AppText>
    </Pressable>
  );
}

/** Non-pressable avatar for static display (profile header). */
export function InitialsAvatarStatic({ name, size = 64 }: { name?: string | null; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      <AppText variant="h3" style={styles.text}>
        {getInitials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary50,
    borderWidth: 2,
    borderColor: Colors.primary400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
  pressed: {
    opacity: 0.88,
  },
});
