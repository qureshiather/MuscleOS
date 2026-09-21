import type { Metadata } from 'next';
import { AuthConfirmClient } from './AuthConfirmClient';

export const metadata: Metadata = {
  title: 'Open MuscleOS',
  description: 'Confirm your email or reset your MuscleOS password.',
};

export default function AuthConfirmPage() {
  return <AuthConfirmClient />;
}
