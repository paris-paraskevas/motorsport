'use client';

export function ManageCookiesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}
      className="block py-1 text-text-muted hover:text-text transition-colors duration-(--duration-fast) text-left w-full bg-transparent border-0 p-0 cursor-pointer font-inherit"
    >
      Manage cookies
    </button>
  );
}
