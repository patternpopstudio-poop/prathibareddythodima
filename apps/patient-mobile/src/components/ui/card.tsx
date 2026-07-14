import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

type Props = ViewProps & {
  padded?: boolean;
};

export function Card({ style, padded = true, ...rest }: Props) {
  return <View style={[styles.card, padded && styles.padded, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  padded: {
    padding: Spacing.lg,
  },
});
