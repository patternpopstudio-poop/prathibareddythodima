import { Image } from 'expo-image';
import { Link, router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Button } from '@/components/ui/button';
import { DecorBackdrop } from '@/components/ui/decor-backdrop';
import { Icon } from '@/components/ui/icon';
import { PhoneField } from '@/components/ui/phone-field';
import { BrandImages } from '@/constants/images';
import { Colors, FontFamily, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { toE164Phone } from '@/lib/phone';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithPhoneOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    setError(null);
    const e164 = toE164Phone(phone);
    if (!e164) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await signInWithPhoneOtp(phone);
      const display = phone.replace(/\D/g, '').slice(-10);
      router.push(
        `/(auth)/verify-otp?phone=${encodeURIComponent(e164)}&display=${display}` as Href
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <DecorBackdrop />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, Spacing.md) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.hero}>
            <BrandLogo variant="inline" size="sm" />

            <View style={styles.heroRow}>
              <View style={styles.headlineBlock}>
                <View style={styles.headlineRow}>
                  <Text style={styles.headline}>Welcome to </Text>
                  <Text style={[styles.headline, styles.headlineAccent]}>better care</Text>
                </View>
                <AppText variant="muted" style={styles.subhead}>
                  Consult top doctors, book appointments and manage your health with ease.
                </AppText>
              </View>

              <Image
                source={BrandImages.loginHero}
                style={styles.heroImage}
                contentFit="contain"
                transition={0}
              />
            </View>
          </View>

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <AppText variant="h3" style={styles.sheetTitle}>
                Login or Sign up
              </AppText>
              <AppText variant="muted" style={styles.sheetSub}>
                Enter your mobile number to continue
              </AppText>
            </View>

            <PhoneField
              placeholder="Enter mobile number"
              value={phone}
              onChangeText={(text) => {
                setPhone(text.replace(/\D/g, '').slice(0, 10));
                setError(null);
              }}
              error={error}
            />

            <Button title="Continue" showArrow loading={loading} onPress={onContinue} />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <AppText variant="muted" style={styles.or}>
                or
              </AppText>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <Pressable style={styles.socialBtn} disabled accessibilityRole="button">
                <Image
                  source={BrandImages.googleLogo}
                  style={styles.socialIcon}
                  contentFit="contain"
                />
                <AppText variant="bodyMedium" style={styles.socialLabel}>
                  Continue with Google
                </AppText>
              </Pressable>
              <Pressable style={styles.socialBtn} disabled accessibilityRole="button">
                <Image
                  source={BrandImages.appleLogo}
                  style={styles.socialIcon}
                  contentFit="contain"
                />
                <AppText variant="bodyMedium" style={styles.socialLabel}>
                  Continue with Apple
                </AppText>
              </Pressable>
            </View>

            <View style={styles.trust}>
              <Icon name="shield" size={22} color={Colors.primary900} />
              <View style={styles.trustCopy}>
                <AppText variant="bodyMedium" style={styles.trustTitle}>
                  Your health data is safe with us
                </AppText>
                <AppText style={styles.trustBody}>
                  We follow industry-standard security to keep your information private.
                </AppText>
              </View>
              <Icon name="lock" size={20} color={Colors.primary700} />
            </View>

            <AppText variant="muted" style={styles.legal}>
              By continuing, you agree to our{' '}
              <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </AppText>

            <AppText variant="muted" style={styles.altLinks}>
              Prefer email?{' '}
              <Link href={'/(auth)/email-login' as Href} style={styles.link}>
                Sign in with email
              </Link>
              {' · '}
              <Link href="/(auth)/register" style={styles.link}>
                Create account
              </Link>
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.splashBackground,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    minHeight: 280,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headlineBlock: {
    flex: 1,
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    zIndex: 1,
  },
  headlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headline: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: Colors.text,
  },
  headlineAccent: {
    color: Colors.primary900,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 200,
  },
  heroImage: {
    width: 168,
    height: 168,
    marginRight: -Spacing.sm,
    marginTop: -Spacing.xs,
  },
  sheet: {
    marginTop: Spacing.md,
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.card,
  },
  sheetHeader: {
    gap: 4,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  sheetSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  or: {
    fontSize: 13,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  socialBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.sm,
    opacity: 0.92,
  },
  socialIcon: {
    width: 20,
    height: 20,
  },
  socialLabel: {
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 1,
  },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary50,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  trustCopy: {
    flex: 1,
    gap: 2,
  },
  trustTitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.primary700,
  },
  trustBody: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.primary700,
    opacity: 0.85,
  },
  legal: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
    fontSize: 12,
  },
  altLinks: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: -Spacing.xs,
  },
  link: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
  },
});
