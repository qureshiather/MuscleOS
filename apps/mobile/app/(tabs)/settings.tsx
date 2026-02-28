import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { exportAndShareData } from '@/storage/exportData';
import { useSettingsStore } from '@/store/settingsStore';
import { kgToDisplay, displayToKg, cmToDisplay, displayToCm } from '@/utils/weightUnits';

export default function SettingsScreen() {
  const { colors, setTheme } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const isDark = colors.background === '#0a0a0b';
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit);
  const setHeightUnit = useSettingsStore((s) => s.setHeightUnit);
  const setProfile = useSettingsStore((s) => s.setProfile);

  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');

  useEffect(() => {
    if (profile.heightCm != null) setHeightInput(String(cmToDisplay(profile.heightCm, heightUnit)));
    else setHeightInput('');
    if (profile.weightKg != null) setWeightInput(String(kgToDisplay(profile.weightKg, weightUnit)));
    else setWeightInput('');
    if (profile.age != null) setAgeInput(String(profile.age));
    else setAgeInput('');
  }, [profile.heightCm, profile.weightKg, profile.age, heightUnit, weightUnit]);

  function saveHeight() {
    const v = parseFloat(heightInput);
    if (!Number.isNaN(v) && v > 0) {
      setProfile({ ...profile, heightCm: displayToCm(v, heightUnit) });
    } else if (heightInput.trim() === '') {
      const { heightCm, ...rest } = profile;
      setProfile(rest);
    }
  }
  function saveWeight() {
    const v = parseFloat(weightInput);
    if (!Number.isNaN(v) && v > 0) {
      setProfile({ ...profile, weightKg: displayToKg(v, weightUnit) });
    } else if (weightInput.trim() === '') {
      const { weightKg, ...rest } = profile;
      setProfile(rest);
    }
  }
  function saveAge() {
    const v = parseInt(ageInput, 10);
    if (!Number.isNaN(v) && v > 0 && v < 150) {
      setProfile({ ...profile, age: v });
    } else if (ageInput.trim() === '') {
      const { age, ...rest } = profile;
      setProfile(rest);
    }
  }

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

  const heightPlaceholder = heightUnit === 'in' ? 'Height (in)' : 'Height (cm)';
  const weightPlaceholder = weightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Profile, units, account & subscription
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Height, weight & age (used across the app)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={heightPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={heightInput}
              onChangeText={setHeightInput}
              onBlur={saveHeight}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={weightPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={weightInput}
              onChangeText={setWeightInput}
              onBlur={saveWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <TextInput
            style={[styles.inputFull, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Age"
            placeholderTextColor={colors.textMuted}
            value={ageInput}
            onChangeText={setAgeInput}
            onBlur={saveAge}
            keyboardType="number-pad"
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Units</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Used for height & weight everywhere</Text>
          <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Height</Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[styles.themeBtn, heightUnit === 'cm' && { backgroundColor: colors.primary }]}
              onPress={() => setHeightUnit('cm')}
            >
              <Text style={[styles.themeBtnText, { color: heightUnit === 'cm' ? '#fff' : colors.textSecondary }]}>CM</Text>
            </Pressable>
            <Pressable
              style={[styles.themeBtn, heightUnit === 'in' && { backgroundColor: colors.primary }]}
              onPress={() => setHeightUnit('in')}
            >
              <Text style={[styles.themeBtnText, { color: heightUnit === 'in' ? '#fff' : colors.textSecondary }]}>Inches</Text>
            </Pressable>
          </View>
          <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Weight</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  section: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionHint: { fontSize: 13, marginBottom: 12 },
  unitLabel: { fontSize: 14, marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  inputFull: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
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
