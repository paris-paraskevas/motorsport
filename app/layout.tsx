import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { AppShell } from '@/components/AppShell';
import { loadAllSeriesMeta } from '@/lib/series';
import './globals.css';

const SITE_URL = 'https://motorsport-pi.vercel.app';
const SITE_TITLE = 'Motorsport';
const SITE_DESCRIPTION =
  'Personal motorsport companion — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: '/manifest.json',
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
    <html lang="en" className={`${GeistSans.className} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <AppShell seriesList={seriesList}>{children}</AppShell>
      </body>
    </html>
  );
}
