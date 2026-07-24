import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { InitialsAvatarStatic } from '@/components/ui/initials-avatar';
import { Colors, Radius } from '@/constants/theme';

type Props = {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
};

export function DoctorAvatar({ name, photoUrl, size = 56 }: Props) {
  if (photoUrl?.trim()) {
    return (
      <Image
        source={{ uri: photoUrl.trim() }}
        style={[
          styles.photo,
          {
            width: size,
            height: size,
            borderRadius: size >= 72 ? Radius.card : Radius.pill,
          },
        ]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={name ? `${name} photo` : 'Doctor photo'}
      />
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <InitialsAvatarStatic name={name} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    backgroundColor: Colors.primary50,
    borderWidth: 2,
    borderColor: Colors.primary400,
  },
});
