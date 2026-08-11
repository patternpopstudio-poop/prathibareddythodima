import type { AppNotification, AppNotificationRow } from '@teleconsult/shared-types';
import { mapAppNotificationRow } from '@teleconsult/shared-types';

import type { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { createClient as createServerClient } from '@/lib/supabase/server';

type ServerSupabase = Awaited<ReturnType<typeof createServerClient>>;
type BrowserSupabase = ReturnType<typeof createBrowserClient>;

export async function fetchNotifications(
  supabase: ServerSupabase | BrowserSupabase,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<AppNotification[]> {
  const limit = options.limit ?? 30;
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

export async function fetchUnreadNotificationCount(
  supabase: ServerSupabase | BrowserSupabase
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationsRead(
  supabase: BrowserSupabase,
  ids?: string[]
): Promise<number> {
  const { data, error } = await supabase.rpc('mark_notifications_read', {
    p_ids: ids?.length ? ids : null,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export function subscribeNotifications(
  supabase: BrowserSupabase,
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

export function notificationDestination(notification: AppNotification): string {
  switch (notification.type) {
    case 'overflow.pending_admin':
      return '/overflow';
    case 'clinic.unpaid':
      return '/clinic-payments';
    case 'overflow.assigned':
    case 'booking.offline_confirmed':
      return '/bookings';
    default:
      return '/dashboard';
  }
}
