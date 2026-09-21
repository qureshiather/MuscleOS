import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { supabase } from '@/lib/supabase';

export default function AuthNewPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

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
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="New password (min 6 characters)"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Confirm password"
          placeholderTextColor={colors.textMuted}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
        />
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save password'}
          onPress={() => void save()}
          disabled={saving || password.length < 6}
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
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.md,
  },
});
