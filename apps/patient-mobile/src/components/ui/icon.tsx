import { SymbolView } from 'expo-symbols';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

export type AppIconName =
  | 'person'
  | 'calendar'
  | 'star'
  | 'stethoscope'
  | 'hearing'
  | 'medication'
  | 'lab'
  | 'notes'
  | 'hospital'
  | 'chevron'
  | 'logout'
  | 'health'
  | 'ear'
  | 'nose'
  | 'throat'
  | 'specialty'
  | 'pediatric'
  | 'book';

type PlatformSymbol = {
  ios: string;
  android: string;
  web: string;
};

const SYMBOLS: Record<AppIconName, PlatformSymbol> = {
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  stethoscope: { ios: 'stethoscope', android: 'stethoscope', web: 'stethoscope' },
  hearing: { ios: 'ear', android: 'hearing', web: 'hearing' },
  medication: { ios: 'pills.fill', android: 'medication', web: 'medication' },
  lab: { ios: 'flask.fill', android: 'lab_profile', web: 'lab_profile' },
  notes: { ios: 'doc.text.fill', android: 'clinical_notes', web: 'clinical_notes' },
  hospital: { ios: 'cross.case.fill', android: 'local_hospital', web: 'local_hospital' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  health: { ios: 'heart.fill', android: 'health_and_safety', web: 'health_and_safety' },
  ear: { ios: 'ear.fill', android: 'hearing', web: 'hearing' },
  nose: { ios: 'wind', android: 'air', web: 'air' },
  throat: { ios: 'mic.fill', android: 'record_voice_over', web: 'record_voice_over' },
  specialty: { ios: 'cross.vial.fill', android: 'vaccines', web: 'vaccines' },
  pediatric: { ios: 'figure.and.child.holdinghands', android: 'child_care', web: 'child_care' },
  book: { ios: 'calendar.badge.plus', android: 'event_available', web: 'event_available' },
};

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color = Colors.primary900, style }: Props) {
  return (
    <SymbolView
      // expo-symbols accepts platform maps; cast keeps our curated name list tidy
      name={SYMBOLS[name] as never}
      size={size}
      tintColor={color}
      style={style}
    />
  );
}

type BadgeProps = Props & {
  backgroundColor?: string;
  badgeSize?: number;
};

export function IconBadge({
  name,
  size = 22,
  color = Colors.primary900,
  backgroundColor = Colors.primary50,
  badgeSize = 48,
  style,
}: BadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { width: badgeSize, height: badgeSize, borderRadius: Radius.chip, backgroundColor },
        style,
      ]}>
      <Icon name={name} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
