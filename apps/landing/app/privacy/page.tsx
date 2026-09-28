import type { Metadata } from 'next';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../data/contact';
import { LEGAL_LAST_UPDATED } from '../data/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy — MuscleOS',
  description: 'Privacy policy for MuscleOS. How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p className="text-sm text-ink-muted">Last updated: {LEGAL_LAST_UPDATED}</p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          MuscleOS (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
          our mobile application and related services. Your workout data is yours — we do not sell it, and we do
          not use it for advertising.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p className="mb-3">
          MuscleOS is local-first. You can log workouts without creating an account, and the app works offline.
        </p>
        <ul className="mb-3">
          <li>
            <strong>On-device workout data.</strong> Sessions, templates, notes, custom exercises, recovery
            derived from your sessions, and settings (units, theme, sounds, optional biodata) stay on your
            device by default.
          </li>
          <li>
            <strong>A guest identifier.</strong> On first launch the app signs you in as an anonymous guest with
            Supabase. This creates a random user ID with no name or email attached. It is used to check
            subscription status and, if you later sign in with Apple or Google, to keep the workouts you already
            logged. Guest workouts are not uploaded.
          </li>
          <li>
            <strong>Account information, if you link an account.</strong> Email address (or Apple Hide My Email
            relay), and a display name if you provide one. Sign in is available via Apple (iOS), Google, or
            email. Cloud backup is one MuscleOS account per email: Apple, Google, and password with the same
            address are the same account.
          </li>
          <li>
            <strong>Synced copy, if you link an account.</strong> We store a backup of your sessions, templates,
            folders, exercise notes, custom exercises, previous-set snapshot, and app settings so you can
            restore them on another device. Recovery is not synced; it is recomputed locally from your sessions.
          </li>
          <li>
            <strong>Optional biodata you enter.</strong> Height, body weight, age, sex, and a “not natty”
            recovery toggle. Used for in-app features (the body diagram, recovery times, strength standards).
            It is included in the synced copy if you link an account. We do not collect health-sensor data and
            we have no HealthKit or Google Fit integration.
          </li>
        </ul>
        <p>
          The app also downloads the shared exercise catalog from our servers; that request contains no workout
          data. We do not use analytics, crash-reporting, or advertising SDKs, in the app or on this website, and
          we do not sell your personal information.
        </p>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <p>
          We use this information to run the MuscleOS app: to save and restore your training log, to sync a
          linked account across devices, to unlock Pro on that account, and to respond when you contact us.
          We do not use your workout history for advertising or sell it to third parties.
        </p>
      </section>

      <section>
        <h2>4. Third Parties</h2>
        <p className="mb-3">We share only what each service needs to do its job:</p>
        <ul className="mb-3">
          <li>
            <strong>Supabase</strong> — guest and account sign-in, the synced copy of your workout data, and the
            exercise catalog.
          </li>
          <li>
            <strong>RevenueCat</strong> — subscription status so Pro restores on devices signed into the same
            account. We send your MuscleOS user ID (the guest ID until you sign in), never your card number.
          </li>
          <li>
            <strong>Apple</strong> — Sign in with Apple (iOS) and App Store billing if you subscribe.
          </li>
          <li>
            <strong>Google</strong> — Sign in with Google and Google Play billing if you subscribe.
          </li>
        </ul>
        <p>
          Those companies process data under their own privacy policies. We do not receive or store your full
          payment card number.
        </p>
      </section>

      <section>
        <h2>5. Data Storage and Security</h2>
        <p>
          Local data lives in app storage on your device. When a linked account syncs, data is transmitted over
          HTTPS. You are responsible for the security of your device and any account credentials.
        </p>
      </section>

      <section>
        <h2>6. Your Rights</h2>
        <p className="mb-3">
          Depending on your location, you may have rights to access, correct, delete, or export your personal
          data.
        </p>
        <ul className="mb-3">
          <li>
            <strong>Export.</strong> Profile → Account → Data → Export my data writes a JSON file you can share. It is a
            portability copy of your history, not a full backup, and the app has no import.
          </li>
          <li>
            <strong>Clear this device.</strong> Profile → Account → Data → Clear all data removes your saved workouts,
            templates, and settings from this phone. You stay signed in. If you are signed in, your synced copy
            is kept and syncs back to the phone; delete your account to remove it.
          </li>
          <li>
            <strong>Delete your account.</strong> If you have linked an account, open Profile → Account → Delete account.
            That removes the account and the synced copy from our systems, revokes Sign in with Apple if you used
            it, wipes this device, and leaves you as a guest. Short-term backups required for security or legal compliance may linger briefly. Uninstalling
            the app also removes local data.
          </li>
        </ul>
        <p>
          Deleting your MuscleOS account does not cancel an App Store or Google Play subscription. Cancel that in
          your Apple or Google account settings.
        </p>
      </section>

      <section>
        <h2>7. Contact Us</h2>
        <p>
          Questions about this policy, an export, or account deletion: {' '}
          <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>. You can also delete a linked account in the app as
          described above.
        </p>
      </section>
    </LegalPageLayout>
  );
}
