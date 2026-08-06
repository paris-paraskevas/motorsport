import { SerwistRegister } from '@/components/SerwistRegister';
import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { FONT_CLASSES } from '@/lib/fonts';
import { SITE_URL } from '@/lib/site';
import { ThemeScript } from '@/components/theme/ThemeScript';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '../globals.css';

// Display face, self-hosted at build time by next/font (no runtime Google
// request; GDPR-clean), the same face the (app) and (marketing) roots load.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Admin',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#121215',
  width: 'device-width',
  initialScale: 1,
};

// Standalone ROOT layout for the operator-only /admin console: a third root
// route group alongside (app) and (marketing), each with its own <html>/<body>.
// The console is an internal instrument panel, not site content, so it inherits
// NONE of the (app) chrome: no header / footer / mobile bottom bar, no assistant
// bubble, no heatmap tracker, cookie-consent modal, launch banner, AdSense/GA
// scripts, or Vercel Analytics / Speed Insights. Just the shared fonts,
// globals.css, and a ClerkProvider mirroring the (app) group so auth resolves.
// The admin gate (requireAdmin) + amber nav rail live in the nested
// admin/layout.tsx; robots noindex keeps the console out of search.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      appearance={{
        variables: {
          colorBackground: '#1b1b21',
          colorText: '#e4e4e8',
          colorPrimary: '#ffb400',
          colorTextOnPrimaryBackground: '#121215',
          colorInputBackground: '#222229',
          colorInputText: '#e4e4e8',
        },
      }}
    >
      <html
        lang="en"
        className={`dark ${FONT_CLASSES}`}
      >
        <body className="min-h-screen bg-bg text-text">
          <ThemeScript />
          {children}
          <SerwistRegister />
        </body>
      </html>
    </ClerkProvider>
  );
}
