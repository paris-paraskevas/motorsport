import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Saira_Condensed } from 'next/font/google';
import { ThemeScript } from '@/components/theme/ThemeScript';
import '../globals.css';

// Root layout for the service worker's offline fallback route. The app has no
// shared top-level layout (the (app) and (marketing) groups each carry their
// own), so /offline brings a deliberately bare one: fonts + tokens only — no
// Clerk, no analytics, no app shell. Everything here must render from the
// precache with zero network.
const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-saira',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Offline — Paddock Tracker',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#07070a',
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
      className={`dark ${GeistSans.className} ${GeistMono.variable} ${saira.variable}`}
    >
      <body className="min-h-screen bg-bg text-text">
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
