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
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const ok = resetting
      ? await sendPasswordReset(email.trim())
      : mode === 'signin'
        ? await signInWithEmailOnly(email.trim(), password)
        : await linkWithEmail(email.trim(), password, displayName.trim() || undefined);
    setLoading(false);
    if (ok && !resetting) router.replace('/(tabs)');
    if (ok && resetting) setResetting(false);
  }

  const isSignIn = mode === 'signin' && !resetting;
  const canSubmit = resetting
    ? email.trim().length > 0
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
            ? 'We email a link to this address. Open it on this phone to choose a new password.'
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
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
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
