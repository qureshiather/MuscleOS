import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { exportAndShareData } from '@/storage/exportData';
import { clearAllData } from '@/storage/localStorage';
import { useSettingsStore } from '@/store/settingsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export default function SettingsScreen() {
  const { colors, themePreference, setTheme } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
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

  function handleClearAllData() {
    Alert.alert(
      'Clear all data',
      'This will reset your settings, clear all workouts, sessions, recovery data, and health info. You will stay signed in. This cannot be undone.',
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            Auto: follow device · Dark or Light: fixed
          </Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[
                styles.themeBtn,
                themePreference === 'auto'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setTheme('auto')}
            >
              <Text style={[styles.themeBtnText, { color: themePreference === 'auto' ? '#fff' : colors.text }]}>Auto</Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeBtn,
                themePreference === 'dark'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setTheme('dark')}
            >
              <Text style={[styles.themeBtnText, { color: themePreference === 'dark' ? '#fff' : colors.text }]}>Dark</Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeBtn,
                themePreference === 'light'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setTheme('light')}
            >
              <Text style={[styles.themeBtnText, { color: themePreference === 'light' ? '#fff' : colors.text }]}>Light</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Units</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            Height, profile body weight, and exercise loads can use different units.
          </Text>

          <Text style={[styles.unitRowLabel, { color: colors.textSecondary }]}>Height</Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[
                styles.themeBtn,
                heightUnit === 'cm'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setHeightUnit('cm')}
            >
              <Text style={[styles.themeBtnText, { color: heightUnit === 'cm' ? '#fff' : colors.text }]}>cm</Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeBtn,
                heightUnit === 'in'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setHeightUnit('in')}
            >
              <Text style={[styles.themeBtnText, { color: heightUnit === 'in' ? '#fff' : colors.text }]}>in</Text>
            </Pressable>
          </View>

          <Text style={[styles.unitRowLabel, { color: colors.textSecondary, marginTop: 14 }]}>Body weight</Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[
                styles.themeBtn,
                bodyWeightUnit === 'kg'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setBodyWeightUnit('kg')}
            >
              <Text style={[styles.themeBtnText, { color: bodyWeightUnit === 'kg' ? '#fff' : colors.text }]}>kg</Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeBtn,
                bodyWeightUnit === 'lb'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setBodyWeightUnit('lb')}
            >
              <Text style={[styles.themeBtnText, { color: bodyWeightUnit === 'lb' ? '#fff' : colors.text }]}>lb</Text>
            </Pressable>
          </View>

          <Text style={[styles.unitRowLabel, { color: colors.textSecondary, marginTop: 14 }]}>Exercise weight</Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[
                styles.themeBtn,
                weightUnit === 'kg'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setWeightUnit('kg')}
            >
              <Text style={[styles.themeBtnText, { color: weightUnit === 'kg' ? '#fff' : colors.text }]}>kg</Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeBtn,
                weightUnit === 'lb'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setWeightUnit('lb')}
            >
              <Text style={[styles.themeBtnText, { color: weightUnit === 'lb' ? '#fff' : colors.text }]}>lb</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sounds</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            Beeps and tones while you have an active workout open.
          </Text>
          <View style={styles.soundRow}>
            <Text style={[styles.rowText, { color: colors.text, flex: 1, paddingRight: 12 }]}>
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
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleExport}
          disabled={exporting}
        >
          <Text style={[styles.rowText, { color: colors.text }]}>
            {exporting ? 'Exporting…' : 'Export my data'}
          </Text>
          <Text style={[styles.rowHint, { color: colors.textMuted }]}>Share JSON file</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.row,
            styles.rowDanger,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleClearAllData}
          disabled={clearing}
        >
          <Text style={[styles.rowText, { color: colors.danger }]}>
            {clearing ? 'Clearing…' : 'Clear all data'}
          </Text>
          <Text style={[styles.rowHint, { color: colors.textMuted }]}>Reset settings, workouts & more</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 40 },
  section: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionHint: { fontSize: 13, marginBottom: 12 },
  unitRowLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  rowText: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13 },
  rowDanger: { marginTop: 8 },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 76,
    alignItems: 'center' as const,
  },
  themeBtnText: { fontSize: 14, fontWeight: '600' },
});
