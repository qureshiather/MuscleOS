import type { Metadata } from 'next';
import { LegalPageLayout } from '../components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — MuscleOS',
  description: 'Privacy policy for MuscleOS. How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p className="text-text-secondary mb-6">
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">1. Introduction</h2>
        <p>
          MuscleOS (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
          our mobile application and related services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">2. Information We Collect</h2>
        <p className="mb-3">
          We may collect information that you provide directly to us, including:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Account information (if you create an account)</li>
          <li>Workout data, exercise history, and progress you log in the app</li>
          <li>Device information such as device type and operating system</li>
        </ul>
        <p>
          Workout and exercise data is stored locally on your device by default. We do not sell your personal
          information to third parties.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">3. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve the MuscleOS app; to personalize
          your experience; to analyze usage and trends; and to communicate with you about updates or support
          when necessary.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">4. Data Storage and Security</h2>
        <p>
          We implement appropriate technical and organizational measures to protect your data. When data is
          synced or transmitted, we use industry-standard encryption. You are responsible for maintaining the
          security of your device and any account credentials.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">5. Your Rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export your personal
          data. You can manage or delete your data through the app settings or by contacting us.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text mb-3">6. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our practices, please contact us at{' '}
          <a href="mailto:privacy@muscleos.app">privacy@muscleos.app</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
