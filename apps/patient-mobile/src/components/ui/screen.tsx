import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type Props = ViewProps & {
  scroll?: boolean;
  /** Soft olive wash behind content — keeps palette, adds depth */
  ambient?: boolean;
  /** Horizontal + vertical content padding (default true). */
  padded?: boolean;
};

export function Screen({
  children,
  style,
  scroll = true,
  ambient = true,
  padded = true,
  ...rest
}: Props) {
  const contentStyle = [styles.scrollContent, !padded && styles.scrollContentFlush];

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, ...contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {ambient ? (
        <View pointerEvents="none" style={styles.ambient}>
          <View style={[styles.blob, styles.blobTop]} />
          <View style={[styles.blob, styles.blobSide]} />
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.flex, style]} {...rest}>
          {content}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  ambient: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    width: 280,
    height: 280,
    top: -80,
    right: -60,
    backgroundColor: Colors.primary50,
    opacity: 0.95,
  },
  blobSide: {
    width: 220,
    height: 220,
    bottom: 80,
    left: -90,
    backgroundColor: Colors.primary100,
    opacity: 0.55,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  scrollContentFlush: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
});
