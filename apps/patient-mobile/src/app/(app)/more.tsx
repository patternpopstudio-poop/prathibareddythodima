import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type AppIconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const LINKS: {
  title: string;
  subtitle: string;
  icon: AppIconName;
  href: Href;
}[] = [
  {
    title: 'Notifications',
    subtitle: 'Offline requests and hospital updates',
    icon: 'mail',
    href: '/(app)/notifications',
  },
  {
    title: 'Prescriptions',
    subtitle: 'View issued prescriptions',
    icon: 'medication',
    href: '/(app)/prescriptions',
  },
  {
    title: 'Lab reports',
    subtitle: 'Reports and uploads',
    icon: 'lab',
    href: '/(app)/lab-reports',
  },
  {
    title: 'My health profile',
    subtitle: 'Details and medical history',
    icon: 'person',
    href: '/(app)/profile',
  },
];

export default function MoreScreen() {
  const { signOut } = useAuth();

  return (
    <Screen>
      <ScreenNav title="More" />

      <Card style={styles.card} padded={false}>
        {LINKS.map((link, index) => (
          <Pressable
            key={link.title}
            accessibilityRole="button"
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowBorder,
              pressed && styles.pressed,
            ]}>
            <Icon name={link.icon} size={20} color={Colors.primary900} />
            <View style={styles.copy}>
              <AppText variant="bodyMedium">{link.title}</AppText>
              <AppText variant="muted" style={styles.sub}>
                {link.subtitle}
              </AppText>
            </View>
            <Icon name="chevron" size={18} color={Colors.gray400} />
          </Pressable>
        ))}
      </Card>

      <Button
        title="Sign out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: Radius.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    backgroundColor: Colors.primary50,
  },
});
