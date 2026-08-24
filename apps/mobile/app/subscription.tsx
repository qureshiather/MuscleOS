import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { isRevenueCatConfigured } from '@/utils/revenueCat';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Constants from 'expo-constants';

const __DEV__ = process.env.NODE_ENV !== 'production';
const extra = Constants.expoConfig?.extra as { enableGrantProTesting?: boolean } | undefined;
const showGrantProTesting = __DEV__ || extra?.enableGrantProTesting === true;

const PRO_FEATURES = [
  'Custom workout templates',
  'Custom exercises',
  'Add exercises mid-workout',
  'Recovery insights',
] as const;

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
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Text style={[typography.label, { color: colors.accent }]}>Back</Text>
        </Pressable>
        <Text style={[typography.screenTitle, { color: colors.text }]}>Subscription</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Templates, custom exercises, and recovery tools for serious training.
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.scroll}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </View>
      ) : isAnonymous ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card>
            <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
              Link your account
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Subscriptions are tied to your account so Pro restores on any device.
            </Text>
            <PrimaryButton label="Link account" onPress={() => router.push('/auth')} />
          </Card>
          {showGrantProTesting && (
            <View style={[styles.devSection, { borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Testing
              </Text>
              <Pressable
                style={[styles.devBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleGrantProTesting}
              >
                <Text style={[typography.label, { color: colors.primary }]}>Grant Pro (testing)</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Current plan
            </Text>
            <Text style={[typography.dataLarge, { color: pro ? colors.primary : colors.text }]}>
              {pro ? 'Pro' : 'Free'}
            </Text>
            {state?.expiresAt && pro && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Renews{' '}
                {new Date(state.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </Text>
            )}
          </Card>
          {!pro && (
            <Card>
              <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.md }]}>
                Included with Pro
              </Text>
              {PRO_FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>{feature}</Text>
                </View>
              ))}
              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, opacity: purchasing ? 0.8 : 1 },
                ]}
                onPress={handleUpgrade}
                disabled={purchasing || !isRevenueCatConfigured()}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[typography.button, { color: '#fff', textAlign: 'center' }]}>
                    {isRevenueCatConfigured() ? 'Upgrade to Pro' : 'Configure RevenueCat to enable purchases'}
                  </Text>
                )}
              </Pressable>
              {!isRevenueCatConfigured() && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
                  Set revenueCatApiKey in app config and use a development build. In Expo Go, use Grant Pro
                  (testing).
                </Text>
              )}
            </Card>
          )}
          {!isAnonymous && (
            <Pressable
              style={[
                styles.secondaryBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[typography.button, { color: colors.text }]}>Restore purchases</Text>
              )}
            </Pressable>
          )}
          {showGrantProTesting && (
            <View style={[styles.devSection, { borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Testing
              </Text>
              {!pro ? (
                <Pressable
                  style={[styles.devBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleGrantProTesting}
                >
                  <Text style={[typography.label, { color: colors.primary }]}>Grant Pro (testing)</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.devBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setFree()}
                >
                  <Text style={[typography.label, { color: colors.textMuted }]}>Reset to Free (testing)</Text>
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
  header: { padding: spacing.lg + 4, paddingBottom: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  subtitle: { marginTop: spacing.sm },
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  secondaryBtn: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  devSection: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1 },
  devBtn: {
    padding: spacing.md,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
});
