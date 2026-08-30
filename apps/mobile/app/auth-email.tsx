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
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Mode = 'signin' | 'signup';

export default function AuthEmailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { linkWithEmail, signInWithEmailOnly } = useSignIn();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const ok =
      mode === 'signin'
        ? await signInWithEmailOnly(email.trim(), password)
        : await linkWithEmail(email.trim(), password, displayName.trim() || undefined);
    setLoading(false);
    if (ok) router.replace('/(tabs)');
  }

  const isSignIn = mode === 'signin';
  const canSubmit = email.trim().length > 0 && password.length >= 6;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary }]}>Back</Text>
        </Pressable>

        <Text style={[typography.screenTitle, { color: colors.text }]}>
          {isSignIn ? 'Sign in' : 'Create account'}
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          {isSignIn
            ? 'Use email to subscribe and restore Pro on any device.'
            : 'Create an account to subscribe and restore on any device.'}
        </Text>

        <SegmentedControl
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create' },
          ]}
          value={mode}
          onChange={setMode}
        />

        <View style={styles.form}>
          {!isSignIn && (
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
          )}
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
          <PrimaryButton
            label={loading ? 'Please wait…' : isSignIn ? 'Sign in' : 'Create account'}
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
