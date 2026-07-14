import { Image, type ImageProps } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type Props = {
  source: ImageProps['source'];
  height?: number;
  scrim?: string | false;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Image frame with optional dark scrim and overlaid content. */
export function MediaHero({
  source,
  height = 220,
  scrim = 'rgba(0,0,0,0.28)',
  children,
  style,
  contentStyle,
}: Props) {
  return (
    <View style={[styles.frame, { minHeight: height }, style]}>
      <Image source={source} style={styles.image} contentFit="cover" transition={250} />
      {scrim ? <View style={[styles.scrim, { backgroundColor: scrim }]} /> : null}
      {children ? <View style={[styles.content, contentStyle]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.primary50,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
