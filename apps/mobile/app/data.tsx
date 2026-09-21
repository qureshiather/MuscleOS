import { useState } from 'react';
import { Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { exportAndShareData } from '@/storage/exportData';
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
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
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
      Alert.alert('Sync failed', String(e));
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
              Alert.alert('Error', String(e));
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
