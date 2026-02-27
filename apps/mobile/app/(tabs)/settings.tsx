import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { exportAndShareData } from '@/storage/exportData';
import { useSettingsStore } from '@/store/settingsStore';

export default function SettingsScreen() {
  const { colors, setTheme } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const isDark = colors.background === '#0a0a0b';
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Account, export & subscription
        </Text>
      </View>
      <View style={[styles.row, { backgroundColor: colors.surface }]}>
        <Text style={[styles.rowText, { color: colors.text }]}>Appearance</Text>
        <View style={styles.themeRow}>
          <Pressable
            style={[styles.themeBtn, isDark && { backgroundColor: colors.primary }]}
            onPress={() => setTheme(true)}
          >
            <Text style={[styles.themeBtnText, { color: isDark ? '#fff' : colors.textSecondary }]}>Dark</Text>
          </Pressable>
          <Pressable
            style={[styles.themeBtn, !isDark && { backgroundColor: colors.primary }]}
            onPress={() => setTheme(false)}
          >
            <Text style={[styles.themeBtnText, { color: !isDark ? '#fff' : colors.textSecondary }]}>Light</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.row, { backgroundColor: colors.surface }]}>
        <Text style={[styles.rowText, { color: colors.text }]}>Weight unit</Text>
        <View style={styles.themeRow}>
          <Pressable
            style={[styles.themeBtn, weightUnit === 'kg' && { backgroundColor: colors.primary }]}
            onPress={() => setWeightUnit('kg')}
          >
            <Text style={[styles.themeBtnText, { color: weightUnit === 'kg' ? '#fff' : colors.textSecondary }]}>KG</Text>
          </Pressable>
          <Pressable
            style={[styles.themeBtn, weightUnit === 'lb' && { backgroundColor: colors.primary }]}
            onPress={() => setWeightUnit('lb')}
          >
            <Text style={[styles.themeBtnText, { color: weightUnit === 'lb' ? '#fff' : colors.textSecondary }]}>Pounds</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push('/auth')}
      >
        <Text style={[styles.rowText, { color: colors.text }]}>Sign in / Account</Text>
        <Text style={[styles.rowHint, { color: colors.textMuted }]}>Google, Apple, email</Text>
      </Pressable>
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
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push('/subscription')}
      >
        <Text style={[styles.rowText, { color: colors.text }]}>Subscription</Text>
        <Text style={[styles.rowHint, { color: colors.textMuted }]}>Pro features</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
  },
  rowText: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  themeBtnText: { fontSize: 14, fontWeight: '600' },
});
