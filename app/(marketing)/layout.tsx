import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Saira_Condensed } from 'next/font/google';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import '../globals.css';

// Display face for the Paddock 2.0 language — self-hosted at build time by
// next/font (no runtime Google request; GDPR-clean).
const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-saira',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TITLE} — Live F1, MotoGP, WEC, IndyCar & NASCAR schedule`,
    template: `%s — ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
};

// Marketing root layout — deliberately bare: no ClerkProvider, no AdSense,
// no GA, no consent modal. Nothing here sets cookies or non-essential
// storage, so the landing needs no consent UI; the workstation (app) group
// keeps all of that. Vercel Analytics/Speed Insights are cookieless.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`theme-2 ${GeistSans.className} ${GeistMono.variable} ${saira.variable}`}
    >
      <body className="min-h-screen bg-bg text-text">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
