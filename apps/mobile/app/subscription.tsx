import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const load = useSubscriptionStore((s) => s.load);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const setPro = useSubscriptionStore((s) => s.setPro);
  const setFree = useSubscriptionStore((s) => s.setFree);
  const state = useSubscriptionStore((s) => s.state);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  useEffect(() => {
    load();
  }, [load]);

  const pro = isPro();

  async function handleUpgrade() {
    // Stub: in production would launch IAP flow. For now set Pro with 1 year expiry.
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await setPro(expiresAt.toISOString());
  }

  async function handleRestore() {
    // Stub: in production would call IAP restore and then set state from receipt.
    await load();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Subscription</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Unlock custom templates, full catalog & recovery insights
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
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
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>• Full exercise catalog</Text>
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>• Recovery insights</Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleUpgrade}
              >
                <Text style={styles.primaryBtnText}>Upgrade to Pro</Text>
              </Pressable>
              <Text style={[styles.stubHint, { color: colors.textMuted }]}>
                In-app purchase will be wired here (IAP / RevenueCat).
              </Text>
            </View>
          )}
          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: colors.surface }]}
            onPress={handleRestore}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Restore purchases</Text>
          </Pressable>
          {pro && (
            <Pressable
              style={[styles.textBtn]}
              onPress={() => setFree()}
            >
              <Text style={[styles.textBtnText, { color: colors.textMuted }]}>Reset to Free (dev)</Text>
            </Pressable>
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
  primaryBtn: { padding: 16, borderRadius: 12, marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  stubHint: { fontSize: 12, marginTop: 12 },
  secondaryBtn: { padding: 16, borderRadius: 12, marginTop: 8 },
  secondaryBtnText: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  textBtn: { marginTop: 16, alignSelf: 'center' },
  textBtnText: { fontSize: 14 },
});
