import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandImages } from '@/constants/images';
import { Colors, Radius } from '@/constants/theme';

/** Exact splash from the design mockup — edge-to-edge. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0.28));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) router.replace('/(auth)/login');
    });
  }, [progress]);

  function goLogin() {
    router.replace('/(auth)/login');
  }

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['28%', '100%'],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Pressable
        style={styles.press}
        accessibilityRole="button"
        accessibilityLabel="Continue to login"
        onPress={goLogin}>
        <Image
          source={BrandImages.splash}
          style={styles.art}
          contentFit="cover"
          contentPosition="center"
          transition={0}
        />

        <View style={[styles.progressWrap, { bottom: Math.max(insets.bottom, 12) + 10 }]}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.splashBackground,
  },
  press: {
    flex: 1,
  },
  art: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  progressWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
  },
  progressTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(107, 174, 61, 0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary900,
  },
});
