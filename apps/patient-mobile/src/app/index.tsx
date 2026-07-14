import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const { session, patient, isLoading } = useAuth();

  // Wait until session AND patient profile are resolved. Otherwise a brief
  // null patient after login is mistaken for "profile incomplete".
  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={Colors.primary900} size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!patient?.profileCompleted) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return <Redirect href="/(app)/home" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
