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
    return 'Account deletion is not available yet. Deploy the delete-account Edge Function, then try again.';
  }
  return message || 'Could not delete account.';
}
