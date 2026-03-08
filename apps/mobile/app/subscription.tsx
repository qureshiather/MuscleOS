import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { isRevenueCatConfigured } from '@/utils/revenueCat';
import Constants from 'expo-constants';

const __DEV__ = process.env.NODE_ENV !== 'production';
// Show "Grant Pro (testing)" in dev and in preview builds. Set EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING=true in EAS preview env. Remove before go-live.
// Read from extra (set in app.config.js) so we never touch process.env in the app — avoids crashes in production when process.env is not inlined.
const extra = Constants.expoConfig?.extra as { enableGrantProTesting?: boolean } | undefined;
const showGrantProTesting = __DEV__ || extra?.enableGrantProTesting === true;

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const load = useSubscriptionStore((s) => s.load);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const setPro = useSubscriptionStore((s) => s.setPro);
  const setFree = useSubscriptionStore((s) => s.setFree);
  const purchasePro = useSubscriptionStore((s) => s.purchasePro);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const state = useSubscriptionStore((s) => s.state);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const pro = isPro();

  async function handleUpgrade() {
    setPurchasing(true);
    const result = await purchasePro();
    setPurchasing(false);
    if (result.success) return;
    Alert.alert('Purchase failed', result.error ?? 'Could not complete purchase.');
  }

  async function handleRestore() {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (!result.success) {
      Alert.alert('Restore failed', 'Could not restore purchases. Try again.');
    }
  }

  async function handleGrantProTesting() {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await setPro(expiresAt.toISOString(), { devOverride: true });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Subscription</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Unlock custom templates, custom exercises & recovery insights
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      ) : isAnonymous ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Link your account to subscribe</Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              Your subscription will be tied to your account and restore on any device.
            </Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              Link with Google, Apple, or email to unlock Pro and purchase.
            </Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.primaryBtnText}>Link account</Text>
            </Pressable>
          </View>
          {showGrantProTesting && (
            <View style={[styles.devSection, { borderColor: colors.border }]}>
              <Text style={[styles.devLabel, { color: colors.textMuted }]}>Testing</Text>
              <Pressable style={[styles.devBtn, { backgroundColor: colors.surface }]} onPress={handleGrantProTesting}>
                <Text style={[styles.devBtnText, { color: colors.primary }]}>Grant Pro (testing)</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.tierLabel, { color: colors.textSecondary }]}>Current plan</Text>
            <Text style={[styles.tierValue, { color: pro ? colors.primary : colors.text }]}>
              {pro ? 'Pro' : 'Free'}
            </Text>
            {state?.expiresAt && pro && (
              <Text style={[styles.expiry, { color: colors.textMuted }]}>
                Renews {new Date(state.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </Text>
            )}
          </View>
          {!pro && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Pro features</Text>
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>• Custom workout templates</Text>
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>• Custom exercises</Text>
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>• Add exercises to any workout</Text>
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>• Recovery insights</Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleUpgrade}
                disabled={purchasing || !isRevenueCatConfigured()}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {isRevenueCatConfigured() ? 'Upgrade to Pro' : 'Configure RevenueCat to enable purchases'}
                  </Text>
                )}
              </Pressable>
              {!isRevenueCatConfigured() && (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  Set revenueCatApiKey in app config (or EXPO_PUBLIC_REVENUECAT_API_KEY) and use a development build to purchase. In Expo Go, use “Grant Pro (testing)” below.
                </Text>
              )}
            </View>
          )}
          {!isAnonymous && (
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: colors.surface }]}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Restore purchases</Text>
              )}
            </Pressable>
          )}
          {showGrantProTesting && (
            <View style={[styles.devSection, { borderColor: colors.border }]}>
              <Text style={[styles.devLabel, { color: colors.textMuted }]}>Testing</Text>
              {!pro ? (
                <Pressable style={[styles.devBtn, { backgroundColor: colors.surface }]} onPress={handleGrantProTesting}>
                  <Text style={[styles.devBtnText, { color: colors.primary }]}>Grant Pro (testing)</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.devBtn, { backgroundColor: colors.surface }]} onPress={() => setFree()}>
                  <Text style={[styles.devBtnText, { color: colors.textMuted }]}>Reset to Free (testing)</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  back: { marginBottom: 8 },
  backText: { fontSize: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  placeholder: { flex: 1, padding: 20, justifyContent: 'center' },
  placeholderText: { fontSize: 15, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { padding: 20, borderRadius: 16, marginBottom: 16 },
  tierLabel: { fontSize: 13, marginBottom: 4 },
  tierValue: { fontSize: 22, fontWeight: '700' },
  expiry: { fontSize: 13, marginTop: 4 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  bullet: { fontSize: 15, marginBottom: 4 },
  primaryBtn: { padding: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 12, marginTop: 12 },
  secondaryBtn: { padding: 16, borderRadius: 12, marginTop: 8, alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  devSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1 },
  devLabel: { fontSize: 12, marginBottom: 8 },
  devBtn: { padding: 12, borderRadius: 10, alignSelf: 'flex-start' },
  devBtnText: { fontSize: 14 },
});
