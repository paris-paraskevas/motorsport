import { SerwistRegister } from '@/components/SerwistRegister';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { FONT_CLASSES } from '@/lib/fonts';
import { AppShell } from '@/components/AppShell';
import { CookieConsent } from '@/components/CookieConsent';
import { WhatsNewModal } from '@/components/whats-new/WhatsNewModal';
import { SupportPrompt } from '@/components/SupportPrompt';
import { DeveloperToolbar } from '@/components/page/DeveloperToolbar';

import { HeatmapTracker } from '@/components/HeatmapTracker';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { loadAllSeriesMeta } from '@/lib/series';
import { loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { loadSearchHints } from '@/lib/design/search-hints';
import { loadApplicationDefinition } from '@/lib/design/application';
import { loadTextMessages } from '@/lib/design/text';
import { loadSettings } from '@/lib/design/settings';
import { loadThemeSet, resolveThemeAttributes, themeCss, themeOption } from '@/lib/design/themes';
import { appearanceCss, loadAppearance } from '@/lib/design/appearance';
import { isBettingConfigured } from '@/lib/betting/client';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import { SOCIAL_CARD } from '@/lib/seo';
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

// The address-bar colour follows the default theme's page colour (the designer's
// Themes, 1.0.47); Paper's warm paper when the rows cannot be read.
export async function generateViewport(): Promise<Viewport> {
  const set = await loadThemeSet();
  return {
    themeColor: themeOption(set, set.defaultKey)?.tokens.bg ?? '#f7f3e8',
    width: 'device-width',
    initialScale: 1,
  };
}

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
  // The doors, the phone bar, the footer columns, the chrome's fixed strings,
  // the application settings, the themes and the appearance from the design
  // tables, with the code as the fallback (Phase 2). One read each per isolate
  // per minute.
  const [nav, text, settings, themes, appearance, schemes, searchHints, definition] = await Promise.all([
    loadNavLists(),
    loadTextMessages(),
    loadSettings(),
    loadThemeSet(),
    loadAppearance(),
    loadAuthzSchemes(),
    loadSearchHints(),
    loadApplicationDefinition(),
  ]);
  // What a visitor gets before choosing a theme: the set's default, carried by
  // <html> exactly as the pre-paint script would set it, so the server and the
  // first paint agree. A dark default needs the dark class too, or every dark:
  // utility would render light for one paint.
  const theme = resolveThemeAttributes(themes, themes.defaultKey);
  // The operator's themes and the appearance share one generated style block:
  // the appearance's root rule first (faces, size, spacing, radius, motion),
  // then one rule per custom theme. Both empty when nothing is stored.
  const customCss = [appearanceCss(appearance), themeCss(themes)].filter(Boolean).join('\n');

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      // Clerk 7 honours only colorPrimary / colorBackground / borderRadius here;
      // colorText, colorTextOnPrimaryBackground and colorInput* were silently
      // ignored (verified: --cl-color-* were unset at runtime while the heading
      // still computed to white). Worse, the hard-coded light colorBackground
      // painted the card cream on the dark themes while Clerk kept its own white
      // heading — that is the unreadable sign-in modal.
      //
      // Clerk 7's default theme follows the CSS `color-scheme` property, and
      // globals.css already declares it per theme (dark on :root, light on
      // newsprint / circuit / paper). So passing no background lets the modal
      // track whichever of the six themes is active, for free. Only the brand
      // accent is asserted.
      appearance={{
        variables: {
          colorPrimary: '#8c1c13',
        },
      }}
    >
      <html
        lang="en"
        data-theme={theme.dataTheme}
        data-theme-custom={theme.custom ?? undefined}
        className={`${theme.dark ? 'dark ' : ''}${FONT_CLASSES}`}
      >
        <body className="min-h-screen bg-bg text-text">
          {/* First child on purpose: parser-blocking pre-paint theme init. */}
          <ThemeScript set={themes} />
          {/* The operator's appearance (one :root rule) and their own themes
              (one rule per theme on [data-theme-custom]), after the stylesheet
              so they win at equal specificity. Empty when nothing is stored. */}
          {customCss && <style id="paddock-themes" dangerouslySetInnerHTML={{ __html: customCss }} />}
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
          <AppShell seriesList={seriesList} bettingEnabled={isBettingConfigured()} nav={nav} text={text} schemes={schemes} searchHints={searchHints} definition={definition}>
            {children}
          </AppShell>
          {/* The release announcement, a modal over whatever page the reader
              landed on (operator, 2026-08-25). Layout level beside the other
              dialogs rather than inside AppShell, because it is fixed-position
              and not an inline bar. Ships dark until an entry is `active`; the
              Application Setting `announcement.active_id` names the entry in
              force from 1.0.44 on. `LaunchBanner` used to sit beside this one
              carrying the same 'v1.0' id — retired in 0.334.88, see
              WhatsNewModal's roadmap note. */}
          <WhatsNewModal activeId={settings['announcement.active_id']} />
          {/* Custom consent UI replacing Google Funding Choices (0.12.6). FC
              was dropped because adsbygoogle.js never summons a banner until
              the AdSense site is approved, leaving Consent Mode v2 stuck on
              `denied` and GA4 firing nothing for EU/UK visitors. This modal
              flips the signals on user choice and persists to localStorage. */}
          <CookieConsent />
          {/* Dwell-triggered support ask. Layout-level on purpose: engaged time
              keeps accumulating as the reader moves between pages, and the
              component stands down while the consent modal is up. */}
          <SupportPrompt />
          {/* The runtime Developer Toolbar (APEX's bar at the foot of a running
              page; R5, 2026-09-10): a client component that draws nothing until
              Clerk says the visitor is an administrator, so every public page
              is the same cached render as before. */}
          <DeveloperToolbar />
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
