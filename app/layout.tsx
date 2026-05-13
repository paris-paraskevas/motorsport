import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { AppShell } from '@/components/AppShell';
import { loadAllSeriesMeta } from '@/lib/series';
import './globals.css';

export const metadata: Metadata = {
  title: 'Motorsport',
  description: 'Personal motorsport companion',
  manifest: '/manifest.json',
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
