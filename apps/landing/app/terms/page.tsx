import type { Metadata } from 'next';
import { LegalPageLayout } from '../components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service — MuscleOS',
  description: 'Terms of service for using the MuscleOS app and related services.',
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p className="text-text-secondary mb-6">
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">1. Acceptance of Terms</h2>
        <p>
          By downloading, installing, or using the MuscleOS application and related services, you agree to be
          bound by these Terms of Service. If you do not agree, do not use the app.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">2. Description of Service</h2>
        <p>
          MuscleOS provides a workout and exercise tracking application for personal use. We reserve the right
          to modify, suspend, or discontinue any part of the service at any time with or without notice.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">3. Use of the App</h2>
        <p className="mb-3">You agree to use MuscleOS only for lawful purposes. You must not:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Use the app in any way that violates applicable laws or regulations</li>
          <li>Attempt to gain unauthorized access to our systems or other users&apos; data</li>
          <li>Reverse engineer, decompile, or disassemble the app except as permitted by law</li>
          <li>Use the app to harm, harass, or inconvenience others</li>
        </ul>
        <p>
          The app and its content are for general informational and tracking purposes only. They are not a
          substitute for professional medical or fitness advice. Consult a qualified professional before
          starting any exercise program.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">4. Intellectual Property</h2>
        <p>
          MuscleOS and its logo, design, and content are owned by us or our licensors. You may not copy,
          modify, distribute, or create derivative works without our prior written consent.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">5. Disclaimer of Warranties</h2>
        <p>
          The app is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
          express or implied. We do not warrant that the app will be uninterrupted, error-free, or free of
          harmful components. Your use of the app is at your sole risk.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">6. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, MuscleOS and its affiliates shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data,
          arising from your use of the app.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">7. Contact</h2>
        <p>
          For questions about these Terms of Service, please contact us at{' '}
          <a href="mailto:legal@muscleos.app">legal@muscleos.app</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
