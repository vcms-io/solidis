import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';

import { AmbientBackground } from '@/components/ambient-background';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { I18nProvider } from '@/lib/i18n-context';

export const metadata: Metadata = {
  title: 'Solidis | Zero-dependency RESP client for Redis',
  description:
    'The fastest Redis client for Node.js. Zero dependencies, full RESP2/RESP3 support, TypeScript-first. Up to 2x faster than ioredis.',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
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
