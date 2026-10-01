/**
 * First-device Apple/Google: linkIdentity upgrades the anonymous guest in place.
 * Another device: that identity already belongs to the original user, so we sign
 * into that user instead of failing the link. The same goes for a new provider whose
 * email already has an account (Apple first, then Google): signInWithIdToken links it
 * to that account by email, so one email stays one MuscleOS account.
 */

export function identityAlreadyLinked(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const code = (error.code ?? '').toLowerCase();
  if (code === 'identity_already_exists' || code.includes('identity_already')) return true;
  if (code === 'email_exists' || code === 'user_already_exists') return true;
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('already linked') ||
    msg.includes('identity is already') ||
    msg.includes('already associated') ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('email address already')
  );
}

export function accountLinkSideEffect(args: {
  previousUserId: string | null;
  nextUserId: string;
  wasAnonymous: boolean;
  isNowLinked: boolean;
}): 'upload_local' | 'sync' | 'none' {
  if (!args.isNowLinked) return 'none';
  if (args.wasAnonymous && args.previousUserId != null && args.previousUserId === args.nextUserId) {
    return 'upload_local';
  }
  return 'sync';
}
