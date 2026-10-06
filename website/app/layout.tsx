import type { Metadata, Viewport } from 'next';
import type React from 'react';
import './globals.css';

import { AmbientBackground } from '@/components/ambient-background';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { benchmarkSummary } from '@/lib/benchmarks';
import { I18nProvider } from '@/lib/i18n-context';

export const metadata: Metadata = {
  metadataBase: new URL('https://solidis.vcms.io'),
  title: 'Solidis | Zero-dependency RESP client for Redis',
  description: `The fastest Redis client for Node.js. Zero dependencies, RESP2 and RESP3, TypeScript-first. Up to ${benchmarkSummary.peakLead.toFixed(1)}x faster than the next-fastest client.`,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <AmbientBackground />
        <I18nProvider>
          <Navbar />
          <main className="min-h-screen relative">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
