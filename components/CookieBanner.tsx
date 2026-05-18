'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ACCEPT_ALL,
  REJECT_ALL,
  ConsentCategories,
  getConsent,
  setConsent,
} from '@/lib/consent';

const CONSENT_CHANGED_EVENT = 'paddock:consent-changed';
const ANON_ID_KEY = 'paddock:consent-id';

export function dispatchConsentChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

/**
 * Mirror the user's per-category choice into Google Consent Mode v2 so
 * GA / AdSense react immediately. Defaults set in app/layout.tsx are
 * 'denied' for everything; this updates them on user action.
 */
function updateGtagConsent(c: ConsentCategories): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
    .gtag;
  if (typeof gtag !== 'function') return;
  gtag('consent', 'update', {
    ad_storage: c.marketing ? 'granted' : 'denied',
    ad_user_data: c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
    analytics_storage: c.analytics ? 'granted' : 'denied',
  });
}

/**
 * Best-effort server-side consent log so we can demonstrate compliance
 * with GDPR Article 7(1). Stored in Vercel KV by /api/consent. Failure
 * is silent — local storage remains the authoritative record.
 */
function logConsentToServer(c: ConsentCategories): void {
  if (typeof window === 'undefined') return;
  let anonymousId = window.localStorage.getItem(ANON_ID_KEY);
  if (!anonymousId) {
    anonymousId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      window.localStorage.setItem(ANON_ID_KEY, anonymousId);
    } catch {
      /* ignore */
    }
  }
  fetch('/api/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: c, version: 1, anonymousId }),
    keepalive: true,
  }).catch(() => {
    /* best effort */
  });
}

function gpcEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator as unknown as { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>(REJECT_ALL);

  useEffect(() => {
    const decided = getConsent();

    // Honour Global Privacy Control: if the browser asserts GPC and the
    // user hasn't explicitly decided yet, auto-record a deny and skip
    // the banner. They can still re-open via the Cookie Policy page.
    if (!decided && gpcEnabled()) {
      setConsent(REJECT_ALL);
      updateGtagConsent(REJECT_ALL);
      logConsentToServer(REJECT_ALL);
      dispatchConsentChanged();
      return;
    }

    if (!decided) setVisible(true);

    const onReopen = () => {
      const current = getConsent();
      setDraft(current?.categories ?? REJECT_ALL);
      setCustomizing(true);
      setVisible(true);
    };
    window.addEventListener('paddock:reopen-consent', onReopen);
    return () =>
      window.removeEventListener('paddock:reopen-consent', onReopen);
  }, []);

  if (!visible) return null;

  const persist = (categories: ConsentCategories) => {
    setConsent(categories);
    updateGtagConsent(categories);
    logConsentToServer(categories);
    dispatchConsentChanged();
    setVisible(false);
    setCustomizing(false);
  };

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[60] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
    >
      <div className="mx-auto max-w-3xl m-3 rounded-2xl bg-surface-elevated/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/60 overflow-hidden">
        {!customizing ? (
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-text text-base font-semibold mb-1">
                  Cookies &amp; storage
                </h2>
                <p className="text-sm text-text-muted leading-relaxed">
                  Paddock uses browser storage to remember your followed series, theme, and notification preferences.
                  No tracking by default. Read the categories before choosing.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist(ACCEPT_ALL)}
                className="text-sm font-medium text-bg bg-text hover:bg-text-muted rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => persist(REJECT_ALL)}
                className="text-sm font-medium text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
              >
                Reject non-essential
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(REJECT_ALL);
                  setCustomizing(true);
                }}
                className="text-sm font-medium text-text-muted hover:text-text rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
              >
                Customize
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-text text-base font-semibold mb-1">
                  Customize preferences
                </h2>
                <p className="text-sm text-text-muted">
                  Toggle individual categories. Functional storage is required for the app to work.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                aria-label="Back"
                className="p-1.5 -mr-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors duration-(--duration-fast) shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <CategoryRow
                label="Functional"
                description="Saves your followed series, theme, and notification subscription locally. Required."
                value={true}
                disabled
              />
              <CategoryRow
                label="Analytics"
                description="Anonymous usage data to improve the app. None collected yet — toggle reserved for future use."
                value={draft.analytics}
                onChange={v => setDraft({ ...draft, analytics: v })}
              />
              <CategoryRow
                label="Marketing"
                description="None used. Toggle reserved for future use."
                value={draft.marketing}
                onChange={v => setDraft({ ...draft, marketing: v })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist(draft)}
                className="text-sm font-medium text-bg bg-text hover:bg-text-muted rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={() => persist(ACCEPT_ALL)}
                className="text-sm font-medium text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => persist(REJECT_ALL)}
                className="text-sm font-medium text-text-muted hover:text-text rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
              >
                Reject non-essential
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border border-border bg-surface/40 ${
        disabled ? 'opacity-90' : 'cursor-pointer hover:bg-surface'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-text text-sm font-medium">{label}</span>
          {disabled && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold">
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-text-faint mt-0.5 leading-relaxed">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="w-5 h-5 rounded accent-text cursor-pointer disabled:cursor-not-allowed mt-0.5 shrink-0"
      />
    </label>
  );
}
