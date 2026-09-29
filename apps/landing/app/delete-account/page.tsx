import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPageLayout } from '../components/LegalPageLayout';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../data/contact';
import { DeleteAccountClient } from './DeleteAccountClient';

export const metadata: Metadata = {
  title: 'Delete your account — MuscleOS',
  description: 'Delete your MuscleOS account and the synced copy of your data.',
};

export default function DeleteAccountPage() {
  return (
    <LegalPageLayout title="Delete your account">
      <p>
        You can delete your MuscleOS account in the app, or here without the app. Either way, the
        account and the synced copy of your data are removed from our systems.
      </p>

      <section>
        <h2>In the app</h2>
        <p>Open Profile → Account → Delete account.</p>
      </section>

      <section>
        <h2>On the web</h2>
        <DeleteAccountClient />
      </section>

      <section>
        <h2>What gets deleted</h2>
        <ul>
          <li>Your account: the email address, display name, and Apple, Google, or password sign-in</li>
          <li>
            The synced copy of your sessions, templates, folders, exercise notes, custom exercises, and
            settings, including biodata
          </li>
          <li>Sign in with Apple access for MuscleOS, which is revoked</li>
        </ul>
        <p>
          Short-term backups required for security or legal compliance may linger briefly. See the{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>What isn’t deleted</h2>
        <ul>
          <li>
            <strong>Your subscription.</strong> Deleting the account doesn’t cancel App Store or Google Play
            billing. Cancel it in your Apple or Google account settings.
          </li>
          <li>
            <strong>Data on your phone.</strong> Deleting from the web doesn’t reach into the app. Clear it
            with Profile → Account → Data → Clear all data, or uninstall MuscleOS.
          </li>
        </ul>
      </section>

      <section>
        <h2>Never linked an account?</h2>
        <p>
          Guest workouts are only stored on your phone and are never uploaded. Uninstalling the app
          removes them.
        </p>
      </section>

      <section>
        <h2>Need help?</h2>
        <p>
          Email <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> from the address on the account and we’ll
          delete it for you.
        </p>
      </section>
    </LegalPageLayout>
  );
}
