import { needsBasicDetails } from '@teleconsult/shared-types';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const { session, patient, isLoading } = useAuth();

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

  if (needsBasicDetails(patient)) {
    return <Redirect href="/(onboarding)/basic-details" />;
  }

  // Health profile remains optional and is nudged from home / profile.
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
