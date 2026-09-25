'use client';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { call, errorOf, go } from './fields';

// Google's own sign-in button on the site's pages (PA A3; the operator's answer of 2026-09-24: the reader never leaves
// paddock-tracker.com and Google's screen names the site, not the Supabase project). The button hands the page an ID
// token; the page posts it to /api/auth/google with the raw nonce, and Supabase Auth checks the token carries the
// nonce's SHA-256 (its docs' rule: the hash to Google, the raw value to signInWithIdToken). Without a client id (a
// preview without the var) the button draws nothing.
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

/** A raw nonce and its SHA-256 as hex. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

export function GoogleButton({ clientId, next, onError }: { clientId: string | null; next: string; onError: (message: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);
  const [nonce, setNonce] = useState<{ raw: string; hashed: string } | null>(null);
  useEffect(() => {
    void makeNonce().then(setNonce);
  }, []);
  const draw = useCallback(() => {
    if (!clientId || !nonce || !box.current || !window.google || drawn.current) return;
    drawn.current = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: nonce.hashed,
      use_fedcm_for_prompt: true,
      itp_support: true,
      callback: async (response: { credential?: string }) => {
        const answer = await call('/api/auth/google', 'POST', { credential: response.credential ?? '', nonce: nonce.raw, next });
        if (answer.ok) go(typeof answer.body.next === 'string' ? answer.body.next : next);
        else onError(errorOf(answer));
      },
    });
    window.google.accounts.id.renderButton(box.current, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'left', width: 320 });
  }, [clientId, nonce, next, onError]);
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
