import type { AppNotification, AppNotificationRow } from '@teleconsult/shared-types';
import { mapAppNotificationRow } from '@teleconsult/shared-types';

import { supabase } from '@/lib/supabase';

export async function fetchNotifications(options: {
  unreadOnly?: boolean;
  limit?: number;
} = {}): Promise<AppNotification[]> {
  const limit = options.limit ?? 20;
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data as AppNotificationRow[] | null) ?? []).map(mapAppNotificationRow);
}

export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('mark_notifications_read', {
    p_ids: ids?.length ? ids : null,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export function subscribeNotifications(
  userId: string,
  onInsert: (notification: AppNotification) => void
) {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onInsert(mapAppNotificationRow(payload.new as AppNotificationRow));
      }
    )
    .subscribe();
}
