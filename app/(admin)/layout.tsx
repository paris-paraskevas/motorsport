import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Saira_Condensed } from 'next/font/google';
import { SITE_URL } from '@/lib/site';
import '../globals.css';

// Display face, self-hosted at build time by next/font (no runtime Google
// request; GDPR-clean), the same face the (app) and (marketing) roots load.
const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-saira',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Admin',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#07070a',
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
        <body className="min-h-screen bg-bg text-text">{children}</body>
      </html>
    </ClerkProvider>
  );
}
