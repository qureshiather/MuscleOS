import type { Metadata } from 'next';
import { Bricolage_Grotesque, Source_Sans_3, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

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
  title: 'MuscleOS — Train hard. Recover on schedule.',
  description:
    'A gym log with a recovery map. Built-in programs, set tracking, and a clear view of which muscles are ready — free Basic tier, optional Pro.',
  openGraph: {
    title: 'MuscleOS',
    description: 'Train hard. Recover on schedule.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased font-body">{children}</body>
    </html>
  );
}
