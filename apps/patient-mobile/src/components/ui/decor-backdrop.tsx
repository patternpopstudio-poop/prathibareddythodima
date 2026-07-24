import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Soft green blobs + dot grids used on splash / auth screens. */
export function DecorBackdrop({ style }: Props) {
  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />
      <DotGrid style={styles.dotsTopLeft} />
      <DotGrid style={styles.dotsBottomRight} />
    </View>
  );
}

function DotGrid({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.dotGrid, style]}>
      {Array.from({ length: 20 }).map((_, i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: Colors.primary50,
  },
  blobTopRight: {
    width: 260,
    height: 260,
    top: -90,
    right: -70,
    opacity: 0.95,
  },
  blobBottomLeft: {
    width: 240,
    height: 240,
    bottom: -80,
    left: -90,
    opacity: 0.85,
  },
  dotGrid: {
    position: 'absolute',
    width: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dotsTopLeft: {
    top: 72,
    left: 28,
  },
  dotsBottomRight: {
    bottom: 120,
    right: 28,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
    opacity: 0.7,
  },
});
