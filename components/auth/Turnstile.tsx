'use client';
import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';

// Cloudflare Turnstile on the sign-in, sign-up and reset forms (PA A3): the widget's token goes with the request, and
// Supabase Auth checks it. The script loads on these pages alone. Without a site key (a preview without the var) the
// widget draws nothing and the forms send no token; the provider then has its captcha off too.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

export function Turnstile({ siteKey, onToken, round }: { siteKey: string | null; onToken: (token: string | null) => void; /** Bumped after every submit: a token is spent by one request. */ round: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const render = useCallback(() => {
    if (!siteKey || !box.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      theme: 'auto',
      size: 'flexible',
      callback: (token: string) => onToken(token),
      'expired-callback': () => onToken(null),
      'error-callback': () => onToken(null),
    });
  }, [siteKey, onToken]);
  useEffect(() => {
    render();
    const id = widget.current;
    return () => {
      if (id && window.turnstile) window.turnstile.remove(id);
      widget.current = null;
    };
  }, [render]);
  useEffect(() => {
    if (round > 0 && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      onToken(null);
    }
  }, [round, onToken]);
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div ref={box} className="min-h-16" />
    </>
  );
}
