import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
};

/** Shared screen intro: eyebrow + title + optional support copy. */
export function PageHeader({ eyebrow, title, description, style }: Props) {
  return (
    <View style={[styles.header, style]}>
      <AppText variant="eyebrow">{eyebrow}</AppText>
      <AppText variant="h2">{title}</AppText>
      {description ? <AppText variant="muted">{description}</AppText> : null}
    </View>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeading({ title, description, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      <AppText variant="h3">{title}</AppText>
      {description ? <AppText variant="muted">{description}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
  },
});
