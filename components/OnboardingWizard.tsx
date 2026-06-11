'use client';
import { useEffect, useState } from 'react';
import { Bell, Check, ChevronRight } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import type { SeriesMeta } from '@/lib/types';
import { groupSeriesByCategory } from '@/lib/categories';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import {
  getPushAvailability,
  subscribeToPush,
  getPushSubscriptionState,
  getServerPushStatus,
} from '@/lib/pushClient';

type Step = 'series' | 'notifications' | 'done';

export function OnboardingWizard({ seriesList }: { seriesList: SeriesMeta[] }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { setFollowed } = useFollowedSeries();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('series');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(seriesList.map(s => s.slug)),
  );
  const [notifState, setNotifState] = useState<
    'checking' | 'idle' | 'working' | 'subscribed' | 'denied' | 'unavailable' | 'server-not-ready' | 'error'
  >('checking');
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  const evaluateAndShow = async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setOpen(false);
      return;
    }
    try {
      const res = await fetch('/api/user/onboarded');
      if (res.ok) {
        const data = (await res.json()) as { onboarded: boolean };
        setOpen(!data.onboarded);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    evaluateAndShow();
    const onReopen = () => {
      setStep('series');
      setOpen(true);
    };
    window.addEventListener('paddock:reopen-onboarding', onReopen);
    return () => {
      window.removeEventListener('paddock:reopen-onboarding', onReopen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  // Lock body scroll while wizard is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (step !== 'notifications') return;
    let cancelled = false;
    setNotifState('checking');
    setNotifMsg(null);

    const avail = getPushAvailability();
    if (avail !== 'available') {
      setNotifState('unavailable');
      setNotifMsg(
        avail === 'no-vapid'
          ? 'Push not configured on this device build.'
          : 'This browser doesn\'t support web push.',
      );
      return;
    }

    (async () => {
      const server = await getServerPushStatus();
      if (cancelled) return;
      if (!server || !server.ready) {
        setNotifState('server-not-ready');
        setNotifMsg(
          !server
            ? 'Could not reach the server. Try again later.'
            : !server.kvConfigured
              ? 'Notifications storage (Vercel KV) isn\'t connected yet. Skip for now — you can enable later from Settings.'
              : 'Server isn\'t fully configured for push yet.',
        );
        return;
      }
      const s = await getPushSubscriptionState();
      if (cancelled) return;
      if (s === 'subscribed') setNotifState('subscribed');
      else if (s === 'denied') {
        setNotifState('denied');
        setNotifMsg('Notifications are blocked in browser settings.');
      } else {
        setNotifState('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  if (!open) return null;

  const grouped = groupSeriesByCategory(seriesList);

  const toggle = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  };

  const allSelected = selected.size === seriesList.length;

  const selectAll = () =>
    setSelected(new Set(seriesList.map(s => s.slug)));
  const selectNone = () => setSelected(new Set());

  const saveSeriesAndNext = async () => {
    await setFollowed(Array.from(selected));
    setStep('notifications');
  };

  const enableNotif = async () => {
    setNotifState('working');
    setNotifMsg(null);
    try {
      await subscribeToPush();
      setNotifState('subscribed');
      setNotifMsg('All set — you\'ll get a ping ~30 min before sessions.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      if (msg === 'denied') {
        setNotifState('denied');
        setNotifMsg('Permission denied. You can enable later from Settings.');
      } else if (msg === 'dismissed') {
        setNotifState('idle');
        setNotifMsg('Prompt dismissed. You can enable later from Settings.');
      } else {
        setNotifState('error');
        setNotifMsg(msg);
      }
    }
  };

  const finish = async () => {
    try {
      await fetch('/api/user/onboarded', { method: 'POST' });
    } catch {
      /* ignore — wizard closes anyway */
    }
    setStep('done');
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-bg/95 backdrop-blur-md overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
    >
      <div className="min-h-full flex flex-col">
        <div className="max-w-2xl w-full mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-8 flex-1">
          {step === 'series' && (
            <>
              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
                  Welcome
                </div>
                <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Pick your championships
                </h1>
                <p className="mt-3 text-sm text-text-muted leading-relaxed">
                  Home and Calendar will only show sessions from the series you follow.
                  You can change this anytime in Settings.
                </p>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-medium font-mono text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs font-medium font-mono text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors"
                >
                  Clear
                </button>
                <span className="text-xs text-text-faint tabular-nums ml-auto">
                  {selected.size} / {seriesList.length}
                </span>
              </div>

              <div className="space-y-5 mb-8">
                {grouped.map(group => (
                  <section key={group.category.id}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-2 px-1">
                      {group.category.label}
                    </div>
                    <div className="border-y border-border">
                      {group.series.map((s, i) => (
                        <label
                          key={s.slug}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface transition-colors ${
                            i > 0 ? 'border-t border-border' : ''
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="flex-1 text-text text-sm font-medium">
                            {s.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={selected.has(s.slug)}
                            onChange={() => toggle(s.slug)}
                            className="w-5 h-5 rounded accent-brand cursor-pointer"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {step === 'notifications' && (
            <>
              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
                  Step 2 of 2
                </div>
                <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Get a heads-up before sessions
                </h1>
                <p className="mt-3 text-sm text-text-muted leading-relaxed">
                  Optional push notification to this device about 30 minutes before any
                  session in a followed series. You can turn it off anytime from Settings.
                </p>
              </div>

              <div className="border-y border-border py-5 md:py-6 mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <Bell size={20} className="text-text-muted shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-text text-base font-semibold">
                      Session reminders
                    </h2>
                    {(notifState === 'idle' ||
                      notifState === 'working' ||
                      notifState === 'error') && (
                      <p className="text-text-faint text-xs mt-1 leading-relaxed">
                        Browser asks for permission once you tap Enable.
                      </p>
                    )}
                  </div>
                </div>

                {notifState === 'checking' && (
                  <div className="text-text-faint text-sm">Checking…</div>
                )}

                {notifState === 'subscribed' && (
                  <div className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                    <Check size={16} /> Enabled
                  </div>
                )}

                {(notifState === 'unavailable' ||
                  notifState === 'denied' ||
                  notifState === 'server-not-ready') && (
                  <div className="space-y-2">
                    <div className="text-amber-400 text-sm">{notifMsg}</div>
                    <div className="text-text-faint text-xs leading-relaxed">
                      Tap <span className="text-text-muted font-medium">Done</span> below to finish — you can enable notifications later from your account preferences.
                    </div>
                  </div>
                )}

                {(notifState === 'idle' || notifState === 'working' || notifState === 'error') && (
                  <button
                    type="button"
                    onClick={enableNotif}
                    disabled={notifState === 'working'}
                    className="inline-flex items-center gap-2 text-sm font-medium font-bold text-black bg-brand hover:bg-brand-deep disabled:opacity-50 px-4 py-2 transition-colors"
                  >
                    <Bell size={14} />
                    {notifState === 'working' ? 'Enabling…' : 'Enable notifications'}
                  </button>
                )}

                {notifMsg &&
                  notifState !== 'unavailable' &&
                  notifState !== 'denied' &&
                  notifState !== 'server-not-ready' && (
                    <div className="mt-3 text-xs text-text-muted">{notifMsg}</div>
                  )}
              </div>
            </>
          )}
        </div>

        {/* Sticky footer with primary action */}
        <div className="sticky bottom-0 inset-x-0 bg-bg/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3">
            {step === 'series' ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await setFollowed(seriesList.map(s => s.slug));
                    setStep('notifications');
                  }}
                  className="text-sm font-medium text-text-faint hover:text-text-muted transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={saveSeriesAndNext}
                  className="inline-flex items-center gap-2 text-sm font-medium font-bold text-black bg-brand hover:bg-brand-deep px-5 py-2.5 transition-colors"
                >
                  Continue {allSelected ? '(follow all)' : `(${selected.size})`}
                  <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={finish}
                  className="text-sm font-medium text-text-faint hover:text-text-muted transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex items-center gap-2 text-sm font-medium font-bold text-black bg-brand hover:bg-brand-deep px-5 py-2.5 transition-colors"
                >
                  Done
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
