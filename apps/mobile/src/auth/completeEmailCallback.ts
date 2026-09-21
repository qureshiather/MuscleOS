import { applyAuthUser, useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { emailCallbackNeedsNewPassword, parseEmailCallback, type EmailCallback } from '@/auth/emailCallback';

export type EmailCallbackResult =
  | { result: 'recovery' | 'signed-in' }
  | { result: 'ignored' }
  | { result: 'failed'; message: string };

/** Turn a confirm or recovery link into a Supabase session. */
export async function completeEmailCallback(url: string): Promise<EmailCallbackResult> {
  const callback = parseEmailCallback(url);
  if (!callback) return { result: 'ignored' };

  const error = await applyCallback(callback);
  if (error) return { result: 'failed', message: error };
  return { result: emailCallbackNeedsNewPassword(callback) ? 'recovery' : 'signed-in' };
}

async function applyCallback(callback: EmailCallback): Promise<string | null> {
  if (callback.kind === 'otp') {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: callback.tokenHash,
      type: callback.otpType,
    });
    if (error) return error.message;
    if (data.session?.user) {
      applyAuthUser(data.session.user, 'SIGNED_IN', useAuthStore.getState().isAnonymous);
    }
    return null;
  }

  if (callback.kind === 'code') {
    const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
    if (error) return error.message;
    if (data.session?.user) {
      applyAuthUser(data.session.user, 'SIGNED_IN', useAuthStore.getState().isAnonymous);
    }
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken,
  });
  if (error) return error.message;
  if (data.session?.user) {
    applyAuthUser(data.session.user, 'SIGNED_IN', useAuthStore.getState().isAnonymous);
  }
  return null;
}
