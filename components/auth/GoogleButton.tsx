'use client';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { call, errorOf, go } from './fields';

// Google's own sign-in button on the site's pages (PA A3; the operator's answer of 2026-09-24: the reader never leaves
// paddock-tracker.com and Google's screen names the site, not the Supabase project). Before the button draws, the page
// asks POST /api/auth/nonce: the route mints a nonce, keeps it in an httpOnly cookie and answers its SHA-256, which
// Google gets as the button's nonce. The button hands the page an ID token; the page posts it to /api/auth/google, which
// reads the raw nonce back from the cookie and lets Supabase Auth check the token carries its hash. A captured token
// cannot be replayed from another browser, since that browser holds no cookie. Without a client id (a preview without
// the var) the button draws nothing.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function GoogleButton({ clientId, next, onError }: { clientId: string | null; next: string; onError: (message: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);
  const [hashed, setHashed] = useState<string | null>(null);
  useEffect(() => {
    if (!clientId) return;
    let mounted = true;
    void call('/api/auth/nonce', 'POST').then(answer => {
      if (!mounted) return;
      if (answer.ok && typeof answer.body.hashed === 'string') setHashed(answer.body.hashed);
      else onError(errorOf(answer));
    });
    return () => {
      mounted = false;
    };
  }, [clientId, onError]);
  const draw = useCallback(() => {
    if (!clientId || !hashed || !box.current || !window.google || drawn.current) return;
    drawn.current = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: hashed,
      use_fedcm_for_prompt: true,
      itp_support: true,
      callback: async (response: { credential?: string }) => {
        const answer = await call('/api/auth/google', 'POST', { credential: response.credential ?? '', next });
        if (answer.ok) go(typeof answer.body.next === 'string' ? answer.body.next : next);
        else onError(errorOf(answer));
      },
    });
    window.google.accounts.id.renderButton(box.current, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'left', width: 320 });
  }, [clientId, hashed, next, onError]);
  useEffect(() => {
    draw();
  }, [draw]);
  if (!clientId) return null;
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={draw} />
      <div ref={box} className="flex min-h-11 justify-center" />
    </>
  );
}
