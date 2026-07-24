'use client';

import { useEffect, useRef, useState } from 'react';

import { completeAuthFromUrl, destinationForAuthLink } from '@/lib/auth-callback';

/**
 * Invite / recovery links from Supabase often return tokens in the URL hash.
 * Hash fragments are only readable in the browser, so this must be a client page.
 */
export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Completing sign-in…');
  const started = useRef(false);

  useEffect(() => {
    // React Strict Mode remounts in dev — only process the link once.
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        const href = window.location.href;
        const result = await completeAuthFromUrl(new URL(href));

        if (!result.ok) {
          setMessage(result.message);
          window.location.replace(`/login?error=${encodeURIComponent(result.message)}`);
          return;
        }

        const next = destinationForAuthLink(result.linkType);
        setMessage('Signed in — redirecting…');
        // Full navigation so auth cookies are reliably available on the next page.
        window.location.replace(next);
      } catch (err) {
        const text = err instanceof Error ? err.message : 'Invite link failed.';
        setMessage(text);
        window.location.replace(`/login?error=${encodeURIComponent(text)}`);
      }
    }

    void run();
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md space-y-2 text-center">
        <p className="text-sm text-muted">{message}</p>
        <p className="text-xs text-muted">
          If this takes more than a few seconds, close the tab and open a fresh invite link.
        </p>
      </div>
    </main>
  );
}
