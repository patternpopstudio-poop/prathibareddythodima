import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

export default function LoginScreen() {
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
      // AuthProvider finishes loading the patient row before isLoading clears;
      // index then routes to home or onboarding based on profile_completed.
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="WELCOME BACK"
        title="Sign in"
        description="Use the email you registered with to continue."
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
        New here?{' '}
        <Link href="/(auth)/register" style={styles.link}>
          Create an account
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
