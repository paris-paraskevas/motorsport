'use client';
import { Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';

// Compact inline team-radio player for a single Moment. Native <audio> ref (no
// library) so it stays light; mirrors PushSoundPlayer's new-Audio philosophy of
// swallowing autoplay rejections. The progress bar is read-only — a thin filled
// track, not a scrubber — to keep it small inside a timeline row.

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const rem = Math.floor(s - m * 60);
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export function TeamRadioPlayer({ src, label }: { src: string; label?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      // Autoplay may be blocked without a recent gesture; the click IS a
      // gesture, but mobile can still reject — swallow it like PushSoundPlayer.
      el.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const pct = duration > 0 ? Math.min(100, (t / duration) * 100) : 0;
  const aria = label ? `Play team radio for ${label}` : 'Play team radio';

  return (
    <div className="mt-1.5 inline-flex w-full max-w-[18rem] items-center gap-2 border border-border bg-surface/40 px-2 py-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause team radio' : aria}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-text transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-brand"
      >
        {playing ? <Pause size={12} /> : <Play size={12} className="translate-x-px" />}
      </button>

      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-(--duration-fast)"
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="w-[4.5rem] shrink-0 text-right font-mono text-[10px] tabular-nums text-text-muted">
        {fmt(t)} / {fmt(duration)}
      </span>

      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onTimeUpdate={e => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setPlaying(false);
          setT(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
    </div>
  );
}
