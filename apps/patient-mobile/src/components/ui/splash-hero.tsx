import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Colors, Radius, Shadow } from '@/constants/theme';

/** Composed splash illustration approximating the mockup (phone + care icons). */
export function SplashHero() {
  return (
    <View style={styles.wrap}>
      <View style={styles.base} />
      <View style={styles.phone}>
        <View style={styles.phoneScreen}>
          <Icon name="calendar" size={36} color={Colors.primary900} />
          <View style={styles.checkBadge}>
            <Icon name="check" size={14} color={Colors.white} />
          </View>
        </View>
      </View>
      <View style={styles.stethoscope}>
        <Icon name="stethoscope" size={42} color={Colors.primary700} />
      </View>
      <View style={styles.plant}>
        <View style={styles.pot} />
        <Icon name="health" size={28} color={Colors.primary900} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 280,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  base: {
    position: 'absolute',
    bottom: 24,
    width: 180,
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.primary50,
  },
  phone: {
    width: 120,
    height: 200,
    borderRadius: 22,
    backgroundColor: Colors.primary100,
    borderWidth: 3,
    borderColor: Colors.primary400,
    padding: 10,
    ...Shadow.soft,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stethoscope: {
    position: 'absolute',
    left: 18,
    bottom: 48,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  plant: {
    position: 'absolute',
    right: 28,
    bottom: 52,
    alignItems: 'center',
    gap: 2,
  },
  pot: {
    position: 'absolute',
    bottom: -4,
    width: 28,
    height: 18,
    borderRadius: Radius.chip,
    backgroundColor: Colors.gray200,
  },
});
