import { useEffect, useState } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '@/components/layout';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import {
  getOfferingPackages,
  hasRevenueCatApiKey,
  isRevenueCatConfigured,
  openManageSubscriptions,
  type OfferingPackages,
} from '@/utils/revenueCat';
import {
  BASIC_FEATURES_LIST,
  PRO_FEATURES_LIST,
  PRO_FEATURE_LABELS,
  parseProFeatureParam,
} from '@/subscription/features';
import { LEGAL_URLS } from '@/subscription/legal';
import {
  DEFAULT_PLAN,
  PLAN_LABELS,
  PURCHASABLE_PLANS,
  annualSavingsFromPrices,
  currentPlanLines,
  planPriceLabel,
  planSubtitle,
  purchaseButtonState,
  type PlanKey,
} from '@/subscription/paywall';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fontScaleCap } from '@/theme/layout';

/** Dev builds only — release builds (TestFlight, Play testing tracks, production) never show it. */
const showGrantProTesting = __DEV__;

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { feature: featureParam } = useLocalSearchParams<{ feature?: string }>();
  const highlightedFeature = parseProFeatureParam(featureParam);

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const userId = useAuthStore((s) => s.user?.id);
  const load = useSubscriptionStore((s) => s.load);
  const setPro = useSubscriptionStore((s) => s.setPro);
  const setBasic = useSubscriptionStore((s) => s.setBasic);
  const purchasePackage = useSubscriptionStore((s) => s.purchasePackage);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const state = useSubscriptionStore((s) => s.state);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(DEFAULT_PLAN);
  const [packages, setPackages] = useState<OfferingPackages>({ monthly: null, annual: null });
  const hasApiKey = hasRevenueCatApiKey();
  /** RevenueCat configure + offerings in flight. Reactive, so the button updates when it settles. */
  const [offersLoading, setOffersLoading] = useState(hasApiKey);

  useEffect(() => {
    void load(userId);
  }, [load, userId]);

  useEffect(() => {
    if (!hasApiKey) return;
    let cancelled = false;
    getOfferingPackages()
      .then((next) => {
        if (!cancelled) setPackages(next);
      })
      .finally(() => {
        if (!cancelled) setOffersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasApiKey]);

  const planLines = currentPlanLines(state, new Date());
  const pro = planLines.tierLabel === 'Pro';

  const selectedPackage = packages[selectedPlan];

  const annualSavings = annualSavingsFromPrices(
    packages.monthly?.product.price,
    packages.annual?.product.price
  );

  const purchaseButton = purchaseButtonState({
    isAnonymous,
    hasApiKey,
    offersLoading,
    purchasing,
    selectedPlan,
  });

  async function handlePurchase() {
    if (!selectedPackage) {
      Alert.alert(
        'Unavailable',
        __DEV__
          ? 'This plan is not configured yet. Check RevenueCat setup.'
          : 'This plan is not available right now. Try again later.'
      );
      return;
    }
    setPurchasing(true);
    const result = await purchasePackage(selectedPackage);
    setPurchasing(false);
    if (result.success || result.cancelled) return;
    Alert.alert('Purchase failed', result.error ?? 'Could not complete purchase.');
  }

  async function handleRestore() {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (!result.success) {
      Alert.alert('Restore failed', result.error ?? 'Could not restore purchases. Try again.');
      return;
    }
    if (result.restored) {
      Alert.alert('Purchases restored', 'Pro is active on this device.');
      return;
    }
    Alert.alert('No purchases found', 'Nothing to restore for this account.');
  }

  async function handleManageSubscription() {
    setManaging(true);
    try {
      await openManageSubscriptions();
    } catch {
      Alert.alert('Could not open subscriptions', 'Open your App Store or Google Play account to manage billing.');
    } finally {
      setManaging(false);
    }
  }

  function openLegal(page: keyof typeof LEGAL_URLS) {
    void WebBrowser.openBrowserAsync(LEGAL_URLS[page]);
  }

  async function handleGrantProTesting() {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await setPro(expiresAt.toISOString(), { devOverride: true, plan: 'annual' });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[typography.screenTitle, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>Subscription</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
          Customize your training and track progress with Pro.
        </Text>
      </View>

      {isLoading && state == null ? (
        <View style={styles.scroll}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Current plan
            </Text>
            <Text style={[typography.dataLarge, { color: pro ? colors.primary : colors.text }]}>
              {pro ? 'Pro' : 'Basic'}
            </Text>
            {planLines.planLabel && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {planLines.planLabel}
              </Text>
            )}
            {planLines.expiry && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {planLines.expiry.kind === 'lifetime'
                  ? 'Lifetime'
                  : `${planLines.expiry.kind === 'until' ? 'Until' : 'Renews'} ${new Date(
                      planLines.expiry.at
                    ).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
              </Text>
            )}
            {planLines.showManage && (
              <Pressable
                style={[
                  styles.manageBtn,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
                onPress={() => void handleManageSubscription()}
                disabled={managing}
              >
                {managing ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={[typography.label, { color: colors.primary }]}>Manage subscription</Text>
                )}
              </Pressable>
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
                {PURCHASABLE_PLANS.map((plan) => {
                  const selected = selectedPlan === plan;
                  const subtitle = planSubtitle(plan, annualSavings);
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
                        {planPriceLabel(plan, packages[plan]?.product.priceString)}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: purchaseButton.disabled ? 0.8 : 1,
                    },
                  ]}
                  onPress={
                    purchaseButton.kind === 'link-account' ? () => router.push('/auth') : handlePurchase
                  }
                  disabled={purchaseButton.disabled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: purchaseButton.disabled }}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[typography.button, { color: '#fff', textAlign: 'center' }]}>
                      {purchaseButton.label}
                    </Text>
                  )}
                </Pressable>
                {isAnonymous && (
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
                    ]}
                  >
                    Subscriptions are tied to your account so Pro restores on any device.
                  </Text>
                )}
                {__DEV__ && !offersLoading && !isRevenueCatConfigured() && hasApiKey && (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
                    RevenueCat could not load plans. On Android, set EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
                    (goog_…). Use a dev build with Google Play sandbox.
                  </Text>
                )}
                {__DEV__ && !hasApiKey && (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
                    Set platform RevenueCat keys in .env and use a development build. See docs/monetization/revenuecat-setup.md.
                  </Text>
                )}
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
                  ]}
                >
                  Auto-renews unless cancelled at least 24 hours before the period ends. Charged to
                  your Apple or Google account at confirmation.
                </Text>
                <View style={styles.legalRow}>
                  <Pressable onPress={() => openLegal('privacy')} hitSlop={8}>
                    <Text style={[typography.caption, { color: colors.primary }]}>Privacy Policy</Text>
                  </Pressable>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>·</Text>
                  <Pressable onPress={() => openLegal('terms')} hitSlop={8}>
                    <Text style={[typography.caption, { color: colors.primary }]}>Terms of Use</Text>
                  </Pressable>
                </View>
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
  manageBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  legalRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  devSection: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1 },
  devBtn: {
    padding: spacing.md,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
});
