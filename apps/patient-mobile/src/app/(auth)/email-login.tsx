import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

/** Secondary email/password path kept for existing B2C accounts. */
export default function EmailLoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="EMAIL"
        title="Sign in with email"
        description="Use the email and password from your account registration."
        style={styles.header}
      />

      <Card style={styles.card}>
        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <AppText variant="error">{error}</AppText> : null}
        <Button title="Sign in" loading={loading} onPress={onSubmit} />
      </Card>

      <AppText variant="muted" style={styles.footer}>
        <Link href="/(auth)/login" style={styles.link}>
          Back to mobile login
        </Link>
        {' · '}
        <Link href="/(auth)/register" style={styles.link}>
          Create account
        </Link>
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: Spacing.xl,
  },
  card: {
    gap: Spacing.md,
  },
  footer: {
    textAlign: 'center',
  },
  link: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
});
