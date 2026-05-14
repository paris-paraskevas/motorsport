'use client';
import { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

const DISMISS_KEY = 'paddock:pwa-install-dismissed';

type Variant = 'hidden' | 'native' | 'ios-safari' | 'ios-other';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS legacy
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function detectIOS(): { ios: boolean; safari: boolean } {
  if (typeof navigator === 'undefined') return { ios: false, safari: false };
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
  return { ios, safari };
}

export function PWAInstallPrompt() {
  const [variant, setVariant] = useState<Variant>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }

    const { ios, safari } = detectIOS();
    if (ios) {
      setVariant(safari ? 'ios-safari' : 'ios-other');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVariant('native');
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setVariant('hidden');
      try {
        window.localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVariant('hidden');
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    dismiss();
  };

  if (variant === 'hidden') return null;

  return (
    <div className="mx-3 md:mx-6 lg:mx-8 mt-3 max-w-3xl rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.08] to-zinc-900/40 backdrop-blur p-4 relative">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors"
      >
        <X size={14} />
      </button>

      {variant === 'native' && (
        <div className="flex items-start gap-3 pr-6">
          <Download size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-zinc-100 text-sm font-semibold">
              Install Paddock as an app
            </div>
            <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">
              Faster launch, full-screen, push notifications.
            </p>
            <button
              type="button"
              onClick={install}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 bg-amber-300 hover:bg-amber-200 rounded-full px-3 py-1.5 transition-colors"
            >
              <Download size={12} />
              Install
            </button>
          </div>
        </div>
      )}

      {variant === 'ios-safari' && (
        <div className="pr-6">
          <div className="flex items-center gap-2 mb-1">
            <Download size={16} className="text-amber-300" />
            <div className="text-zinc-100 text-sm font-semibold">
              Install Paddock on your iPhone
            </div>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Tap{' '}
            <Share size={11} className="inline align-text-bottom mx-0.5" />{' '}
            <span className="text-zinc-200">Share</span> in Safari, then{' '}
            <Plus size={11} className="inline align-text-bottom mx-0.5" />{' '}
            <span className="text-zinc-200">Add to Home Screen</span>. Required
            for push notifications on iOS.
          </p>
        </div>
      )}

      {variant === 'ios-other' && (
        <div className="pr-6">
          <div className="flex items-center gap-2 mb-1">
            <Download size={16} className="text-amber-300" />
            <div className="text-zinc-100 text-sm font-semibold">
              Open this site in Safari to install
            </div>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            iOS only lets you install web apps and enable push notifications
            from Safari. Other browsers (Chrome, Firefox, Edge) can&apos;t do it
            on iPhone.
          </p>
        </div>
      )}
    </div>
  );
}
