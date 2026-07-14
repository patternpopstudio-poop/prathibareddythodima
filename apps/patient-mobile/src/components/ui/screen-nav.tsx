import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  onBack?: () => void;
};

export function ScreenNav({ title, onBack }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack ?? (() => router.back())}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
        <Icon name="chevron" size={20} color={Colors.primary900} style={styles.backIcon} />
      </Pressable>
      <AppText variant="h3">{title}</AppText>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  spacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.85,
  },
});
