import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { supabase } from '@/lib/supabase';

export default function AuthNewPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
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
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <Screen>
      <View style={styles.body}>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary }]}>Skip</Text>
        </Pressable>
        <Text style={[typography.screenTitle, { color: colors.text }]}>New password</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Choose a password for this email account. Apple and Google sign-in are unchanged.
        </Text>
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
          disabled={saving || password.length < 6 || !passwordsMatch}
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
