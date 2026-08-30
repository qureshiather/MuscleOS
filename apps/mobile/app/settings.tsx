import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Switch } from 'react-native';
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
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ListRow } from '@/components/ui/ListRow';
import { syncNow } from '@/sync';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const { colors, themePreference, setTheme } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const setHeightUnit = useSettingsStore((s) => s.setHeightUnit);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit);
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const setBodyWeightUnit = useSettingsStore((s) => s.setBodyWeightUnit);
  const workoutSoundsEnabled = useSettingsStore((s) => s.workoutSoundsEnabled);
  const setWorkoutSoundsEnabled = useSettingsStore((s) => s.setWorkoutSoundsEnabled);
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
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <Text style={[typography.caption, styles.hint, { color: colors.textMuted }]}>
            Auto follows your device. Dark and Light stay fixed.
          </Text>
          <SegmentedControl
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            value={themePreference}
            onChange={setTheme}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Units</Text>
          <Text style={[typography.caption, styles.hint, { color: colors.textMuted }]}>
            Height, body weight, and exercise loads can differ.
          </Text>

          <Text style={[typography.label, styles.unitLabel, { color: colors.textSecondary }]}>Height</Text>
          <SegmentedControl
            options={[
              { value: 'cm', label: 'cm' },
              { value: 'in', label: 'in' },
            ]}
            value={heightUnit}
            onChange={setHeightUnit}
          />

          <Text style={[typography.label, styles.unitLabelSpaced, { color: colors.textSecondary }]}>
            Body weight
          </Text>
          <SegmentedControl
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            value={bodyWeightUnit}
            onChange={setBodyWeightUnit}
          />

          <Text style={[typography.label, styles.unitLabelSpaced, { color: colors.textSecondary }]}>
            Exercise weight
          </Text>
          <SegmentedControl
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            value={weightUnit}
            onChange={setWeightUnit}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Sounds</Text>
          <Text style={[typography.caption, styles.hint, { color: colors.textMuted }]}>
            Beeps and tones during an active workout.
          </Text>
          <View style={styles.soundRow}>
            <Text style={[typography.bodyMedium, { color: colors.text, flex: 1, paddingRight: spacing.md }]}>
              Workout sounds
            </Text>
            <Switch
              value={workoutSoundsEnabled}
              onValueChange={(v) => void setWorkoutSoundsEnabled(v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
            />
          </View>
        </Card>

        {!isAnonymous ? (
          <ListRow
            title={syncing ? 'Syncing…' : 'Sync now'}
            hint="Upload & download workout data"
            onPress={() => {
              if (!syncing) void handleForceSync();
            }}
          />
        ) : null}

        <ListRow
          title={exporting ? 'Exporting…' : 'Export my data'}
          hint="Share JSON file"
          onPress={() => {
            if (!exporting) void handleExport();
          }}
        />

        <Pressable
          style={({ pressed }) => [
            styles.dangerRow,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleClearAllData}
          disabled={clearing}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.danger }]}>
              {clearing ? 'Clearing…' : 'Clear all data'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Reset settings, workouts & more
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  hint: { marginTop: spacing.xs, marginBottom: spacing.md },
  unitLabel: { marginBottom: spacing.sm },
  unitLabelSpaced: { marginTop: spacing.md, marginBottom: spacing.sm },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});
