import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useSignIn } from '@/auth/signIn';

export default function AuthScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signInWithApple, signInWithGoogle, signInWithEmail } = useSignIn();
  const [loading, setLoading] = useState(false);

  async function handleApple() {
    setLoading(true);
    const ok = await signInWithApple();
    setLoading(false);
    if (ok) router.replace('/(tabs)');
  }

  async function handleGoogle() {
    setLoading(true);
    const ok = await signInWithGoogle();
    setLoading(false);
    if (ok) router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.logoContainer}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Sign in</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Use your Apple or Google account, or create a local account
        </Text>
      </View>
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={handleApple}
        />
      )}
      {Platform.OS !== 'ios' && (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleApple}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Continue with Apple (iOS only)</Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={handleGoogle}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>Continue with Google</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push('/auth-email')}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>Email / local account</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.skip} disabled={loading}>
        <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip for now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 88, height: 88 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 8 },
  appleButton: { height: 50, marginBottom: 12 },
  button: { padding: 16, borderRadius: 12, marginBottom: 12 },
  buttonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  skip: { marginTop: 24, alignSelf: 'center' },
  skipText: { fontSize: 14 },
});
