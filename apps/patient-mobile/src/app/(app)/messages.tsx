import { useFocusEffect } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { DoctorAvatar } from '@/components/ui/doctor-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  consultationStatusLabel,
  fetchPatientConsultations,
  formatConsultationActivity,
  type PatientConsultationCase,
} from '@/lib/consultations';

export default function MessagesScreen() {
  const [cases, setCases] = useState<PatientConsultationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCases(await fetchPatientConsultations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen>
      <PageHeader
        eyebrow="CONSULTATIONS"
        title="Messages"
        description="Online consultations only. In-clinic visits do not use chat."
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <AppText variant="muted" style={styles.errorText}>
            {error}
          </AppText>
          <Pressable onPress={() => void load()} hitSlop={8}>
            <AppText variant="bodyMedium" style={styles.retry}>
              Try again
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && cases.length === 0 ? (
        <EmptyState
          icon="messages"
          title="No conversations yet"
          description="When you confirm an online booking, a chat with your doctor opens here."
          style={styles.empty}
        />
      ) : null}

      {!loading && cases.length > 0 ? (
        <View style={styles.list}>
          {cases.map(({ consultation, doctor, lastMessagePreview }) => (
            <Pressable
              key={consultation.id}
              accessibilityRole="button"
              onPress={() =>
                router.push(`/(app)/consultation/${consultation.id}` as Href)
              }
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <DoctorAvatar
                name={doctor.fullName}
                photoUrl={doctor.photoUrl}
                size={48}
              />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <AppText variant="bodyMedium" style={styles.name} numberOfLines={1}>
                    {doctor.fullName || 'Doctor'}
                  </AppText>
                  <View
                    style={[
                      styles.pill,
                      consultation.status === 'in_progress' && styles.pillActive,
                    ]}>
                    <AppText
                      variant="label"
                      style={[
                        styles.pillText,
                        consultation.status === 'in_progress' && styles.pillTextActive,
                      ]}>
                      {consultationStatusLabel(consultation.status)}
                    </AppText>
                  </View>
                </View>
                <AppText variant="muted" style={styles.preview} numberOfLines={1}>
                  {lastMessagePreview || 'Say hello to start the consultation'}
                </AppText>
                <AppText variant="muted" style={styles.meta}>
                  {formatConsultationActivity(consultation.lastMessageAt)}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  empty: {
    marginTop: Spacing.md,
  },
  errorBox: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorText: {
    color: Colors.accentRed,
  },
  retry: {
    color: Colors.primary900,
  },
  list: {
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.9,
  },
  cardBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    color: Colors.text,
  },
  preview: {
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
  },
  pill: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillActive: {
    backgroundColor: Colors.primary50,
  },
  pillText: {
    fontSize: 11,
    color: Colors.gray600,
  },
  pillTextActive: {
    color: Colors.primary700,
  },
});
