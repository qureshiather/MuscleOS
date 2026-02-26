import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { exportAndShareData } from '@/storage/exportData';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

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
});
