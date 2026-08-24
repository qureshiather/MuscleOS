import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useSignIn } from '@/auth/signIn';

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { signInWithApple, signInWithGoogle } = useSignIn();
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
        <Text style={[typography.screenTitle, { color: colors.text, marginTop: spacing.md }]}>MuscleOS</Text>
      </View>
      <View style={styles.header}>
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Sign in</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Link an account to subscribe and restore Pro on any device.
        </Text>
      </View>
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.md}
          style={styles.appleButton}
          onPress={handleApple}
        />
      )}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={handleGoogle}
        disabled={loading}
      >
        <Text style={[typography.button, { color: colors.text }]}>Continue with Google</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push('/auth-email')}
        disabled={loading}
      >
        <Text style={[typography.button, { color: colors.text }]}>Continue with Email</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.skip} disabled={loading}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Skip for now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg + 4 },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 80, height: 80, borderRadius: radius.lg },
  header: { marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm },
  appleButton: { height: 50, marginBottom: spacing.md },
  button: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  skip: { marginTop: spacing.xl, alignSelf: 'center' },
});
