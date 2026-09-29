'use client';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../data/contact';
import {
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  normalizeCode,
  normalizeEmail,
  sendOutcome,
  verifyOutcome,
} from './flow';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

type Step =
  | { kind: 'email' }
  | { kind: 'code'; email: string }
  | { kind: 'confirm'; email: string }
  | { kind: 'deleted' };

const inputClass =
  'mt-2 block h-12 w-full rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none';
const primaryButtonClass =
  'inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white transition hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60';
const linkButtonClass =
  'text-sm text-ink-muted underline transition hover:text-ink disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60';

function useCooldown(): [number, () => void] {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until, now]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return [remaining, () => {
    const t = Date.now();
    setNow(t);
    setUntil(t + RESEND_COOLDOWN_SECONDS * 1000);
  }];
}

export function DeleteAccountClient() {
  const [framed, setFramed] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, startCooldown] = useCooldown();

  // Memory-only session: nothing is written to localStorage or cookies.
  const supabase: SupabaseClient | null = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }, []);

  useEffect(() => {
    // Refuse to render the delete button inside someone else's frame (clickjacking).
    setFramed(window.top !== window.self);
  }, []);

  if (framed || !supabase) {
    return (
      <p>
        To delete your account from the web, email{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> from the address on the account.
      </p>
    );
  }

  async function sendCode(email: string) {
    if (!supabase || cooldown > 0) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      // Never create an account from this page.
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    const outcome = sendOutcome(sendError);
    if (outcome === 'rate_limited') {
      setError('Too many requests. Wait a few minutes and try again.');
      return;
    }
    if (outcome === 'failed') {
      setError(`We couldn't send a code right now. Try again later, or email ${SUPPORT_EMAIL}.`);
      return;
    }
    startCooldown();
    setAttempts(0);
    setCodeInput('');
    setStep({ kind: 'code', email });
  }

  async function onSubmitEmail(event: React.FormEvent) {
    event.preventDefault();
    const email = normalizeEmail(emailInput);
    if (!email) {
      setError('Enter a valid email address.');
      return;
    }
    await sendCode(email);
  }

  async function onSubmitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || step.kind !== 'code') return;
    const token = normalizeCode(codeInput);
    if (!token) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: step.email,
      token,
      type: 'email',
    });
    setBusy(false);
    const outcome = verifyOutcome(verifyError);
    if (outcome === 'verified') {
      setStep({ kind: 'confirm', email: step.email });
      return;
    }
    if (outcome === 'rate_limited') {
      setError('Too many attempts. Wait a few minutes and request a new code.');
      return;
    }
    if (outcome === 'invalid_code') {
      const next = attempts + 1;
      setAttempts(next);
      setError(
        next >= MAX_CODE_ATTEMPTS
          ? 'That code didn’t work. Request a new code.'
          : 'That code is wrong or has expired.'
      );
      return;
    }
    setError(`Something went wrong. Try again, or email ${SUPPORT_EMAIL}.`);
  }

  async function onDelete() {
    if (!supabase || step.kind !== 'confirm' || !understood) return;
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase.functions.invoke('delete-account', { body: {} });
    setBusy(false);
    if (deleteError) {
      setError(`We couldn't delete the account. Try again, or email ${SUPPORT_EMAIL}.`);
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
    setStep({ kind: 'deleted' });
  }

  function startOver() {
    void supabase?.auth.signOut({ scope: 'local' });
    setStep({ kind: 'email' });
    setCodeInput('');
    setUnderstood(false);
    setError(null);
  }

  const errorNote = error ? (
    <p role="alert" className="mt-3 text-sm text-danger">
      {error}
    </p>
  ) : null;

  if (step.kind === 'deleted') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="font-display text-xl font-semibold text-ink">Your account is deleted</p>
        <p className="mt-2">
          The account and its synced copy are gone. If MuscleOS is still installed, the workouts on that
          phone stay there until you clear them or uninstall the app.
        </p>
        <p className="mt-2">
          This does not cancel an App Store or Google Play subscription. Cancel it in your Apple or Google
          account settings.
        </p>
      </div>
    );
  }

  if (step.kind === 'confirm') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-ink-muted">Signed in as</p>
        <p className="font-medium text-ink">{step.email}</p>
        <p className="mt-4">
          This permanently deletes your MuscleOS account and its synced workouts, templates, notes,
          custom exercises, and settings. It can’t be undone.
        </p>
        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>I understand my account and synced data will be deleted.</span>
        </label>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={!understood || busy}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-danger px-5 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
          <button type="button" onClick={startOver} disabled={busy} className={linkButtonClass}>
            Cancel
          </button>
        </div>
        {errorNote}
      </div>
    );
  }

  if (step.kind === 'code') {
    const lockedOut = attempts >= MAX_CODE_ATTEMPTS;
    return (
      <form onSubmit={(e) => void onSubmitCode(e)} className="rounded-2xl border border-border bg-surface p-6">
        <p>
          If an account exists for <span className="font-medium text-ink">{step.email}</span>, we sent it a
          code. It can take a minute to arrive.
        </p>
        <label htmlFor="delete-code" className="mt-4 block text-sm font-medium text-ink">
          Code
        </label>
        <input
          id="delete-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          disabled={lockedOut}
          className={`${inputClass} font-mono tracking-widest`}
        />
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || lockedOut} className={primaryButtonClass}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={() => void sendCode(step.email)}
            disabled={busy || cooldown > 0}
            className={linkButtonClass}
          >
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          </button>
          <button type="button" onClick={startOver} disabled={busy} className={linkButtonClass}>
            Use a different email
          </button>
        </div>
        {errorNote}
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmitEmail(e)} className="rounded-2xl border border-border bg-surface p-6">
      <label htmlFor="delete-email" className="block text-sm font-medium text-ink">
        Email on your MuscleOS account
      </label>
      <input
        id="delete-email"
        type="email"
        autoComplete="email"
        maxLength={254}
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        className={inputClass}
      />
      <p className="mt-2 text-sm text-ink-muted">
        We’ll email you a code to confirm it’s you. Signed in with Apple using Hide My Email? Use the
        relay address, or delete the account in the app.
      </p>
      <div className="mt-6">
        <button type="submit" disabled={busy || cooldown > 0} className={primaryButtonClass}>
          {busy ? 'Sending…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send code'}
        </button>
      </div>
      {errorNote}
    </form>
  );
}
