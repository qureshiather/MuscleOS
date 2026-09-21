import { describe, expect, it } from 'vitest';
import { edgeFunctionErrorMessage } from './edgeFunctionError';

describe('edgeFunctionErrorMessage', () => {
  it('uses a JSON error field on data', async () => {
    await expect(
      edgeFunctionErrorMessage({ message: 'Edge Function returned a non-2xx status code' }, { error: 'Unauthorized' })
    ).resolves.toBe('Unauthorized');
  });

  it('reads JSON from the fetch Response context', async () => {
    const context = {
      json: async () => ({ error: 'Server misconfigured' }),
    };
    await expect(
      edgeFunctionErrorMessage({ message: 'Edge Function returned a non-2xx status code', context }, null)
    ).resolves.toBe('Server misconfigured');
  });

  it('explains a bare non-2xx as a missing function', async () => {
    await expect(
      edgeFunctionErrorMessage({ message: 'Edge Function returned a non-2xx status code' }, null)
    ).resolves.toBe(
      'Account deletion is not available yet. Deploy the delete-account Edge Function, then try again.'
    );
  });
});
