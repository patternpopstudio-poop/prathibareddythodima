import type { AppNotification } from '@teleconsult/shared-types';
import { useFocusEffect } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  fetchNotifications,
  markNotificationsRead,
} from '@/lib/notifications';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function destinationFor(notification: AppNotification): Href {
  if (notification.entityType === 'bookings' && notification.entityId) {
    return `/(app)/booking-confirmed?id=${notification.entityId}` as Href;
  }
  return '/(app)/book' as Href;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchNotifications({ limit: 40 }));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const unread = items.filter((n) => !n.readAt);

  async function onMarkAll() {
    if (busy || unread.length === 0) return;
    setBusy(true);
    try {
      await markNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    } finally {
      setBusy(false);
    }
  }

  async function onOpen(notification: AppNotification) {
    if (!notification.readAt) {
      try {
        await markNotificationsRead([notification.id]);
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
      } catch {
        // Still navigate.
      }
    }
    router.push(destinationFor(notification));
  }

  return (
    <Screen>
      <ScreenNav title="Notifications" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary900} />
        </View>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          icon="mail"
          title="No notifications"
          description="Updates about offline visit requests and hospital decisions appear here."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <View style={styles.list}>
          {unread.length > 0 ? (
            <View style={styles.toolbar}>
              <AppText variant="muted" style={styles.toolbarCopy}>
                {unread.length} unread
              </AppText>
              <Button
                title={busy ? 'Updating…' : 'Mark all read'}
                variant="ghost"
                onPress={() => void onMarkAll()}
              />
            </View>
          ) : null}

          {items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => void onOpen(item)}
              style={({ pressed }) => [
                styles.card,
                !item.readAt && styles.cardUnread,
                pressed && styles.pressed,
              ]}>
              <View style={styles.cardTop}>
                <AppText variant="bodyMedium" style={styles.title}>
                  {item.title}
                </AppText>
                {!item.readAt ? <View style={styles.dot} /> : null}
              </View>
              <AppText variant="muted" style={styles.body}>
                {item.body}
              </AppText>
              <AppText variant="muted" style={styles.when}>
                {formatWhen(item.createdAt)}
              </AppText>
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
  list: {
    gap: Spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  toolbarCopy: {
    fontSize: 13,
  },
  card: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardUnread: {
    borderColor: Colors.primary100,
    backgroundColor: Colors.primary50,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    color: Colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  when: {
    fontSize: 12,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary900,
  },
  pressed: {
    opacity: 0.85,
  },
});
