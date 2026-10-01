import { useState } from 'react';
import { Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { exportAndShareData } from '@/storage/exportData';
import { applyImport, pickImportFile } from '@/storage/importData';
import { describeImportPlan, importPlanIsEmpty, type ImportPlan } from '@/storage/importPlan';
import { clearAllData } from '@/storage/localStorage';
import { useSettingsStore } from '@/store/settingsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ListRow } from '@/components/ui/ListRow';
import { syncNow } from '@/sync';
import { useAuthStore } from '@/store/authStore';

export default function DataScreen() {
  const { colors, setTheme } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const isLinked = !useAuthStore((s) => s.isAnonymous);
  const loadTemplates = useTemplatesStore((s) => s.load);
  const loadRecovery = useRecoveryStore((s) => s.load);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadSessions = useSessionsStore((s) => s.load);
  const loadExercises = useExercisesStore((s) => s.load);

  async function handleExport() {
    setExporting(true);
    try {
      const ok = await exportAndShareData();
      if (!ok) Alert.alert('Export', 'Sharing is not available on this device.');
    } catch (e) {
      if (__DEV__) console.warn('[export] failed', e);
      Alert.alert('Export failed', "Couldn't export your data. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const picked = await pickImportFile();
      if (picked.status === 'cancelled') return;
      if (picked.status === 'failed') {
        Alert.alert(
          "Can't import this file",
          picked.reason === 'unsupported_version'
            ? 'This export is from a different version of MuscleOS. Update the app and try again.'
            : 'Choose a file made with Export my data in MuscleOS.'
        );
        return;
      }
      if (importPlanIsEmpty(picked.plan)) {
        Alert.alert('Nothing to import', 'Everything in this file is already on this device.');
        return;
      }
      confirmImport(picked.plan);
    } catch (e) {
      if (__DEV__) console.warn('[import] failed', e);
      Alert.alert('Import failed', "Couldn't read that file. Try again.");
    } finally {
      setImporting(false);
    }
  }

  function confirmImport(plan: ImportPlan) {
    const summary = describeImportPlan(plan);
    Alert.alert(
      'Import data',
      `Add ${summary} to this device? Nothing already here is changed or removed.${isLinked ? ' It also backs up to your account.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setImporting(true);
            try {
              await applyImport(plan);
              Alert.alert('Imported', `Added ${summary}.`);
            } catch (e) {
              if (__DEV__) console.warn('[import] apply failed', e);
              Alert.alert('Import failed', "Couldn't import your data. Try again.");
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  }

  async function handleForceSync() {
    setSyncing(true);
    try {
      await syncNow();
      await Promise.all([
        loadTemplates(),
        loadRecovery(),
        loadSettings(),
        loadSessions(),
        loadExercises(),
      ]);
      Alert.alert('Synced', 'Your workout data is up to date.');
    } catch (e) {
      if (__DEV__) console.warn('[sync] failed', e);
      Alert.alert('Sync failed', "Couldn't sync right now. Check your internet connection and try again.");
    } finally {
      setSyncing(false);
    }
  }

  function handleClearAllData() {
    Alert.alert(
      'Clear all data',
      'Resets settings, workouts, sessions, recovery, and health info. You stay signed in. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearAllData();
              await setTheme('auto');
              await Promise.all([loadTemplates(), loadRecovery(), loadSubscription(), loadSettings()]);
              Alert.alert('Done', 'All data has been cleared.');
            } catch (e) {
              if (__DEV__) console.warn('[data] clear failed', e);
              Alert.alert('Could not clear data', 'Something went wrong. Try again.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Data" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
          <Text style={[typography.caption, styles.hint, { color: colors.textMuted }]}>
            This device. Clearing data does not delete a linked account.
          </Text>
          {isLinked ? (
            <ListRow
              inset
              title={syncing ? 'Syncing…' : 'Sync now'}
              hint="Upload & download workout data"
              showChevron={false}
              disabled={syncing}
              onPress={() => {
                if (!syncing) void handleForceSync();
              }}
            />
          ) : null}
          <ListRow
            inset
            title={exporting ? 'Exporting…' : 'Export my data'}
            hint="Share JSON file"
            showChevron={false}
            disabled={exporting}
            onPress={() => {
              if (!exporting) void handleExport();
            }}
          />
          <ListRow
            inset
            title={importing ? 'Importing…' : 'Import data'}
            hint="Add workouts from an export file"
            showChevron={false}
            disabled={importing}
            testID="import-data"
            onPress={() => {
              if (!importing) void handleImport();
            }}
          />
          <ListRow
            inset
            last
            destructive
            title={clearing ? 'Clearing…' : 'Clear all data'}
            hint="Reset settings, workouts & more. You stay signed in."
            showChevron={false}
            disabled={clearing}
            onPress={handleClearAllData}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  hint: { marginBottom: spacing.md },
});
