import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey === 'your-service-role-key') {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export async function checkSupabaseConnection(): Promise<
  'connected' | 'disconnected' | 'not_configured'
> {
  const client = getSupabaseAdmin();
  if (!client) return 'not_configured';

  const { error } = await client.from('patients').select('id').limit(1);
  return error ? 'disconnected' : 'connected';
}
