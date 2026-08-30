import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { getOfferingPackages, hasRevenueCatApiKey, isRevenueCatConfigured } from '@/utils/revenueCat';
import {
  BASIC_FEATURES_LIST,
  PRO_FEATURES_LIST,
  PRO_FEATURE_LABELS,
  parseProFeatureParam,
} from '@/subscription/features';
import { FALLBACK_PRICE_LABELS, annualSavingsPercent } from '@/subscription/pricing';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Constants from 'expo-constants';

const __DEV__ = process.env.NODE_ENV !== 'production';
const extra = Constants.expoConfig?.extra as { enableGrantProTesting?: boolean } | undefined;
const showGrantProTesting = __DEV__ || extra?.enableGrantProTesting === true;

type PlanKey = 'monthly' | 'annual' | 'lifetime';

const PLAN_LABELS: Record<PlanKey, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  lifetime: 'Lifetime',
};

function packagePrice(pkg: PurchasesPackage | null, fallback: string): string {
  return pkg?.product.priceString ?? fallback;
}

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { feature: featureParam } = useLocalSearchParams<{ feature?: string }>();
  const highlightedFeature = parseProFeatureParam(featureParam);

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const userId = useAuthStore((s) => s.user?.id);
  const load = useSubscriptionStore((s) => s.load);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const setPro = useSubscriptionStore((s) => s.setPro);
  const setBasic = useSubscriptionStore((s) => s.setBasic);
  const purchasePackage = useSubscriptionStore((s) => s.purchasePackage);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const state = useSubscriptionStore((s) => s.state);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
  const [packages, setPackages] = useState<{
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
    lifetime: PurchasesPackage | null;
  }>({ monthly: null, annual: null, lifetime: null });

  useEffect(() => {
    void load(userId);
  }, [load, userId]);

  useEffect(() => {
    if (!hasRevenueCatApiKey()) return;
    getOfferingPackages().then(setPackages);
  }, []);

  const pro = isPro();

  const selectedPackage = packages[selectedPlan];

  const annualSavings = useMemo(() => {
    const monthly = packages.monthly?.product.price;
    const annual = packages.annual?.product.price;
    if (monthly != null && annual != null && monthly > 0) {
      const pct = Math.round((1 - annual / (monthly * 12)) * 100);
      if (pct > 0) return pct;
    }
    return annualSavingsPercent();
  }, [packages.monthly, packages.annual]);

  async function handlePurchase() {
    if (!selectedPackage) {
      Alert.alert('Unavailable', 'This plan is not configured yet. Check RevenueCat setup.');
      return;
    }
    setPurchasing(true);
    const result = await purchasePackage(selectedPackage);
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
    await setPro(expiresAt.toISOString(), { devOverride: true, plan: 'annual' });
  }

  function planSubtitle(plan: PlanKey): string | null {
    if (plan === 'annual') return `Save ${annualSavings}% vs monthly`;
    if (plan === 'lifetime') return 'Pay once, keep Pro forever';
    return null;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[typography.screenTitle, { color: colors.text }]}>Subscription</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Customize your training and track progress with Pro.
        </Text>
      </View>

      {isLoading && state == null ? (
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
              {pro ? 'Pro' : 'Basic'}
            </Text>
            {pro && state?.isLifetime && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Lifetime access
              </Text>
            )}
            {state?.expiresAt && pro && !state.isLifetime && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Renews{' '}
                {new Date(state.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </Text>
            )}
          </Card>

          {highlightedFeature && !pro && (
            <Card style={{ borderColor: colors.primaryBorder }}>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>
                {PRO_FEATURE_LABELS[highlightedFeature]} is included with Pro.
              </Text>
            </Card>
          )}

          {!pro && (
            <>
              <Card>
                <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.md }]}>
                  Basic vs Pro
                </Text>
                <View style={styles.compareRow}>
                  <View style={styles.compareCol}>
                    <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
                      Basic
                    </Text>
                    {BASIC_FEATURES_LIST.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} />
                        <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.compareCol}>
                    <Text style={[typography.label, { color: colors.primary, marginBottom: spacing.sm }]}>
                      Pro
                    </Text>
                    {PRO_FEATURES_LIST.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Card>

              <Card>
                <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.md }]}>
                  Choose a plan
                </Text>
                {(['monthly', 'annual', 'lifetime'] as const).map((plan) => {
                  const selected = selectedPlan === plan;
                  const subtitle = planSubtitle(plan);
                  return (
                    <Pressable
                      key={plan}
                      style={[
                        styles.planOption,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primarySurface : colors.surfaceElevated,
                        },
                      ]}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      <View style={styles.planOptionLeft}>
                        <View style={styles.planTitleRow}>
                          <Text style={[typography.bodyMedium, { color: colors.text }]}>
                            {PLAN_LABELS[plan]}
                          </Text>
                          {plan === 'annual' && (
                            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                              <Text style={[typography.caption, { color: '#fff', fontFamily: typography.label.fontFamily }]}>
                                Best value
                              </Text>
                            </View>
                          )}
                        </View>
                        {subtitle && (
                          <Text style={[typography.caption, { color: colors.textMuted }]}>{subtitle}</Text>
                        )}
                      </View>
                      <Text style={[typography.label, { color: selected ? colors.primary : colors.text }]}>
                        {packagePrice(packages[plan], FALLBACK_PRICE_LABELS[plan])}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: purchasing || !isRevenueCatConfigured() ? 0.8 : 1,
                    },
                  ]}
                  onPress={handlePurchase}
                  disabled={purchasing || !isRevenueCatConfigured()}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[typography.button, { color: '#fff', textAlign: 'center' }]}>
                      {isRevenueCatConfigured()
                        ? `Continue with ${PLAN_LABELS[selectedPlan]}`
                        : 'Configure RevenueCat to enable purchases'}
                    </Text>
                  )}
                </Pressable>
                {!isRevenueCatConfigured() && hasRevenueCatApiKey() && (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
                    RevenueCat could not load plans. On Android, set EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
                    (goog_…). Use a dev build with Google Play sandbox.
                  </Text>
                )}
                {!hasRevenueCatApiKey() && (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
                    Set platform RevenueCat keys in .env and use a development build. See docs/monetization/revenuecat-setup.md.
                  </Text>
                )}
              </Card>
            </>
          )}

          {!isAnonymous && (
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                  onPress={() => setBasic()}
                >
                  <Text style={[typography.label, { color: colors.textMuted }]}>Reset to Basic (testing)</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg + 4, paddingBottom: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  subtitle: { marginTop: spacing.sm },
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  compareRow: { flexDirection: 'row', gap: spacing.md },
  compareCol: { flex: 1 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  planOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  planOptionLeft: { flex: 1, marginRight: spacing.sm },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  primaryBtn: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
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
