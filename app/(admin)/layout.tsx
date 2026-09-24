import { SerwistRegister } from '@/components/SerwistRegister';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth/client';
import { FONT_CLASSES } from '@/lib/fonts';
import { SITE_URL } from '@/lib/site';
import { ConsoleModeScript } from '@/components/designer/ConsoleMode';
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
  // The console's dark ground, which is its default mode. The public site keeps
  // its own paper themeColor — these are separate root layouts.
  themeColor: '#14181d',
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
    <AuthProvider look="console">
      {/* SSR default is the console's dark mode, plus `dark` so any dark:
          utility (and the shadcn primitives) resolve the same way the site's
          dark-family themes do. ConsoleModeScript corrects both pre-paint for
          an operator who has chosen light. */}
      <html
        lang="en"
        data-theme="console-dark"
        className={`dark ${FONT_CLASSES}`}
      >
        <body className="min-h-screen bg-bg text-text">
          <ConsoleModeScript />
          {children}
          <SerwistRegister />
        </body>
      </html>
    </AuthProvider>
  );
}
