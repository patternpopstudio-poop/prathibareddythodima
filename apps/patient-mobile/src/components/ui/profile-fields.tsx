import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type AppIconName } from '@/components/ui/icon';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { ProfileField } from '@/lib/patient-display';

export function CardSectionHeader({ icon, title }: { icon: AppIconName; title: string }) {
  return (
    <View style={styles.header}>
      <Icon name={icon} size={18} color={Colors.primary900} />
      <AppText variant="section">{title}</AppText>
    </View>
  );
}

export function ProfileFieldList({ fields }: { fields: ProfileField[] }) {
  return (
    <View style={styles.rows}>
      {fields.map((field) => (
        <View key={field.label} style={styles.row}>
          <AppText variant="muted" style={styles.rowLabel}>
            {field.label}
          </AppText>
          <AppText variant="bodyMedium" style={styles.rowValue}>
            {field.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function MetricStrip({ fields }: { fields: ProfileField[] }) {
  return (
    <View style={styles.metrics}>
      {fields.map((field, index) => (
        <View key={field.label} style={styles.metricWrap}>
          {index > 0 ? <View style={styles.metricDivider} /> : null}
          <View style={styles.metric}>
            <AppText variant="label" style={styles.metricLabel}>
              {field.label.toUpperCase()}
            </AppText>
            <AppText variant="h3">{field.value}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rows: {
    gap: Spacing.md,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 12,
  },
  rowValue: {
    color: Colors.text,
  },
  metrics: {
    flexDirection: 'row',
    backgroundColor: Colors.gray50,
    borderRadius: Radius.input,
    paddingVertical: Spacing.md,
  },
  metricWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricLabel: {
    color: Colors.gray500,
    letterSpacing: 0.8,
  },
  metricDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.gray200,
    marginVertical: 4,
  },
});
