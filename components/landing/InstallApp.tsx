'use client';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// Panel 10a's second hero button. Chromium fires beforeinstallprompt and lets
// us re-trigger it; every other browser (iOS Safari, Firefox) has no install
// API at all, so there a tap reveals the browser's own path rather than doing
// nothing silently.
export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  return (
    <div className="min-w-0">
      <button
        type="button"
        data-heatmap-id="landing:install"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            setDeferred(null);
          } else {
            setHint(h => !h);
          }
        }}
        className="inline-flex min-h-11 items-center border border-border-strong px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text transition-colors duration-(--duration-fast) hover:bg-surface"
      >
        Install as an app
      </button>
      {hint && !deferred && (
        <p className="mt-2 max-w-[38ch] font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
          Use your browser&apos;s own menu: &quot;Install app&quot; on Android and desktop Chrome, Share → &quot;Add to Home Screen&quot; on iPhone.
        </p>
      )}
    </div>
  );
}
