import { SerwistRegister } from '@/components/SerwistRegister';
import type { Metadata, Viewport } from 'next';
import { FONT_CLASSES } from '@/lib/fonts';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import { SOCIAL_CARD } from '@/lib/seo';
import { ThemeScript } from '@/components/theme/ThemeScript';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '../globals.css';

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
    // Covers every route under this group that declares no openGraph of its
    // own (/app and the blog index among them). Without it those pages shipped
    // with no og:image at all and shared as bare text links.
    images: SOCIAL_CARD,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: SOCIAL_CARD,
  },
};

export const viewport: Viewport = {
  themeColor: '#f7f3e8',
  width: 'device-width',
  initialScale: 1,
};

// Marketing root layout — deliberately bare: no ClerkProvider, no AdSense,
// no GA, no consent modal. Nothing here sets cookies or non-essential
// storage, so the landing needs no consent UI; the workstation (app) group
// keeps all of that.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="paper"
      className={FONT_CLASSES}
    >
      <body className="min-h-screen bg-bg text-text">
        <ThemeScript />
        {children}
        <SerwistRegister />
        </body>
    </html>
  );
}
