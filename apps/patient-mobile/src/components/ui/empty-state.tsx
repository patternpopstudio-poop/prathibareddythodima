import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { IconBadge, type AppIconName } from '@/components/ui/icon';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  icon: AppIconName;
  title: string;
  description: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Lightweight empty state — icons instead of heavy illustration assets. */
export function EmptyState({ icon, title, description, style, children }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <IconBadge name={icon} size={28} badgeSize={72} />
      <AppText variant="bodyMedium" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="muted" style={styles.description}>
        {description}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  title: {
    textAlign: 'center',
    color: Colors.text,
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
});
