import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useSignIn } from '@/auth/signIn';

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
  const canSubmit = email.trim().length > 0 && password.length >= 6 && (isSignIn || true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>
            {isSignIn ? 'Sign in' : 'Create account'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isSignIn
              ? 'Sign in with your email to subscribe and restore on any device.'
              : 'Create an account to subscribe and restore on any device.'}
          </Text>
        </View>

        {!isSignIn && (
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Display name (optional)"
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || !canSubmit}
        >
          <Text style={styles.buttonText}>{isSignIn ? 'Sign in' : 'Create account'}</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode(isSignIn ? 'signup' : 'signin')}
          style={styles.switch}
        >
          <Text style={[styles.switchText, { color: colors.textMuted }]}>
            {isSignIn ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1, padding: 20 },
  header: { marginBottom: 24 },
  backText: { fontSize: 16, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  switch: { marginTop: 20, alignSelf: 'center' },
  switchText: { fontSize: 14 },
});
