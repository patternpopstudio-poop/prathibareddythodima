import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Brand, Colors, Spacing } from '@/constants/theme';

type Props = {
  /** stacked = logo above name (splash); inline = logo + name row */
  variant?: 'stacked' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  /** Green mark only — used on basic-details / compact auth headers */
  markOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

const MARK = {
  sm: 36,
  md: 56,
  lg: 72,
} as const;

export function BrandLogo({
  variant = 'inline',
  size = 'md',
  showTagline = true,
  markOnly = false,
  style,
}: Props) {
  const markSize = MARK[size];
  const crossArm = Math.round(markSize * 0.18);
  const crossLong = Math.round(markSize * 0.46);

  const mark = (
    <View style={[styles.mark, { width: markSize, height: markSize, borderRadius: markSize / 2 }]}>
      <View
        style={[
          styles.crossVertical,
          {
            width: crossArm,
            height: crossLong,
            borderRadius: crossArm / 2,
          },
        ]}
      />
      <View
        style={[
          styles.crossHorizontal,
          {
            width: crossLong,
            height: crossArm,
            borderRadius: crossArm / 2,
          },
        ]}
      />
      <View
        style={[
          styles.leaf,
          {
            width: Math.round(markSize * 0.16),
            height: Math.round(markSize * 0.22),
            right: Math.round(markSize * 0.18),
            top: Math.round(markSize * 0.22),
          },
        ]}
      />
    </View>
  );

  if (markOnly) {
    return <View style={style}>{mark}</View>;
  }

  return (
    <View style={[variant === 'stacked' ? styles.stacked : styles.inline, style]}>
      {mark}

      <View style={variant === 'stacked' ? styles.copyStacked : styles.copyInline}>
        <AppText
          variant={size === 'lg' ? 'h2' : 'h3'}
          style={[styles.name, size === 'sm' && styles.nameSm]}>
          {Brand.name}
        </AppText>
        {showTagline ? (
          <AppText variant="muted" style={[styles.tagline, size === 'sm' && styles.taglineSm]}>
            {Brand.tagline}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stacked: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mark: {
    backgroundColor: Colors.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crossVertical: {
    position: 'absolute',
    backgroundColor: Colors.white,
  },
  crossHorizontal: {
    position: 'absolute',
    backgroundColor: Colors.white,
  },
  leaf: {
    position: 'absolute',
    backgroundColor: Colors.primary100,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 10,
    transform: [{ rotate: '28deg' }],
  },
  copyStacked: {
    alignItems: 'center',
    gap: 4,
  },
  copyInline: {
    gap: 2,
    flexShrink: 1,
  },
  name: {
    color: Colors.primary900,
    letterSpacing: -0.4,
  },
  nameSm: {
    fontSize: 18,
    lineHeight: 22,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  taglineSm: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'left',
  },
});
