'use client';

export function ReopenConsentButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new Event('paddock:reopen-consent'));
      }}
      className="text-sm font-medium text-bg bg-text hover:bg-text-muted rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
    >
      Cookie preferences
    </button>
  );
}
