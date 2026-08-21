import { SerwistRegister } from '@/components/SerwistRegister';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { FONT_CLASSES } from '@/lib/fonts';
import { AppShell } from '@/components/AppShell';
import { CookieConsent } from '@/components/CookieConsent';
import { LaunchBanner } from '@/components/LaunchBanner';

import { HeatmapTracker } from '@/components/HeatmapTracker';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { loadAllSeriesMeta } from '@/lib/series';
import { isBettingConfigured } from '@/lib/betting/client';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '../globals.css';

const GA_MEASUREMENT_ID = 'G-DDMJ2NMBWC';
const ADSENSE_CLIENT_ID = 'ca-pub-3573600995951624';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TITLE} — Personal motorsport companion`,
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
  themeColor: '#f7f3e8',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NavSeriesMeta pick: AppShell is a client component, so this list rides the
  // RSC flight payload of EVERY (app) page — full SeriesMeta would ship icsUrl
  // and friends to every visitor (the machine-readable half of the old /about
  // leak). The chrome needs exactly these four fields.
  const seriesList = (await loadAllSeriesMeta()).map(({ slug, name, color, category }) => ({
    slug,
    name,
    color,
    category,
  }));

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      appearance={{
        variables: {
          colorBackground: '#fffcf2',
          colorText: '#1e1a13',
          colorPrimary: '#8c1c13',
          colorTextOnPrimaryBackground: '#f7f3e8',
          colorInputBackground: '#fbf7ec',
          colorInputText: '#1e1a13',
        },
      }}
    >
      <html
        lang="en"
        data-theme="paper"
        className={FONT_CLASSES}
      >
        <body className="min-h-screen bg-bg text-text">
          {/* First child on purpose: parser-blocking pre-paint theme init. */}
          <ThemeScript />
          {/* Clerk's SDK + frontend API are the single biggest unused-JS item
              (audit baseline); warm the connection early. */}
          <link rel="preconnect" href="https://clerk.paddock-tracker.com" />
          <Script id="consent-default" strategy="beforeInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: 'denied',
                wait_for_update: 500
              });
            `}
          </Script>
          <AppShell seriesList={seriesList} bettingEnabled={isBettingConfigured()}>
            <LaunchBanner />
            {children}
          </AppShell>
          {/* Custom consent UI replacing Google Funding Choices (0.12.6). FC
              was dropped because adsbygoogle.js never summons a banner until
              the AdSense site is approved, leaving Consent Mode v2 stuck on
              `denied` and GA4 firing nothing for EU/UK visitors. This modal
              flips the signals on user choice and persists to localStorage. */}
          <CookieConsent />
          {/* AssistantWidget unmounted 2026-08-21 (operator: "until fixed we
              can remove agent/assistant"). Its own source already described
              itself as a non-functional "not available yet" chat button. The
              component is left in the tree, not deleted, so rewiring it is a
              one-line remount rather than a rebuild. */}
          <HeatmapTracker />
          {/* Deferred to lazyOnload (was afterInteractive): none of these are
              needed for first paint — AdSense isn't even approved yet, and GA4
              fires fine post-idle (consent updates queue into dataLayer, which
              the consent-default gtag shim buffers until GTM loads). Together
              ~319 KiB of the unused-JS budget moves off the critical path. */}
          <Script
            id="adsense-init"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            strategy="lazyOnload"
            crossOrigin="anonymous"
          />
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="lazyOnload"
          />
          <Script id="ga-init" strategy="lazyOnload">
            {`
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
          <SerwistRegister />
        </body>
      </html>
    </ClerkProvider>
  );
}
