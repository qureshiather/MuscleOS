/**
 * First-device Apple/Google: linkIdentity upgrades the anonymous guest in place.
 * Another device: that identity already belongs to the original user, so we sign
 * into that user instead of failing the link. The same goes for a new provider whose
 * email already has an account (Apple first, then Google): signInWithIdToken links it
 * to that account by email, so one email stays one MuscleOS account.
 */

type LinkError = { message?: string; code?: string } | null;

/** Why linkIdentity refused: the identity, or its email, already belongs to another user. */
export function linkConflict(error: LinkError): 'identity' | 'email' | null {
  if (!error) return null;
  const code = (error.code ?? '').toLowerCase();
  const msg = (error.message ?? '').toLowerCase();
  if (
    code.includes('identity_already') ||
    msg.includes('already linked') ||
    msg.includes('identity is already') ||
    msg.includes('already associated')
  ) {
    return 'identity';
  }
  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('email address already')
  ) {
    return 'email';
  }
  return null;
}

/** Signing in from the picker: either conflict means "sign into that account instead". */
export function identityAlreadyLinked(error: LinkError): boolean {
  return linkConflict(error) != null;
}

type SignUpResult = {
  data: { user?: { identities?: unknown[] | null } | null; session?: unknown } | null;
  error: LinkError;
};

/**
 * What an email signUp means. The address already has an account when GoTrue says so (email
 * confirmations off) or, with confirmations on, when it returns a placeholder user with no
 * identities and sends no email (its anti-enumeration response). Either way we sign into that
 * account with the entered password instead of showing "check your email".
 */
export function signUpOutcome({ data, error }: SignUpResult): 'existing' | 'error' | 'signed_in' | 'confirm' {
  if (error) return linkConflict(error) === 'email' ? 'existing' : 'error';
  if (data?.session && data.user) return 'signed_in';
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return 'existing';
  return 'confirm';
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
