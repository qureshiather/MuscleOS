import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { kgToDisplay, displayToKg, cmToDisplay, displayToCm } from '@/utils/weightUnits';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ListRow } from '@/components/ui/ListRow';
import { useSyncStore } from '@/store/syncStore';
import { syncNow } from '@/sync';
import { formatRelative } from '@/utils/relativeTime';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const isLinked = !useAuthStore((s) => s.isAnonymous);
  const authProfile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const lastSyncError = useSyncStore((s) => s.lastError);
  const loadSyncStatus = useSyncStore((s) => s.loadStatus);
  const [, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadSyncStatus();
    }, [loadSyncStatus])
  );

  useEffect(() => {
    if (!isLinked || isSyncing) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [isLinked, isSyncing, lastSyncedAt]);

  async function handleSyncTap() {
    if (isSyncing) return;
    try {
      await syncNow();
    } catch (e) {
      Alert.alert('Sync failed', String(e));
    }
  }

  const syncStatusText = isSyncing
    ? 'Syncing…'
    : lastSyncError
      ? 'Sync failed — tap to retry'
      : lastSyncedAt
        ? `Last synced ${formatRelative(lastSyncedAt)}`
        : 'Not synced yet — tap to sync';

  const syncStatusColor = lastSyncError && !isSyncing ? colors.danger : colors.textMuted;

  async function handleSignOut() {
    Alert.alert(
      'Sign out',
      'You will stay on this device as a guest. Your subscription stays on your account and can be restored on another device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            loadSubscription();
          },
        },
      ]
    );
  }

  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [sexSelection, setSexSelection] = useState<'male' | 'female' | null>(null);

  useEffect(() => {
    const { profile: p, bodyWeightUnit: bwu, heightUnit: hu } = useSettingsStore.getState();
    if (p.heightCm != null) setHeightInput(String(cmToDisplay(p.heightCm, hu)));
    else setHeightInput('');
    if (p.weightKg != null) setWeightInput(String(kgToDisplay(p.weightKg, bwu)));
    else setWeightInput('');
    if (p.age != null) setAgeInput(String(p.age));
    else setAgeInput('');
  }, [profile.heightCm, profile.weightKg, profile.age, heightUnit, bodyWeightUnit]);

  function openProfileModal() {
    const { profile: p, bodyWeightUnit: bwu, heightUnit: hu } = useSettingsStore.getState();
    if (p.heightCm != null) setHeightInput(String(cmToDisplay(p.heightCm, hu)));
    else setHeightInput('');
    if (p.weightKg != null) setWeightInput(String(kgToDisplay(p.weightKg, bwu)));
    else setWeightInput('');
    if (p.age != null) setAgeInput(String(p.age));
    else setAgeInput('');
    setSexSelection(p.sex ?? null);
    setProfileModalVisible(true);
  }

  function saveProfileFromModal() {
    const h = parseFloat(heightInput);
    const w = parseFloat(weightInput);
    const a = parseInt(ageInput, 10);
    const next: typeof profile = { ...profile };
    if (!Number.isNaN(h) && h > 0) next.heightCm = displayToCm(h, heightUnit);
    else delete next.heightCm;
    if (!Number.isNaN(w) && w > 0) next.weightKg = displayToKg(w, bodyWeightUnit);
    else delete next.weightKg;
    if (!Number.isNaN(a) && a > 0 && a < 150) next.age = a;
    else delete next.age;
    next.sex = sexSelection ?? profile.sex;
    if (next.sex == null) delete next.sex;
    setProfile(next);
    setProfileModalVisible(false);
  }

  const heightPlaceholder = heightUnit === 'in' ? 'Height (in)' : 'Height (cm)';
  const weightPlaceholder = bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)';

  const heightDisplay =
    profile.heightCm != null
      ? `${cmToDisplay(profile.heightCm, heightUnit)} ${heightUnit === 'in' ? 'in' : 'cm'}`
      : '—';
  const weightDisplay =
    profile.weightKg != null ? `${kgToDisplay(profile.weightKg, bodyWeightUnit)} ${bodyWeightUnit}` : '—';
  const ageDisplay = profile.age != null ? String(profile.age) : '—';
  const sexDisplay = profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : '—';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[screenHeaderStyles.scrollContent, styles.scrollExtra]}>
        <View style={screenHeaderStyles.headerInScroll}>
          <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Profile</Text>
          <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
            Account, biodata & subscription
          </Text>
        </View>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Account
          </Text>
          {isLinked ? (
            <>
              <View style={styles.accountInfo}>
                {authProfile?.displayName ? (
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>
                    {authProfile.displayName}
                  </Text>
                ) : null}
                <Text style={[typography.body, { color: colors.textSecondary }]} numberOfLines={1}>
                  {authProfile?.email ?? 'Account linked'}
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Subscription restores on other devices with this account.
              </Text>
              <Pressable
                onPress={() => void handleSyncTap()}
                disabled={isSyncing}
                style={({ pressed }) => [
                  styles.syncRow,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    opacity: pressed && !isSyncing ? 0.85 : 1,
                  },
                ]}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.syncIcon} />
                ) : (
                  <Ionicons
                    name={lastSyncError ? 'cloud-offline-outline' : 'cloud-done-outline'}
                    size={18}
                    color={lastSyncError ? colors.danger : colors.primary}
                    style={styles.syncIcon}
                  />
                )}
                <Text style={[typography.caption, { color: syncStatusColor, flex: 1 }]}>
                  {syncStatusText}
                </Text>
                {!isSyncing ? (
                  <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
                ) : null}
              </Pressable>
              <PrimaryButton label="Sign out" variant="outline" onPress={handleSignOut} />
            </>
          ) : (
            <>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                Sign in to subscribe and restore purchases on other devices.
              </Text>
              <PrimaryButton label="Sign in" onPress={() => router.push('/auth')} />
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.profileSectionHeader}>
            <View style={styles.profileSectionHeaderText}>
              <Text style={[typography.sectionTitle, { color: colors.text }]}>Biodata</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Used for recovery estimates
              </Text>
            </View>
            <Pressable
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={openProfileModal}
            >
              <Text style={[typography.label, { color: '#fff' }]}>Edit</Text>
            </Pressable>
          </View>
          {(
            [
              [heightUnit === 'in' ? 'Height (in)' : 'Height (cm)', heightDisplay],
              [bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)', weightDisplay],
              ['Age', ageDisplay],
              ['Gender', sexDisplay],
            ] as const
          ).map(([label, value], i, arr) => (
            <View
              key={label}
              style={[
                styles.readOnlyRow,
                i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[typography.data, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
        </Card>

        <Modal
          visible={profileModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setProfileModalVisible(false)}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[typography.screenTitle, { fontSize: 22, color: colors.text }]}>Edit biodata</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                Height, weight, age & gender
              </Text>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                Gender
              </Text>
              <View style={[styles.themeRow, { marginBottom: spacing.md }]}>
                {(['male', 'female'] as const).map((sex) => {
                  const selected = (sexSelection ?? profile.sex) === sex;
                  return (
                    <Pressable
                      key={sex}
                      style={[
                        styles.themeBtn,
                        selected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      ]}
                      onPress={() => setSexSelection(sex)}
                    >
                      <Text
                        style={[
                          typography.label,
                          { color: selected ? '#fff' : colors.text, textTransform: 'capitalize' },
                        ]}
                      >
                        {sex}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder={heightPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={heightInput}
                  onChangeText={setHeightInput}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder={weightPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                />
              </View>
              <TextInput
                style={[
                  styles.inputFull,
                  { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Age"
                placeholderTextColor={colors.textMuted}
                value={ageInput}
                onChangeText={setAgeInput}
                keyboardType="number-pad"
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                  onPress={() => setProfileModalVisible(false)}
                >
                  <Text style={[typography.button, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: colors.primary, borderWidth: 0 }]}
                  onPress={saveProfileFromModal}
                >
                  <Text style={[typography.button, { color: '#fff' }]}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <ListRow
          title="Subscription"
          hint="Pro features"
          onPress={() => router.push('/subscription')}
        />
        <ListRow
          title="Settings"
          hint="Appearance, units, data"
          onPress={() => router.push('/settings')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollExtra: { paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  accountInfo: { marginBottom: spacing.sm },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  syncIcon: { width: 20 },
  profileSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  profileSectionHeaderText: { flex: 1, minWidth: 0 },
  editBtn: {
    flexShrink: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg + 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  inputRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  inputFull: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 76,
    alignItems: 'center',
    borderWidth: 1.5,
  },
});
