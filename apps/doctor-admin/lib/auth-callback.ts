import { getRoleFromAppMetadata, isStaffRole } from '@teleconsult/shared-types';

import { createClient } from '@/lib/supabase/client';

export type AuthLinkType = 'invite' | 'recovery' | 'magiclink' | 'signup' | 'email' | string;

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

/**
 * Completes invite / recovery / magic-link auth from either:
 * - PKCE `?code=` (preferred for SSR)
 * - Implicit `#access_token=&refresh_token=` (common with generateLink redirects)
 */
export async function completeAuthFromUrl(url: URL): Promise<
  | { ok: true; linkType: AuthLinkType | null }
  | { ok: false; message: string }
> {
  const supabase = createClient();
  const code = url.searchParams.get('code');
  const hashParams = parseHashParams(url.hash);
  const linkType = (hashParams.get('type') ?? url.searchParams.get('type')) as AuthLinkType | null;

  let user = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: error.message };
    user = data.user;
  } else {
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (!accessToken || !refreshToken) {
      return {
        ok: false,
        message: 'Missing auth tokens in invite link. Request a new invite and open the link once.',
      };
    }

    // Prefer setSession result — avoid a second getUser() network round-trip that can hang.
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { ok: false, message: error.message };
    user = data.user;
  }

  if (!user) {
    return { ok: false, message: 'Could not load invited user from the link.' };
  }

  const role = getRoleFromAppMetadata(user.app_metadata as Record<string, unknown>);
  if (!isStaffRole(role)) {
    await supabase.auth.signOut();
    return { ok: false, message: 'This portal is for doctors and admins only.' };
  }

  return { ok: true, linkType };
}

export function destinationForAuthLink(linkType: AuthLinkType | null): string {
  if (linkType === 'invite' || linkType === 'recovery') {
    return '/auth/set-password';
  }
  return '/dashboard';
}
