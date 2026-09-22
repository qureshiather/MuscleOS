import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useSignIn } from '@/auth/signIn';
import { ACCOUNT_PER_EMAIL_COPY } from '@/auth/accountCopy';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Mode = 'signin' | 'signup';

export default function AuthEmailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { linkWithEmail, signInWithEmailOnly, sendPasswordReset } = useSignIn();
  const [mode, setMode] = useState<Mode>('signin');
  const [resetting, setResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mailNotice, setMailNotice] = useState<null | 'confirm' | 'reset' | 'reset-failed'>(null);

  async function handleSubmit() {
    setLoading(true);
    if (resetting) {
      const sent = await sendPasswordReset(email.trim());
      setLoading(false);
      if (sent === 'missing') return;
      setMailNotice(sent ? 'reset' : 'reset-failed');
      if (sent) setResetting(false);
      return;
    }
    if (mode === 'signin') {
      const ok = await signInWithEmailOnly(email.trim(), password);
      setLoading(false);
      if (ok) router.replace('/(tabs)');
      return;
    }
    const result = await linkWithEmail(email.trim(), password, displayName.trim() || undefined);
    setLoading(false);
    if (result === true) router.replace('/(tabs)');
    if (result === 'confirm') setMailNotice('confirm');
  }

  const isSignUp = mode === 'signup' && !resetting;
  const isSignIn = mode === 'signin' && !resetting;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = resetting
    ? email.trim().length > 0
    : isSignUp
      ? email.trim().length > 0 && password.length >= 6 && confirmPassword.length >= 6 && passwordsMatch
      : email.trim().length > 0 && password.length >= 6;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <Pressable
          onPress={() => {
            if (resetting) setResetting(false);
            else router.back();
          }}
          style={styles.backRow}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary }]}>Back</Text>
        </Pressable>

        <Text style={[typography.screenTitle, { color: colors.text }]}>
          {resetting ? 'Reset password' : isSignIn ? 'Sign in' : 'Create account'}
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          {resetting
            ? 'We will email a link to reset the password if the email exists.'
            : isSignIn
              ? 'If you already used Apple or Google with this email, this is the same account — not a second backup.'
              : ACCOUNT_PER_EMAIL_COPY}
        </Text>

        {!resetting ? (
          <SegmentedControl
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create' },
            ]}
            value={mode}
            onChange={setMode}
          />
        ) : null}

        <View style={styles.form}>
          {!isSignIn && !resetting ? (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Display name (optional)"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!resetting ? (
            <PasswordField
              placeholder="Password (min 6 characters)"
              value={password}
              onChangeText={setPassword}
            />
          ) : null}
          {isSignUp ? (
            <>
              <PasswordField
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <Text style={[typography.caption, styles.mismatch, { color: colors.danger }]}>
                  Passwords do not match.
                </Text>
              ) : null}
            </>
          ) : null}
          {isSignIn ? (
            <Pressable onPress={() => setResetting(true)} style={styles.forgot} hitSlop={8}>
              <Text style={[typography.caption, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>
          ) : null}
          <PrimaryButton
            label={
              loading ? 'Please wait…' : resetting ? 'Send reset link' : isSignIn ? 'Sign in' : 'Create account'
            }
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
          />
        </View>
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={mailNotice != null}
        title={
          mailNotice === 'reset-failed'
            ? 'Could not send reset link'
            : mailNotice === 'reset'
              ? 'Check your email'
              : 'Confirm your email'
        }
        message={
          mailNotice === 'reset-failed'
            ? 'Something went wrong sending the reset link. Try again in a moment.'
            : mailNotice === 'reset'
              ? 'If an account exists for that email, we sent a reset link. Open it on this phone.'
              : 'We sent you a confirmation link. Open it to activate your account, then come back and sign in.'
        }
        confirmLabel="OK"
        onConfirm={() => setMailNotice(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1, padding: spacing.lg + 4 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.lg },
  forgot: { alignSelf: 'flex-start', marginBottom: spacing.md, marginTop: -spacing.xs },
  mismatch: { marginTop: -spacing.sm, marginBottom: spacing.md },
  form: { marginTop: spacing.xl },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.md,
  },
});
