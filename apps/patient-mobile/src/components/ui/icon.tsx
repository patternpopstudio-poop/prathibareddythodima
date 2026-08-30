import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

export type AppIconName =
  | 'person'
  | 'calendar'
  | 'clock'
  | 'star'
  | 'stethoscope'
  | 'hearing'
  | 'medication'
  | 'lab'
  | 'notes'
  | 'hospital'
  | 'chevron'
  | 'chevronDown'
  | 'chevronLeft'
  | 'logout'
  | 'health'
  | 'ear'
  | 'nose'
  | 'throat'
  | 'specialty'
  | 'pediatric'
  | 'book'
  | 'home'
  | 'homeOutline'
  | 'messages'
  | 'more'
  | 'search'
  | 'shield'
  | 'lock'
  | 'support'
  | 'globe'
  | 'check'
  | 'heart'
  | 'insurance'
  | 'mail'
  | 'pin'
  | 'video'
  | 'eye'
  | 'eyeOff';

type IconDef = {
  ios: string;
  material?: keyof typeof MaterialIcons.glyphMap;
  community?: keyof typeof MaterialCommunityIcons.glyphMap;
};

const ICONS: Record<AppIconName, IconDef> = {
  person: { ios: 'person', material: 'person-outline' },
  calendar: { ios: 'calendar.badge.checkmark', material: 'event-available' },
  clock: { ios: 'clock', material: 'schedule' },
  star: { ios: 'star.fill', material: 'star' },
  stethoscope: { ios: 'stethoscope', community: 'stethoscope' },
  hearing: { ios: 'ear', material: 'hearing' },
  medication: { ios: 'pills', material: 'medication' },
  lab: { ios: 'flask', material: 'science' },
  notes: { ios: 'doc.text', material: 'description' },
  hospital: { ios: 'cross.case.fill', material: 'local-hospital' },
  chevron: { ios: 'chevron.right', material: 'chevron-right' },
  chevronDown: { ios: 'chevron.down', material: 'keyboard-arrow-down' },
  chevronLeft: { ios: 'chevron.left', material: 'chevron-left' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', material: 'logout' },
  health: { ios: 'heart.fill', material: 'favorite' },
  ear: { ios: 'ear', material: 'hearing' },
  nose: { ios: 'wind', community: 'weather-windy' },
  throat: { ios: 'mic.fill', material: 'record-voice-over' },
  specialty: { ios: 'cross.vial.fill', community: 'needle' },
  pediatric: { ios: 'figure.and.child.holdinghands', material: 'child-care' },
  book: { ios: 'calendar.badge.plus', material: 'event-available' },
  home: { ios: 'house.fill', material: 'home' },
  homeOutline: { ios: 'house', community: 'home-outline' },
  messages: { ios: 'ellipsis.bubble', community: 'dots-horizontal-circle-outline' },
  more: { ios: 'ellipsis', material: 'more-horiz' },
  search: { ios: 'magnifyingglass', material: 'search' },
  shield: { ios: 'checkmark.shield.fill', material: 'verified-user' },
  lock: { ios: 'lock.fill', material: 'lock' },
  support: { ios: 'headphones', material: 'headset-mic' },
  globe: { ios: 'globe', material: 'language' },
  check: { ios: 'checkmark', material: 'check' },
  heart: { ios: 'heart.fill', material: 'favorite' },
  insurance: { ios: 'shield.fill', material: 'health-and-safety' },
  mail: { ios: 'envelope.fill', material: 'mail' },
  pin: { ios: 'mappin.and.ellipse', material: 'location-on' },
  video: { ios: 'video.fill', community: 'video-outline' },
  eye: { ios: 'eye', material: 'visibility' },
  eyeOff: { ios: 'eye.slash', material: 'visibility-off' },
};

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

function MaterialFallback({ name, size, color, style }: Required<Pick<Props, 'name' | 'size' | 'color'>> & Pick<Props, 'style'>) {
  const def = ICONS[name];

  if (def.community) {
    return <MaterialCommunityIcons name={def.community} size={size} color={color} style={style as never} />;
  }

  return <MaterialIcons name={def.material ?? 'help-outline'} size={size} color={color} style={style as never} />;
}

export function Icon({ name, size = 22, color = Colors.primary900, style }: Props) {
  const fallback = <MaterialFallback name={name} size={size} color={color} style={style} />;

  if (Platform.OS !== 'ios') {
    return fallback;
  }

  return (
    <SymbolView
      name={ICONS[name].ios as never}
      size={size}
      tintColor={color}
      style={style}
      weight="regular"
      fallback={fallback}
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
