import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppShell } from '@/components/AppShell';
import { CookieConsent } from '@/components/CookieConsent';
import { loadAllSeriesMeta } from '@/lib/series';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
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
  themeColor: '#0a0a0a',
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
          colorBackground: '#0a0a0a',
          colorText: '#fafafa',
          colorPrimary: '#fafafa',
          colorTextOnPrimaryBackground: '#0a0a0a',
          colorInputBackground: '#18181b',
          colorInputText: '#fafafa',
        },
      }}
    >
      <html lang="en" className={`${GeistSans.className} ${GeistMono.variable}`}>
        <body className="min-h-screen bg-bg text-text">
          {/* Theme bootstrap — sync apply saved preference before paint to prevent FOUC.
              Runs as the first body child so [data-theme] is set before AppShell renders. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('paddock-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
            }}
          />
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
          <Script
            id="adsense-init"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
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
