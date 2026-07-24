import type { Gender } from '@teleconsult/shared-types';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/ui/city-picker';
import { DateField } from '@/components/ui/date-field';
import { DecorBackdrop } from '@/components/ui/decor-backdrop';
import { GenderSelect } from '@/components/ui/gender-select';
import { Icon } from '@/components/ui/icon';
import { IconTextField } from '@/components/ui/icon-text-field';
import { BrandImages } from '@/constants/images';
import { Colors, FontFamily, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  validateBasicDetails,
  type BasicDetailsFieldErrors,
} from '@/lib/basic-details-validation';

export default function BasicDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { patient, saveBasicDetails, signOut } = useAuth();

  const [fullName, setFullName] = useState(patient?.fullName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth ?? '');
  const [gender, setGender] = useState<Gender | null>(patient?.gender ?? null);
  const [email, setEmail] = useState(patient?.email ?? '');
  const [city, setCity] = useState(patient?.city ?? '');
  const [fieldErrors, setFieldErrors] = useState<BasicDetailsFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailLocked = Boolean(patient?.email?.trim());

  function clearFieldError(field: keyof BasicDetailsFieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function onContinue() {
    setError(null);
    const errors = validateBasicDetails({
      fullName,
      dateOfBirth,
      gender,
      email: emailLocked ? '' : email,
      city,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }
    if (!gender || !dateOfBirth) return;

    setLoading(true);
    try {
      await saveBasicDetails({
        fullName: fullName.trim(),
        dateOfBirth,
        gender,
        city: city.trim(),
        ...(emailLocked || !email.trim()
          ? {}
          : { email: email.trim().toLowerCase() }),
      });
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
    } finally {
      setLoading(false);
    }
  }

  async function onBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    await signOut();
    router.replace('/(auth)/login');
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
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => void onBack()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Icon name="chevronLeft" size={22} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <BrandLogo markOnly size="sm" />
            <View style={styles.heroRow}>
              <View style={styles.headlineBlock}>
                <AppText variant="h2" style={styles.welcome}>
                  Welcome!
                </AppText>
                <AppText variant="muted" style={styles.subhead}>
                  Let’s get to know you better to personalize your care.
                </AppText>
              </View>
              <Image
                source={BrandImages.basicDetailsHero}
                style={styles.heroImage}
                contentFit="contain"
                transition={0}
              />
            </View>
          </View>

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <AppText variant="h3" style={styles.sheetTitle}>
                Basic details
              </AppText>
              <AppText variant="muted" style={styles.sheetSub}>
                This helps us serve you better and personalise your experience.
              </AppText>
            </View>

            <IconTextField
              label="Full name"
              icon="person"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                clearFieldError('fullName');
              }}
              placeholder="Enter your full name"
              autoComplete="name"
              autoCapitalize="words"
              error={fieldErrors.fullName}
            />

            <DateField
              label="Date of birth"
              value={dateOfBirth}
              onChange={(value) => {
                setDateOfBirth(value);
                clearFieldError('dateOfBirth');
              }}
              withIcons
              error={fieldErrors.dateOfBirth}
            />

            <GenderSelect
              value={gender}
              onChange={(value) => {
                setGender(value);
                clearFieldError('gender');
              }}
              error={fieldErrors.gender}
            />

            <IconTextField
              label={emailLocked ? 'Email address' : 'Email address (optional)'}
              icon="mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError('email');
              }}
              placeholder="Enter your email address"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!emailLocked}
              error={fieldErrors.email}
            />

            <CityPicker
              value={city}
              onChange={(value) => {
                setCity(value);
                clearFieldError('city');
              }}
              error={fieldErrors.city}
            />

            <View style={styles.trust}>
              <Icon name="shield" size={22} color={Colors.primary900} />
              <View style={styles.trustCopy}>
                <AppText variant="bodyMedium" style={styles.trustTitle}>
                  Your information is safe with us
                </AppText>
                <AppText style={styles.trustBody}>
                  We follow industry-standard security to keep your information private and
                  secure.
                </AppText>
              </View>
              <Icon name="lock" size={20} color={Colors.gray300} />
            </View>

            {error ? <AppText variant="error">{error}</AppText> : null}

            <Button title="Continue" showArrow loading={loading} onPress={onContinue} />

            <View style={styles.footerNote}>
              <Icon name="lock" size={12} color={Colors.gray400} />
              <AppText variant="muted" style={styles.footerText}>
                You can update these details anytime in Profile
              </AppText>
            </View>
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
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headlineBlock: {
    flex: 1,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    zIndex: 1,
  },
  welcome: {
    color: Colors.primary900,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 210,
  },
  heroImage: {
    width: 140,
    height: 140,
    marginRight: -Spacing.sm,
    marginTop: -Spacing.xs,
  },
  sheet: {
    marginTop: Spacing.lg,
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
    color: Colors.black,
  },
  sheetSub: {
    fontSize: 14,
    lineHeight: 20,
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
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
