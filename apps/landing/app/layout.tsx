import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Source_Sans_3, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

import { THEME_INIT_SCRIPT } from './data/theme';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MuscleOS — Workout Tracker',
  description:
    'Track sets, reps, weight, workout history, and muscle recovery. Basic is free.',
  openGraph: {
    title: 'MuscleOS',
    description: 'Track your workouts and muscle recovery.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f7' },
    { media: '(prefers-color-scheme: dark)', color: '#14161e' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set before paint by THEME_INIT_SCRIPT, so React must not complain about it.
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap, no user input */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased font-body">{children}</body>
    </html>
  );
}
