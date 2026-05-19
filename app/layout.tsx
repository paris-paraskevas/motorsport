import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppShell } from '@/components/AppShell';
import { loadAllSeriesMeta } from '@/lib/series';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import './globals.css';

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
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
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
          {/* Google Funding Choices CMP — explicit snippet with ers=1 so the
              consent banner activates even while the AdSense account is
              under review ("Getting ready"). adsbygoogle.js alone bootstraps
              window.googlefc but does not fetch the published message until
              site approval; this snippet forces the eager path. */}
          <Script
            id="funding-choices"
            src={`https://fundingchoicesmessages.google.com/i/${ADSENSE_CLIENT_ID.replace('ca-', '')}?ers=1`}
            strategy="afterInteractive"
          />
          <Script id="funding-choices-signal" strategy="afterInteractive">
            {`
              (function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){var iframe=document.createElement('iframe');iframe.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none';iframe.name='googlefcPresent';document.body.appendChild(iframe);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();
            `}
          </Script>
          <AppShell seriesList={seriesList}>{children}</AppShell>
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
