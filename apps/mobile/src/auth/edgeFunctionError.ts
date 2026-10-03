import { friendlyAuthError } from '@/auth/authErrors';

/** Developer hint for a delete-account call that got a bare non-2xx (function not deployed). */
export const DELETE_ACCOUNT_DEPLOY_HINT =
  'Account deletion is not available yet. Deploy the delete-account Edge Function, then try again.';

/** Prefer the function JSON body over the generic FunctionsHttpError message. */
export async function edgeFunctionErrorMessage(
  error: { message?: string; context?: unknown },
  data: unknown
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return (data as { error: string }).error;
  }

  const context = error.context;
  if (context && typeof context === 'object' && 'json' in context && typeof (context as { json: unknown }).json === 'function') {
    try {
      const body = await (context as { json: () => Promise<unknown> }).json();
      if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
        return (body as { error: string }).error;
      }
    } catch {
      // Fall through to the client message.
    }
  }

  const message = error.message?.trim();
  if (message?.includes('non-2xx')) {
    return DELETE_ACCOUNT_DEPLOY_HINT;
  }
  return message || 'Could not delete account.';
}

/**
 * What the Delete account failure dialog says. Raw function and Supabase messages never reach
 * users: known cases (network, timeout, rate limit) get plain copy, anything else a delete-specific
 * fallback. The deploy hint shows only in dev builds.
 */
export function friendlyDeleteAccountError(error: unknown, isDev: boolean): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (message === DELETE_ACCOUNT_DEPLOY_HINT) {
    return isDev ? DELETE_ACCOUNT_DEPLOY_HINT : friendlyAuthError(null, 'delete_account');
  }
  const name = error instanceof Error ? error.name : undefined;
  return friendlyAuthError({ message, name }, 'delete_account');
}
