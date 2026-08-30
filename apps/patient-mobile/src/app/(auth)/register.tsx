import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { PasswordVisibilityToggle, TextField } from '@/components/ui/text-field';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  validateRegisterForm,
  type RegisterFieldErrors,
} from '@/lib/register-validation';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function clearFieldError(field: keyof RegisterFieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function onSubmit() {
    setError(null);

    const errors = validateRegisterForm({
      fullName,
      email,
      mobile,
      password,
    });

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp({
        fullName,
        email,
        mobile: mobile.trim().replace(/[\s-]/g, ''),
        password,
      });

      if (result.needsEmailConfirmation) {
        router.replace({
          pathname: '/(auth)/verify-email',
          params: { email: email.trim().toLowerCase() },
        });
      } else {
        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="GET STARTED"
        title="Create account"
        description="A few details to get you booking — you can add your health profile later."
      />

      <Card style={styles.card}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            clearFieldError('fullName');
          }}
          autoComplete="name"
          error={fieldErrors.fullName}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearFieldError('email');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <TextField
          label="Mobile number"
          value={mobile}
          onChangeText={(text) => {
            setMobile(text);
            clearFieldError('mobile');
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          error={fieldErrors.mobile}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearFieldError('password');
          }}
          secureTextEntry={!passwordVisible}
          autoComplete="new-password"
          error={fieldErrors.password}
          rightAccessory={
            <PasswordVisibilityToggle
              visible={passwordVisible}
              onPress={() => setPasswordVisible((v) => !v)}
            />
          }
        />
        {error ? <AppText variant="error">{error}</AppText> : null}
        <Button title="Create account" loading={loading} onPress={onSubmit} />
      </Card>

      <AppText variant="muted" style={styles.footer}>
        Already registered?{' '}
        <Link href="/(auth)/login" style={styles.link}>
          Sign in
        </Link>
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
