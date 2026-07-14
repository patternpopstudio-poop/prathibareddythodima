import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/contexts/auth-context';
import { Colors, Radius, Spacing } from '@/constants/theme';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { resendConfirmation } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onResend() {
    if (!email) {
      setError('Missing email address. Go back and register again.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await resendConfirmation(email);
      setMessage('Confirmation email sent again. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.icon}>
          <View style={styles.iconDot} />
        </View>
        <PageHeader
          eyebrow="ALMOST THERE"
          title="Verify your email"
          description={`We sent a confirmation link${email ? ` to ${email}` : ''}. Confirm your email before signing in — your account stays inactive until then.`}
          style={styles.pageHeader}
        />
      </View>

      <Card style={styles.card}>
        {message ? (
          <View style={styles.successBanner}>
            <AppText variant="bodyMedium" style={styles.successText}>
              {message}
            </AppText>
          </View>
        ) : null}
        {error ? <AppText variant="error">{error}</AppText> : null}
        <Button title="Resend confirmation" loading={loading} onPress={onResend} />
        <Link href="/(auth)/login" asChild>
          <Button title="I have verified — sign in" variant="secondary" />
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: Spacing.xl,
  },
  pageHeader: {
    marginTop: 0,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  iconDot: {
    width: 14,
    height: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary900,
  },
  card: {
    gap: Spacing.md,
  },
  successBanner: {
    backgroundColor: Colors.primary50,
    borderRadius: Radius.input,
    padding: Spacing.md,
  },
  successText: {
    color: Colors.primary900,
  },
});
