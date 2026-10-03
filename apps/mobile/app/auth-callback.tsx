import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { AUTH_CALLBACK_FALLBACK_MS } from '@/auth/emailCallback';

/**
 * `muscleos://auth-callback` — where confirm and password-recovery emails open the app. The root
 * layout's EmailAuthLinks completes the link and navigates on (New password, or the tabs; a failed
 * link alerts first). This screen only holds a spinner meanwhile, and goes to the tabs if nothing
 * happens (a link without tokens, or one already handled).
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)'), AUTH_CALLBACK_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <Screen>
      <View style={styles.body}>
        <ActivityIndicator size="large" color={colors.primary} testID="auth-callback-spinner" />
        <Text style={[typography.body, styles.label, { color: colors.textSecondary }]}>Opening your link…</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  label: { marginTop: spacing.md, textAlign: 'center' },
});
