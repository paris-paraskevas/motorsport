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
  // Entry animation flag — flipped one frame after view becomes non-closed so
  // the initial closed-state render lands and the CSS transition then plays.
  const [animateOpen, setAnimateOpen] = useState(false);

  // First-mount decision: open if no stored consent OR stored decision is stale.
  // The setState-in-effect lint rule fires here because the decision depends on
  // browser-only state (localStorage), which isn't readable during SSR.
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

  // Schedule the open-state flip one frame after view changes to a visible
  // layer, so the closed-state render paints first and the CSS transition
  // runs. Resets to closed when view goes back to 'closed'.
  useEffect(() => {
    if (view === 'closed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimateOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setAnimateOpen(true));
    return () => cancelAnimationFrame(id);
  }, [view]);

  // Footer "Manage cookies" button (and anything else) can re-open the modal
  // by dispatching window.dispatchEvent(new Event('open-cookie-consent')).
  // Re-opens directly into the customize layer with current prefs pre-filled
  // — users who reopen are nearly always there to change something granular,
  // not to flip the binary, per the UX research notes.
  useEffect(() => {
    const handler = () => setView('customize');
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  const decide = useCallback(
    (next: ConsentPrefs) => {
      setPrefs(next);
      persist(next);
      applyConsent(next);
      setView('closed');
    },
    [],
  );

  const allowAll = () =>
    decide({ analytics: true, advertising: true, functional: true });
  const essentialOnly = () =>
    decide({ analytics: false, advertising: false, functional: false });
  const savePrefs = () => decide(prefs);
  const cancelCustomize = () => {
    // If the user opened customize from a clean state (no stored decision),
    // cancelling shouldn't dismiss — bounce them back to the main layer so
    // they still have to choose. If they opened from the footer (existing
    // stored decision), cancel is a true dismiss.
    const stored = loadStored();
    if (stored) {
      setView('closed');
    } else {
      setView('main');
    }
  };

  if (view === 'closed') return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      data-state={animateOpen ? 'open' : 'closed'}
      className="fixed inset-x-4 bottom-4 z-[100] sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-full motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out data-[state=closed]:motion-safe:translate-y-4 data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:translate-y-0 data-[state=open]:motion-safe:opacity-100"
    >
      <div
        className={`bg-surface-elevated border border-border rounded-2xl shadow-2xl mx-auto ${
          view === 'main' ? 'sm:max-w-md' : 'sm:max-w-lg'
        }`}
      >
        {view === 'main' ? (
          <MainLayer
            onAllowAll={allowAll}
            onEssentialOnly={essentialOnly}
            onCustomize={() => setView('customize')}
          />
        ) : (
          <CustomizeLayer
            prefs={prefs}
            setPrefs={setPrefs}
            onSave={savePrefs}
            onCancel={cancelCustomize}
            onBack={() => setView('main')}
            hasStoredDecision={loadStored() !== null}
          />
        )}
      </div>
    </div>
  );
}

function MainLayer({
  onAllowAll,
  onEssentialOnly,
  onCustomize,
}: {
  onAllowAll: () => void;
  onEssentialOnly: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="p-6">
      <h2
        id="cookie-consent-title"
        className="text-base font-semibold text-text tracking-tight"
      >
        Cookies on Paddock
      </h2>
      <p
        id="cookie-consent-desc"
        className="mt-2 text-sm text-text-muted leading-relaxed"
      >
        Necessary cookies keep the site working — sign-in, preferences, that&apos;s
        it. Optional analytics help us see which series people care about. Pick
        what&apos;s on. Change anytime in the footer.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <PrimaryButton autoFocus onClick={onAllowAll} className="sm:flex-1">
          Allow all
        </PrimaryButton>
        <OutlineButton onClick={onEssentialOnly} className="sm:flex-1">
          Essential only
        </OutlineButton>
        <GhostButton onClick={onCustomize}>Customize</GhostButton>
      </div>
    </div>
  );
}

function CustomizeLayer({
  prefs,
  setPrefs,
  onSave,
  onCancel,
  onBack,
  hasStoredDecision,
}: {
  prefs: ConsentPrefs;
  setPrefs: (p: ConsentPrefs) => void;
  onSave: () => void;
  onCancel: () => void;
  onBack: () => void;
  hasStoredDecision: boolean;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        {!hasStoredDecision && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors duration-(--duration-fast) focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
          >
            <ChevronLeft />
          </button>
        )}
        <h2
          id="cookie-consent-title"
          className="text-base font-semibold text-text tracking-tight"
        >
          Cookie preferences
        </h2>
      </div>
      <p
        id="cookie-consent-desc"
        className="text-sm text-text-muted leading-relaxed mb-5"
      >
        Necessary cookies are always on — without them you can&apos;t sign in or save
        preferences. Everything else is your call. Toggle a category off and we
        won&apos;t load its scripts at all.
      </p>
      <div className="space-y-2 mb-5">
        <CategoryRow
          title="Necessary"
          description="Sign-in, security, saved preferences."
          checked
          locked
        />
        <CategoryRow
          title="Analytics"
          description="Pseudonymous measurement of which series and pages people care about."
          checked={prefs.analytics}
          onChange={(v) => setPrefs({ ...prefs, analytics: v })}
        />
        <CategoryRow
          title="Advertising"
          description="Ad delivery and frequency capping. Helps keep Paddock free."
          checked={prefs.advertising}
          onChange={(v) => setPrefs({ ...prefs, advertising: v })}
        />
        <CategoryRow
          title="Functional"
          description="Optional personalization that improves the experience over time."
          checked={prefs.functional}
          onChange={(v) => setPrefs({ ...prefs, functional: v })}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <PrimaryButton autoFocus onClick={onSave}>
          Save preferences
        </PrimaryButton>
      </div>
    </div>
  );
}

function CategoryRow({
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
    <div className="flex items-start gap-3 p-3 bg-surface border border-border rounded-xl">
      <Toggle
        checked={checked}
        locked={locked}
        onChange={onChange}
        label={title}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-text">{title}</div>
          {locked && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-text-muted bg-bg border border-border">
              Always on
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-text-muted leading-relaxed">
          {description}
        </div>
      </div>
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
      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-(--duration-fast) focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
        checked ? 'bg-text' : 'bg-border'
      } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 transform rounded-full bg-bg shadow transition-transform duration-(--duration-fast) ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function PrimaryButton({
  autoFocus,
  onClick,
  children,
  className = '',
}: {
  autoFocus?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-text text-bg rounded-lg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated transition-opacity duration-(--duration-fast) ${className}`}
    >
      {children}
    </button>
  );
}

function OutlineButton({
  onClick,
  children,
  className = '',
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-text bg-transparent border border-border rounded-lg hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated transition-colors duration-(--duration-fast) ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({
  onClick,
  children,
  className = '',
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-text-muted bg-transparent rounded-lg hover:text-text hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated transition-colors duration-(--duration-fast) ${className}`}
    >
      {children}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
