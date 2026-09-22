import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput, Modal, ActivityIndicator, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { kgToDisplay, displayToKg, cmToDisplay, displayToCm } from '@/utils/weightUnits';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ListRow } from '@/components/ui/ListRow';
import { useSyncStore } from '@/store/syncStore';
import { syncNow } from '@/sync';
import { formatRelative } from '@/utils/relativeTime';
import { LEGAL_URLS } from '@/subscription/legal';
import { authProviderLabel, linkedAuthProvider } from '@/auth/accountProvider';

export default function ProfileScreen() {
  const { colors, setTheme } = useTheme();
  const router = useRouter();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePhase, setDeletePhase] = useState<null | 'warn' | 'confirm' | 'done' | 'failed'>(null);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const setNotNatty = useSettingsStore((s) => s.setNotNatty);
  const isLinked = !useAuthStore((s) => s.isAnonymous);
  const authUser = useAuthStore((s) => s.user);
  const authProfile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadTemplates = useTemplatesStore((s) => s.load);
  const loadRecovery = useRecoveryStore((s) => s.load);
  const loadSessions = useSessionsStore((s) => s.load);
  const loadExercises = useExercisesStore((s) => s.load);
  const isPro = useSubscriptionStore((s) => s.isPro());
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

  async function confirmSignOut() {
    setSignOutVisible(false);
    await signOut();
    loadSubscription();
  }

  function handleDeleteAccount() {
    setDeleteError(null);
    setDeletePhase('warn');
  }

  async function confirmDeleteAccount() {
    setDeletePhase(null);
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await setTheme('auto');
      await Promise.all([
        loadTemplates(),
        loadRecovery(),
        loadSubscription(),
        loadSettings(),
        loadSessions(),
        loadExercises(),
      ]);
      setDeletePhase('done');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
      setDeletePhase('failed');
    } finally {
      setDeletingAccount(false);
    }
  }

  function openLegal(page: keyof typeof LEGAL_URLS) {
    void WebBrowser.openBrowserAsync(LEGAL_URLS[page]);
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
  const provider = isLinked && authUser ? linkedAuthProvider(authUser) : null;
  const providerIcon =
    provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'mail-outline';

  return (
    <Screen kind="tab">
      <ScrollView contentContainerStyle={[screenHeaderStyles.scrollContent, styles.scrollExtra]}>
        <View style={screenHeaderStyles.headerInScroll}>
          <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Profile</Text>
          <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
            Settings, recovery data & account
          </Text>
        </View>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Settings
          </Text>
          <ListRow
            inset
            last
            title="Appearance, units, sounds"
            hint="How the app looks and measures"
            onPress={() => router.push('/settings')}
          />
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
              <Text style={[typography.label, { color: colors.primaryOn }]}>Edit</Text>
            </Pressable>
          </View>
          {(
            [
              [heightUnit === 'in' ? 'Height (in)' : 'Height (cm)', heightDisplay],
              [bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)', weightDisplay],
              ['Age', ageDisplay],
              ['Gender', sexDisplay],
            ] as const
          ).map(([label, value]) => (
            <View
              key={label}
              style={[
                styles.readOnlyRow,
                { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[typography.data, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
          <View style={styles.notNattyRow}>
            <View style={styles.notNattyCopy}>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>Not natty</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Halves recovery time. These anabolic substances be crazy.
              </Text>
            </View>
            <Switch
              value={!!profile.notNatty}
              onValueChange={(v) => void setNotNatty(v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.primaryOn}
              ios_backgroundColor={colors.border}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Account
          </Text>
          {isLinked ? (
            <>
              <View style={styles.accountInfo}>
                {provider ? (
                  <View style={styles.providerRow}>
                    <Ionicons name={providerIcon} size={16} color={colors.textSecondary} />
                    <Text style={[typography.label, { color: colors.textSecondary }]}>
                      {authProviderLabel(provider)}
                    </Text>
                  </View>
                ) : null}
                {authProfile?.displayName ? (
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>
                    {authProfile.displayName}
                  </Text>
                ) : null}
                <Text style={[typography.body, { color: colors.textSecondary }]} numberOfLines={1}>
                  {authProfile?.email ?? 'Account linked'}
                </Text>
              </View>
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
              <PrimaryButton
                label="Sign out"
                variant="outline"
                onPress={() => setSignOutVisible(true)}
                disabled={deletingAccount}
              />
            </>
          ) : (
            <>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                Sign in to back up your data and restore Pro on any device.
              </Text>
              <PrimaryButton label="Sign in" onPress={() => router.push('/auth')} />
            </>
          )}
          <View style={styles.accountLinks}>
            <ListRow
              inset
              title="Subscription"
              hint={isPro ? 'Pro' : 'Basic · upgrade for custom training'}
              onPress={() => router.push('/subscription')}
            />
            <ListRow
              inset
              title="Data"
              hint={isLinked ? 'Sync, export, clear this device' : 'Export or clear this device'}
              onPress={() => router.push('/data')}
            />
            {isLinked ? (
              deletingAccount ? (
                <View style={styles.deletingRow}>
                  <ActivityIndicator size="small" color={colors.danger} />
                  <Text style={[typography.bodyMedium, { color: colors.danger }]}>Deleting…</Text>
                </View>
              ) : (
                <ListRow
                  inset
                  destructive
                  title="Delete account"
                  hint="Deletes this email's account and cloud backup"
                  showChevron={false}
                  testID="delete-account"
                  onPress={handleDeleteAccount}
                />
              )
            ) : null}
            <ListRow
              inset
              title="Privacy Policy"
              hint="How we handle your data"
              onPress={() => openLegal('privacy')}
            />
            <ListRow
              inset
              last
              title="Terms of Service"
              hint="Using MuscleOS"
              onPress={() => openLegal('terms')}
            />
          </View>
        </Card>
      </ScrollView>

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
      <ConfirmDialog
        visible={deletePhase === 'warn' || deletePhase === 'confirm'}
        title={deletePhase === 'confirm' ? 'Delete account?' : 'Delete account'}
        message={
          deletePhase === 'confirm'
            ? 'This cannot be undone.'
            : 'This deletes your MuscleOS account and cloud backup for this email. Apple, Google, and password sign-in with the same address are the same account — all of it goes. This device is wiped and you continue as a guest. An active Pro subscription is billed by Apple or Google until you cancel it in store settings. Deleting the app or this account does not cancel it.'
        }
        cancelLabel="Cancel"
        confirmLabel={deletePhase === 'confirm' ? 'Delete' : 'Continue'}
        confirmTestID={deletePhase === 'confirm' ? 'delete-account-confirm' : 'delete-account-continue'}
        cancelTestID="delete-account-cancel"
        destructive={deletePhase === 'confirm'}
        onCancel={() => setDeletePhase(null)}
        onConfirm={() => {
          if (deletePhase === 'confirm') {
            void confirmDeleteAccount();
            return;
          }
          setDeletePhase('confirm');
        }}
      />
      <ConfirmDialog
        visible={signOutVisible}
        title="Sign out"
        message="You will stay on this device as a guest. Your subscription stays on your account and can be restored on another device."
        cancelLabel="Cancel"
        confirmLabel="Sign out"
        destructive
        onCancel={() => setSignOutVisible(false)}
        onConfirm={() => {
          void confirmSignOut();
        }}
      />
      <ConfirmDialog
        visible={deletePhase === 'done'}
        title="Account deleted"
        message="Your account and cloud backup are gone. You are signed in as a guest on this device."
        confirmLabel="OK"
        onConfirm={() => setDeletePhase(null)}
      />
      <ConfirmDialog
        visible={deletePhase === 'failed'}
        title="Could not delete account"
        message={deleteError ?? 'Something went wrong.'}
        confirmLabel="OK"
        onConfirm={() => {
          setDeletePhase(null);
          setDeleteError(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollExtra: { paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  accountInfo: { marginBottom: spacing.sm },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  accountLinks: { marginTop: spacing.md },
  deletingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
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
  notNattyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.md,
    minHeight: 44,
  },
  notNattyCopy: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
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
