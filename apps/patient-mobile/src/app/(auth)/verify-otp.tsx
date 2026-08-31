import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BrandLogo } from '@/components/ui/brand-logo';
import { DecorBackdrop } from '@/components/ui/decor-backdrop';
import { Icon, IconBadge } from '@/components/ui/icon';
import { OtpInput } from '@/components/ui/otp-input';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VerifyOtpScreen() {
  const { verifyPhoneOtp, signInWithPhoneOtp } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; display?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const display =
    typeof params.display === 'string' && params.display.length === 10
      ? `+91 ${params.display.slice(0, 5)} ${params.display.slice(5)}`
      : phone || '+91';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expireIn, setExpireIn] = useState(180);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    const id = setInterval(() => {
      setExpireIn((v) => (v > 0 ? v - 1 : 0));
      setResendIn((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  async function onVerify(code: string) {
    if (!phone || loading) return;
    setError(null);
    setLoading(true);
    try {
      await verifyPhoneOtp(phone, code);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify OTP.');
      setLoading(false);
    }
  }

  async function onResend() {
    if (resendIn > 0 || !phone) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithPhoneOtp(phone);
      setResendIn(30);
      setExpireIn(180);
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <DecorBackdrop />
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}>
            <Icon name="chevronLeft" size={22} color={Colors.text} />
          </Pressable>
          <BrandLogo variant="inline" size="sm" />
        </View>

        <View style={styles.form}>
          <AppText variant="h2">Verify your mobile number</AppText>
          <AppText variant="muted">
            We’ve sent a 6-digit OTP to{' '}
            <AppText variant="bodyMedium">{display}</AppText>{' '}
            <AppText
              variant="bodyMedium"
              style={styles.change}
              onPress={() => router.back()}>
              Change
            </AppText>
          </AppText>

          <AppText variant="label" style={styles.otpLabel}>
            Enter the 6-digit OTP
          </AppText>
          <OtpInput
            value={otp}
            onChange={(value) => {
              setOtp(value);
              if (value.length === 6) void onVerify(value);
            }}
          />

          <View style={styles.expireBar}>
            <Icon name="shield" size={18} color={Colors.primary900} />
            <AppText variant="muted" style={styles.expireText}>
              OTP will expire in{' '}
              <AppText variant="bodyMedium" style={styles.expireTime}>
                {formatCountdown(expireIn)}
              </AppText>
            </AppText>
          </View>

          {error ? <AppText variant="error">{error}</AppText> : null}
          {loading ? <AppText variant="muted">Verifying…</AppText> : null}

          <View style={styles.resendBlock}>
            <AppText variant="muted">Didn’t receive OTP?</AppText>
            <Pressable
              disabled={resendIn > 0 || loading}
              onPress={onResend}
              style={styles.resendRow}>
              <Icon name="check" size={14} color={Colors.primary900} />
              <AppText variant="bodyMedium" style={styles.resendLink}>
                Resend OTP
              </AppText>
              {resendIn > 0 ? (
                <AppText variant="bodyMedium" style={styles.resendLink}>
                  in {formatCountdown(resendIn)}
                </AppText>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.trustCard}>
          <TrustCol
            icon="shield"
            title="Secure & Private"
            body="Your data is encrypted and always protected."
          />
          <TrustCol
            icon="lock"
            title="Trusted by Patients"
            body="Join thousands of patients who trust us."
          />
          <TrustCol
            icon="stethoscope"
            title="Expert Care"
            body="Connect with verified specialists instantly."
          />
        </View>

        <Pressable style={styles.help} accessibilityRole="button">
          <Icon name="support" size={18} color={Colors.primary900} />
          <AppText variant="bodyMedium" style={styles.helpText}>
            Need help? Contact our support team
          </AppText>
          <Icon name="chevron" size={16} color={Colors.primary900} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TrustCol({
  icon,
  title,
  body,
}: {
  icon: 'shield' | 'lock' | 'stethoscope';
  title: string;
  body: string;
}) {
  return (
    <View style={styles.trustCol}>
      <IconBadge name={icon} size={18} badgeSize={36} />
      <AppText variant="bodyMedium" style={styles.trustTitle}>
        {title}
      </AppText>
      <AppText variant="muted" style={styles.trustBody}>
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  form: {
    gap: Spacing.md,
  },
  change: {
    color: Colors.primary900,
    textDecorationLine: 'underline',
  },
  otpLabel: {
    color: Colors.gray600,
    letterSpacing: 0,
    marginTop: Spacing.sm,
  },
  expireBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary50,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  expireText: {
    fontSize: 13,
  },
  expireTime: {
    color: Colors.primary900,
    fontSize: 13,
  },
  resendBlock: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendLink: {
    color: Colors.primary900,
  },
  trustCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginTop: 'auto',
  },
  trustCol: {
    flex: 1,
    gap: 6,
  },
  trustTitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  trustBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  helpText: {
    color: Colors.primary900,
    fontFamily: FontFamily.label,
    fontSize: 14,
  },
});
