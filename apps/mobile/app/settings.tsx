import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
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
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
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
            Metric: cm & kg · Imperial: in & lb (used everywhere)
          </Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[
                styles.themeBtn,
                unitSystem === 'metric'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setUnitSystem('metric')}
            >
              <Text style={[styles.themeBtnText, { color: unitSystem === 'metric' ? '#fff' : colors.text }]}>Metric</Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeBtn,
                unitSystem === 'imperial'
                  ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setUnitSystem('imperial')}
            >
              <Text style={[styles.themeBtnText, { color: unitSystem === 'imperial' ? '#fff' : colors.text }]}>Imperial</Text>
            </Pressable>
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
