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

export function dispatchConsentChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>(REJECT_ALL);

  useEffect(() => {
    const decided = getConsent();
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
      <div className="mx-auto max-w-3xl m-3 rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl shadow-black/60 overflow-hidden">
        {!customizing ? (
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-zinc-50 text-base font-semibold mb-1">
                  Cookies &amp; storage
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Paddock uses browser storage to remember your followed series, theme, and notification preferences.
                  No tracking by default. Read the categories before choosing.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist(ACCEPT_ALL)}
                className="text-sm font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-full px-4 py-2 transition-colors"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => persist(REJECT_ALL)}
                className="text-sm font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full px-4 py-2 transition-colors"
              >
                Reject non-essential
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(REJECT_ALL);
                  setCustomizing(true);
                }}
                className="text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-full px-4 py-2 transition-colors"
              >
                Customize
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-zinc-50 text-base font-semibold mb-1">
                  Customize preferences
                </h2>
                <p className="text-sm text-zinc-400">
                  Toggle individual categories. Functional storage is required for the app to work.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                aria-label="Back"
                className="p-1.5 -mr-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 transition-colors shrink-0"
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
                className="text-sm font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-full px-4 py-2 transition-colors"
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={() => persist(ACCEPT_ALL)}
                className="text-sm font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full px-4 py-2 transition-colors"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => persist(REJECT_ALL)}
                className="text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-full px-4 py-2 transition-colors"
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
      className={`flex items-start gap-3 p-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 ${
        disabled ? 'opacity-90' : 'cursor-pointer hover:bg-zinc-900/70'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-zinc-100 text-sm font-medium">{label}</span>
          {disabled && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="w-5 h-5 rounded accent-zinc-300 cursor-pointer disabled:cursor-not-allowed mt-0.5 shrink-0"
      />
    </label>
  );
}
