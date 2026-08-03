import type { Metadata, Viewport } from 'next';
import { FONT_CLASSES } from '@/lib/fonts';
import { ThemeScript } from '@/components/theme/ThemeScript';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '../globals.css';

// Root layout for the service worker's offline fallback route. The app has no
// shared top-level layout (the (app) and (marketing) groups each carry their
// own), so /offline brings a deliberately bare one: fonts + tokens only — no
// Clerk, no analytics, no app shell. Everything here must render from the
// precache with zero network.
export const metadata: Metadata = {
  title: 'Offline — Paddock Tracker',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#121215',
  width: 'device-width',
  initialScale: 1,
};

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${FONT_CLASSES}`}
    >
      <body className="min-h-screen bg-bg text-text">
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
