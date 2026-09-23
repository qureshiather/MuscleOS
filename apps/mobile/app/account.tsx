import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ListRow } from '@/components/ui/ListRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSyncStore } from '@/store/syncStore';
import { syncNow } from '@/sync';
import { formatRelative } from '@/utils/relativeTime';
import { LEGAL_URLS } from '@/subscription/legal';
import { authProviderLabel, linkedAuthProvider } from '@/auth/accountProvider';

export default function AccountScreen() {
  const { colors, setTheme } = useTheme();
  const router = useRouter();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePhase, setDeletePhase] = useState<null | 'warn' | 'confirm' | 'done' | 'failed'>(null);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const provider = isLinked && authUser ? linkedAuthProvider(authUser) : null;
  const providerIcon =
    provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'mail-outline';

  return (
    <Screen>
      <ScreenHeader title="Account" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
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
        </Card>

        <Card style={styles.section}>
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
        </Card>
      </ScrollView>

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
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  accountInfo: { marginBottom: spacing.sm },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
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
});
