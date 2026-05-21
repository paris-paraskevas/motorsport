'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'paddock:consent';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
const OPEN_EVENT = 'open-cookie-consent';

type ConsentPrefs = {
  analytics: boolean;
  advertising: boolean;
  functional: boolean;
};

type StoredConsent = ConsentPrefs & { timestamp: number };

type View = 'closed' | 'main' | 'customize';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function loadStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.analytics !== 'boolean' ||
      typeof parsed.advertising !== 'boolean' ||
      typeof parsed.functional !== 'boolean'
    ) {
      return null;
    }
    return parsed as StoredConsent;
  } catch {
    return null;
  }
}

function applyConsent(prefs: ConsentPrefs) {
  // Defensive guard: consent-default script in layout.tsx runs beforeInteractive
  // and defines window.gtag via dataLayer.push, so by hydration gtag is on
  // window. Guard against script-blocker extensions that strip gtag entirely.
  if (typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    ad_storage: prefs.advertising ? 'granted' : 'denied',
    ad_user_data: prefs.advertising ? 'granted' : 'denied',
    ad_personalization: prefs.advertising ? 'granted' : 'denied',
    analytics_storage: prefs.analytics ? 'granted' : 'denied',
    functionality_storage: prefs.functional ? 'granted' : 'denied',
    personalization_storage: prefs.functional ? 'granted' : 'denied',
  });
}

function persist(prefs: ConsentPrefs) {
  try {
    const payload: StoredConsent = { ...prefs, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage can throw in private modes — consent state is then ephemeral
    // (modal will reappear on next visit). Acceptable degradation.
  }
}

export function CookieConsent() {
  const [view, setView] = useState<View>('closed');
  const [prefs, setPrefs] = useState<ConsentPrefs>({
    analytics: false,
    advertising: false,
    functional: false,
  });

  // First-mount decision: open if no stored consent OR stored decision is stale.
  // The setState-in-effect lint rule fires here because the decision depends on
  // browser-only state (localStorage), which isn't readable during SSR and so
  // can't be derived at render time. One-shot cascading render on mount is the
  // intended behavior, not a perf issue.
  useEffect(() => {
    const stored = loadStored();
    if (!stored || Date.now() - stored.timestamp > TWELVE_MONTHS_MS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('main');
      return;
    }
    // Existing valid decision: reapply to gtag in case scripts started after
    // hydration (e.g. extension-blocked gtag was un-blocked between sessions).
    applyConsent(stored);
    setPrefs({
      analytics: stored.analytics,
      advertising: stored.advertising,
      functional: stored.functional,
    });
  }, []);

  // Footer "Manage cookies" button (and anything else) can re-open the modal
  // by dispatching window.dispatchEvent(new Event('open-cookie-consent')).
  useEffect(() => {
    const handler = () => setView('main');
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  const decide = useCallback((next: ConsentPrefs) => {
    setPrefs(next);
    persist(next);
    applyConsent(next);
    setView('closed');
  }, []);

  const acceptAll = () =>
    decide({ analytics: true, advertising: true, functional: true });
  const rejectAll = () =>
    decide({ analytics: false, advertising: false, functional: false });
  const savePrefs = () => decide(prefs);

  if (view === 'closed') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-0 z-[100] grid place-items-end sm:place-items-center bg-black/70 p-4"
    >
      <div className="w-full sm:max-w-lg bg-surface-elevated border border-border rounded-(--radius-card) shadow-2xl">
        {view === 'main' ? (
          <MainLayer
            onAcceptAll={acceptAll}
            onRejectAll={rejectAll}
            onCustomize={() => setView('customize')}
          />
        ) : (
          <CustomizeLayer
            prefs={prefs}
            setPrefs={setPrefs}
            onSave={savePrefs}
            onRejectAll={rejectAll}
            onAcceptAll={acceptAll}
          />
        )}
      </div>
    </div>
  );
}

function MainLayer({
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="p-6">
      <h2
        id="cookie-consent-title"
        className="text-base font-semibold text-text mb-2"
      >
        Your cookie choices
      </h2>
      <p id="cookie-consent-desc" className="text-sm text-text-muted leading-relaxed">
        Paddock uses essential cookies to make the site work. With your consent,
        we also use analytics to understand how the site is used and advertising
        to keep it free. You can change your choice anytime from the footer.
      </p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ConsentButton autoFocus onClick={onAcceptAll}>
          Accept all
        </ConsentButton>
        <ConsentButton onClick={onRejectAll}>Reject all</ConsentButton>
        <ConsentButton onClick={onCustomize}>Customize</ConsentButton>
      </div>
    </div>
  );
}

function CustomizeLayer({
  prefs,
  setPrefs,
  onSave,
  onRejectAll,
  onAcceptAll,
}: {
  prefs: ConsentPrefs;
  setPrefs: (p: ConsentPrefs) => void;
  onSave: () => void;
  onRejectAll: () => void;
  onAcceptAll: () => void;
}) {
  return (
    <div className="p-6">
      <h2 id="cookie-consent-title" className="text-base font-semibold text-text mb-2">
        Customize your choices
      </h2>
      <p id="cookie-consent-desc" className="text-sm text-text-muted leading-relaxed mb-4">
        Necessary cookies keep the site working and are always on. Toggle the
        others as you like.
      </p>
      <div className="space-y-2 mb-5">
        <Category
          title="Necessary"
          description="Required for the site to work — authentication, security, your saved preferences."
          locked
          checked
        />
        <Category
          title="Analytics"
          description="Aggregate, pseudonymous measurement of how Paddock is used (Google Analytics)."
          checked={prefs.analytics}
          onChange={(v) => setPrefs({ ...prefs, analytics: v })}
        />
        <Category
          title="Advertising"
          description="Ad delivery and frequency capping (Google AdSense). Helps keep Paddock free."
          checked={prefs.advertising}
          onChange={(v) => setPrefs({ ...prefs, advertising: v })}
        />
        <Category
          title="Functional"
          description="Optional personalization features that improve the experience over time."
          checked={prefs.functional}
          onChange={(v) => setPrefs({ ...prefs, functional: v })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ConsentButton autoFocus onClick={onSave}>
          Save choices
        </ConsentButton>
        <ConsentButton onClick={onRejectAll}>Reject all</ConsentButton>
        <ConsentButton onClick={onAcceptAll}>Accept all</ConsentButton>
      </div>
    </div>
  );
}

function Category({
  title,
  description,
  checked,
  locked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 bg-surface border border-border rounded-(--radius-card)">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="mt-0.5 text-xs text-text-muted leading-relaxed">
          {description}
        </div>
      </div>
      <Toggle checked={checked} locked={locked} onChange={onChange} label={title} />
    </div>
  );
}

function Toggle({
  checked,
  locked,
  onChange,
  label,
}: {
  checked: boolean;
  locked?: boolean;
  onChange?: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={locked}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-(--duration-fast) focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${
        checked ? 'bg-text' : 'bg-border'
      } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-bg shadow transition-transform duration-(--duration-fast) ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function ConsentButton({
  autoFocus,
  onClick,
  children,
}: {
  autoFocus?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onClick}
      className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium bg-text text-bg border border-text rounded-(--radius-card) hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated transition-opacity duration-(--duration-fast)"
    >
      {children}
    </button>
  );
}
