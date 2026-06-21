import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Saira_Condensed } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { CookieConsent } from '@/components/CookieConsent';
import { loadAllSeriesMeta } from '@/lib/series';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import '../globals.css';

const GA_MEASUREMENT_ID = 'G-DDMJ2NMBWC';
const ADSENSE_CLIENT_ID = 'ca-pub-3573600995951624';

// Display face for the Paddock 2.0 language — self-hosted at build time by
// next/font (no runtime Google request; GDPR-clean). Same face the landing
// loads; used by the wordmark and font-display utilities.
const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-saira',
  display: 'swap',
});

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
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const seriesList = await loadAllSeriesMeta();

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      appearance={{
        variables: {
          colorBackground: '#14141a',
          colorText: '#f5f5f7',
          colorPrimary: '#ffb400',
          colorTextOnPrimaryBackground: '#07070a',
          colorInputBackground: '#1a1a22',
          colorInputText: '#f5f5f7',
        },
      }}
    >
      <html
        lang="en"
        className={`dark ${GeistSans.className} ${GeistMono.variable} ${saira.variable}`}
      >
        <body className="min-h-screen bg-bg text-text">
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
          <AppShell seriesList={seriesList}>{children}</AppShell>
          {/* Custom consent UI replacing Google Funding Choices (0.12.6). FC
              was dropped because adsbygoogle.js never summons a banner until
              the AdSense site is approved, leaving Consent Mode v2 stuck on
              `denied` and GA4 firing nothing for EU/UK visitors. This modal
              flips the signals on user choice and persists to localStorage. */}
          <CookieConsent />
          <Analytics />
          <SpeedInsights />
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
        </body>
      </html>
    </ClerkProvider>
  );
}
