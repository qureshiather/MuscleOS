import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput, Modal } from 'react-native';
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
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const isDark = colors.background === '#0a0a0b';
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
  const setProfile = useSettingsStore((s) => s.setProfile);

  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [sexSelection, setSexSelection] = useState<'male' | 'female' | null>(null);

  useEffect(() => {
    const { profile: p, weightUnit: wu, heightUnit: hu } = useSettingsStore.getState();
    if (p.heightCm != null) setHeightInput(String(cmToDisplay(p.heightCm, hu)));
    else setHeightInput('');
    if (p.weightKg != null) setWeightInput(String(kgToDisplay(p.weightKg, wu)));
    else setWeightInput('');
    if (p.age != null) setAgeInput(String(p.age));
    else setAgeInput('');
  }, [profile.heightCm, profile.weightKg, profile.age, heightUnit, weightUnit]);

  function openProfileModal() {
    const { profile: p, weightUnit: wu, heightUnit: hu } = useSettingsStore.getState();
    if (p.heightCm != null) setHeightInput(String(cmToDisplay(p.heightCm, hu)));
    else setHeightInput('');
    if (p.weightKg != null) setWeightInput(String(kgToDisplay(p.weightKg, wu)));
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
    if (!Number.isNaN(w) && w > 0) next.weightKg = displayToKg(w, weightUnit);
    else delete next.weightKg;
    if (!Number.isNaN(a) && a > 0 && a < 150) next.age = a;
    else delete next.age;
    next.sex = sexSelection ?? profile.sex;
    if (next.sex == null) delete next.sex;
    setProfile(next);
    setProfileModalVisible(false);
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

  const heightDisplay = profile.heightCm != null ? `${cmToDisplay(profile.heightCm, heightUnit)} ${heightUnit === 'in' ? 'in' : 'cm'}` : '—';
  const weightDisplay = profile.weightKg != null ? `${kgToDisplay(profile.weightKg, weightUnit)} ${weightUnit}` : '—';
  const ageDisplay = profile.age != null ? String(profile.age) : '—';
  const sexDisplay = profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : '—';

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
          <View style={styles.profileSectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
            </View>
            <Pressable
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={openProfileModal}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.readOnlyRow}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>{heightUnit === 'in' ? 'Height (in)' : 'Height (cm)'}</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{heightDisplay}</Text>
          </View>
          <View style={styles.readOnlyRow}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>{weightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)'}</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{weightDisplay}</Text>
          </View>
          <View style={styles.readOnlyRow}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>Age</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{ageDisplay}</Text>
          </View>
          <View style={[styles.readOnlyRow, styles.readOnlyRowLast]}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>Gender</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{sexDisplay}</Text>
          </View>
        </View>

        <Modal
          visible={profileModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setProfileModalVisible(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit profile</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted, marginBottom: 12 }]}>Height, weight, age & gender</Text>
              <Text style={[styles.unitLabel, { color: colors.textMuted }]}>Gender</Text>
              <View style={[styles.themeRow, { marginBottom: 12 }]}>
                <Pressable
                  style={[styles.themeBtn, (sexSelection ?? profile.sex) === 'male' && { backgroundColor: colors.primary }]}
                  onPress={() => setSexSelection('male')}
                >
                  <Text style={[styles.themeBtnText, { color: (sexSelection ?? profile.sex) === 'male' ? '#fff' : colors.textSecondary }]}>Male</Text>
                </Pressable>
                <Pressable
                  style={[styles.themeBtn, (sexSelection ?? profile.sex) === 'female' && { backgroundColor: colors.primary }]}
                  onPress={() => setSexSelection('female')}
                >
                  <Text style={[styles.themeBtnText, { color: (sexSelection ?? profile.sex) === 'female' ? '#fff' : colors.textSecondary }]}>Female</Text>
                </Pressable>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder={heightPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={heightInput}
                  onChangeText={setHeightInput}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder={weightPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                />
              </View>
              <TextInput
                style={[styles.inputFull, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Age"
                placeholderTextColor={colors.textMuted}
                value={ageInput}
                onChangeText={setAgeInput}
                keyboardType="number-pad"
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]}
                  onPress={() => setProfileModalVisible(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSave, { backgroundColor: colors.primary }]}
                  onPress={saveProfileFromModal}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Units</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            Metric: cm & kg · Imperial: in & lb (used everywhere)
          </Text>
          <View style={styles.themeRow}>
            <Pressable
              style={[styles.themeBtn, unitSystem === 'metric' && { backgroundColor: colors.primary }]}
              onPress={() => setUnitSystem('metric')}
            >
              <Text style={[styles.themeBtnText, { color: unitSystem === 'metric' ? '#fff' : colors.textSecondary }]}>Metric</Text>
            </Pressable>
            <Pressable
              style={[styles.themeBtn, unitSystem === 'imperial' && { backgroundColor: colors.primary }]}
              onPress={() => setUnitSystem('imperial')}
            >
              <Text style={[styles.themeBtnText, { color: unitSystem === 'imperial' ? '#fff' : colors.textSecondary }]}>Imperial</Text>
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
  profileSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  readOnlyLabel: { fontSize: 15 },
  readOnlyValue: { fontSize: 16, fontWeight: '500' },
  readOnlyRowLast: { borderBottomWidth: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnSave: {},
  modalBtnText: { fontSize: 16, fontWeight: '600' },
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
