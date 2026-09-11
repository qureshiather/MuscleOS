import type { Metadata } from 'next';

import { FaqJsonLd } from '../components/FaqJsonLd';
import { FaqSection } from '../components/FaqSection';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

export const metadata: Metadata = {
  title: 'FAQ — How to work out in MuscleOS',
  description:
    'How to start a workout, log sets, change exercises, finish, and use Recovery in MuscleOS.',
};

export default function FaqPage() {
  return (
    <>
      <FaqJsonLd />
      <SiteHeader />
      <div className="bg-atmosphere relative min-h-screen">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <FaqSection heading="h1" bordered={false} />
        <SiteFooter />
      </div>
    </>
  );
}
