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
  title: 'MuscleOS — Log workouts. Track progress.',
  description:
    'Workout logging with built-in programs, custom templates, recovery, PRs, and progression. Free Basic tier. Pro from $2.99/mo.',
  openGraph: {
    title: 'MuscleOS',
    description: 'Log workouts. Track progress. Train your way.',
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
