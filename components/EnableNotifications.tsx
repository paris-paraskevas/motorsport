'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Bell, BellOff, BellRing } from 'lucide-react';
import {
  getPushAvailability,
  getServerPushStatus,
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushClient';
import { Accordion } from './Accordion';

type Status =
  | 'checking'
  | 'unsupported'
  | 'no-vapid'
  | 'server-not-ready'
  | 'idle'
  | 'denied'
  | 'subscribed'
  | 'working';

export function EnableNotifications() {
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const avail = getPushAvailability();
      if (avail === 'unsupported') return setStatus('unsupported');
      if (avail === 'no-vapid') return setStatus('no-vapid');

      const server = await getServerPushStatus();
      if (cancelled) return;
      if (!server || !server.ready) {
        setStatus('server-not-ready');
        setMessage(
          !server
            ? 'Could not reach the server.'
            : !server.kvConfigured
              ? 'Notifications storage (Vercel KV) isn\'t connected yet.'
              : 'Server isn\'t fully configured for push yet.',
        );
        return;
      }

      const s = await getPushSubscriptionState();
      if (cancelled) return;
      if (s === 'denied') return setStatus('denied');
      setStatus(s === 'subscribed' ? 'subscribed' : 'idle');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setStatus('working');
    setMessage(null);
    try {
      await subscribeToPush();
      setStatus('subscribed');
      setMessage('Notifications enabled — pings at ~30 and ~10 min before sessions, plus race results.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      if (msg === 'denied') {
        setStatus('denied');
      } else {
        setStatus('idle');
        setMessage(msg);
      }
    }
  };

  const disable = async () => {
    setStatus('working');
    setMessage(null);
    try {
      await unsubscribeFromPush();
      setStatus('idle');
      setMessage('Notifications disabled.');
    } catch (err) {
      setStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Failed to disable.');
    }
  };

  const sendTest = async () => {
    setMessage(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMessage(`Test sent (${data?.sent ?? 0} delivered).`);
      } else {
        throw new Error(data?.error || `error (${res.status})`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Test failed.');
    }
  };

  const statusIcon =
    status === 'subscribed' ? (
      <BellRing size={20} className="text-emerald-400" />
    ) : status === 'denied' ? (
      <BellOff size={20} className="text-text-faint" />
    ) : (
      <Bell size={20} className="text-text-muted" />
    );

  return (
    <div className="border-t border-border">
      <Accordion
        title="Session notifications"
        subtitle="Pushes to this device ~30 and ~10 min before sessions in your followed series, plus a ping when a race's results land."
        icon={statusIcon}
      >
        {/* The subscribe/test APIs are auth-protected; the page no longer is.
            Guests get the why instead of a button that 401s. */}
        {isLoaded && !isSignedIn ? (
          <div className="text-text-faint text-sm">
            Sign in above to enable push notifications on this device.
          </div>
        ) : (
          <>
            {status === 'checking' && (
              <div className="text-text-faint text-sm">Checking…</div>
            )}

            {status === 'unsupported' && (
              <div className="text-text-faint text-sm">
                Push notifications aren&apos;t supported on this browser.
              </div>
            )}

            {status === 'no-vapid' && (
              <div className="text-amber-400 text-sm">
                Server isn&apos;t configured for push yet. (Missing VAPID env vars.)
              </div>
            )}

            {status === 'server-not-ready' && (
              <div className="text-amber-400 text-sm">{message}</div>
            )}

            {status === 'denied' && (
              <div className="text-amber-400 text-sm">
                Notifications are blocked in browser settings. Allow them for this site to enable.
              </div>
            )}

            {(status === 'idle' || status === 'working') && (
              <button
                type="button"
                onClick={enable}
                disabled={status === 'working'}
                className="inline-flex items-center gap-2 text-sm font-medium font-bold text-black bg-brand hover:bg-brand-deep disabled:opacity-50 px-4 py-2 transition-colors"
              >
                <Bell size={14} />
                {status === 'working' ? 'Enabling…' : 'Enable notifications'}
              </button>
            )}

            {status === 'subscribed' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={sendTest}
                  className="inline-flex items-center gap-1.5 text-xs font-medium font-mono text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors"
                >
                  Send test
                </button>
                <button
                  type="button"
                  onClick={disable}
                  className="inline-flex items-center gap-1.5 text-xs font-medium font-mono text-text-faint hover:text-text-muted px-3 py-1.5 transition-colors"
                >
                  Turn off
                </button>
              </div>
            )}

            {message && status !== 'server-not-ready' && (
              <div className="mt-3 text-xs text-text-muted">{message}</div>
            )}
          </>
        )}
      </Accordion>
    </div>
  );
}
