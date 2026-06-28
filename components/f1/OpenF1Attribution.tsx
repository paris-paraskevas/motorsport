// Required on every OpenF1-powered surface. OpenF1 data is CC BY-NC-SA 4.0
// (attribution + non-commercial); the underlying timing data is Formula One
// Management's and OpenF1 is an unofficial, independent project. Mirrors the
// f1db circuit-SVG credit style. Pure — safe in server components.
export function OpenF1Attribution({ className = '' }: { className?: string }) {
  return (
    <p
      className={`font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint ${className}`}
    >
      Timing data via{' '}
      <a
        href="https://openf1.org"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-text-muted"
      >
        OpenF1
      </a>{' '}
      (CC BY-NC-SA 4.0) · Unofficial — not affiliated with Formula 1.
    </p>
  );
}
