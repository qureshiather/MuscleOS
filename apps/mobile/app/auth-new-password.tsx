import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { fontScaleCap } from '@/theme/layout';

/**
 * Two entry points:
 * - a password-recovery link (default): set a new password, Skip goes home
 * - `mode=change` from Account: confirm the current password first, Back returns to Account
 */
export default function AuthNewPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isChange = mode === 'change';
  const email = useAuthStore((s) => s.user?.email ?? null);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const passwordsMatch = password === confirm;
  const showMismatch = confirm.length > 0 && !passwordsMatch;

  async function save() {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Type the same password in both fields.');
      return;
    }
    setSaving(true);
    if (isChange) {
      // updateUser alone doesn't check the old password; re-verify it so an unlocked phone
      // isn't enough to take over the account.
      if (!email) {
        setSaving(false);
        Alert.alert('Could not update password', 'Sign in again and retry.');
        return;
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (verifyError) {
        setSaving(false);
        Alert.alert('Current password is wrong', 'Check it and try again, or use Forgot password on the sign-in screen.');
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }
    if (isChange) {
      Alert.alert('Password updated', 'Use your new password next time you sign in with email.');
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }

  function leave() {
    if (isChange) router.back();
    else router.replace('/(tabs)');
  }

  return (
    <Screen>
      <View style={styles.body}>
        <Pressable onPress={leave} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary }]}>{isChange ? 'Back' : 'Skip'}</Text>
        </Pressable>
        <Text style={[typography.screenTitle, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>
          {isChange ? 'Change password' : 'New password'}
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          {isChange
            ? `Change the password you use to sign in as ${email ?? 'this email'}. Apple and Google sign-in are unchanged.`
            : 'Choose a password for this email account. Apple and Google sign-in are unchanged.'}
        </Text>
        {isChange ? (
          <PasswordField placeholder="Current password" value={current} onChangeText={setCurrent} />
        ) : null}
        <PasswordField
          placeholder="New password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
        />
        <PasswordField placeholder="Confirm password" value={confirm} onChangeText={setConfirm} />
        {showMismatch ? (
          <Text style={[typography.caption, styles.mismatch, { color: colors.danger }]}>
            Passwords do not match.
          </Text>
        ) : null}
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save password'}
          onPress={() => void save()}
          disabled={saving || password.length < 6 || !passwordsMatch || (isChange && current.length === 0)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.lg + 4 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.lg },
  mismatch: { marginTop: -spacing.sm, marginBottom: spacing.md },
});
