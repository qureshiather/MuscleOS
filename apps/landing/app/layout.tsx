import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MuscleOS — Your workout companion',
  description: 'Track workouts, browse exercises, and build strength with MuscleOS.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
