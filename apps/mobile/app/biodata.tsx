import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Switch, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import { kgToDisplay, displayToKg, cmToDisplay, displayToCm } from '@/utils/weightUnits';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function BiodataScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const setNotNatty = useSettingsStore((s) => s.setNotNatty);
  const [editorVisible, setEditorVisible] = useState(false);
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [sexSelection, setSexSelection] = useState<'male' | 'female' | null>(null);

  function openEditor() {
    const { profile: p, bodyWeightUnit: bwu, heightUnit: hu } = useSettingsStore.getState();
    setHeightInput(p.heightCm != null ? String(cmToDisplay(p.heightCm, hu)) : '');
    setWeightInput(p.weightKg != null ? String(kgToDisplay(p.weightKg, bwu)) : '');
    setAgeInput(p.age != null ? String(p.age) : '');
    setSexSelection(p.sex ?? null);
    setEditorVisible(true);
  }

  function saveBiodata() {
    const h = parseFloat(heightInput);
    const w = parseFloat(weightInput);
    const a = parseInt(ageInput, 10);
    const next: typeof profile = { ...profile };
    if (!Number.isNaN(h) && h > 0) next.heightCm = displayToCm(h, heightUnit);
    else delete next.heightCm;
    if (!Number.isNaN(w) && w > 0) next.weightKg = displayToKg(w, bodyWeightUnit);
    else delete next.weightKg;
    if (!Number.isNaN(a) && a > 0 && a < 150) next.age = a;
    else delete next.age;
    next.sex = sexSelection ?? profile.sex;
    if (next.sex == null) delete next.sex;
    void setProfile(next);
    setEditorVisible(false);
  }

  const heightDisplay =
    profile.heightCm != null
      ? `${cmToDisplay(profile.heightCm, heightUnit)} ${heightUnit === 'in' ? 'in' : 'cm'}`
      : '—';
  const weightDisplay =
    profile.weightKg != null ? `${kgToDisplay(profile.weightKg, bodyWeightUnit)} ${bodyWeightUnit}` : '—';
  const ageDisplay = profile.age != null ? String(profile.age) : '—';
  const sexDisplay = profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : '—';
  const heightPlaceholder = heightUnit === 'in' ? 'Height (in)' : 'Height (cm)';
  const weightPlaceholder = bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)';

  return (
    <Screen>
      <ScreenHeader
        title="Biodata"
        subtitle="Used for recovery estimates"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[typography.sectionTitle, { color: colors.text }]}>Body</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Height, weight, age & gender
              </Text>
            </View>
            <Pressable
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={openEditor}
            >
              <Text style={[typography.label, { color: colors.primaryOn }]}>Edit</Text>
            </Pressable>
          </View>
          {(
            [
              [heightUnit === 'in' ? 'Height (in)' : 'Height (cm)', heightDisplay],
              [bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)', weightDisplay],
              ['Age', ageDisplay],
              ['Gender', sexDisplay],
            ] as const
          ).map(([label, value]) => (
            <View
              key={label}
              style={[
                styles.readOnlyRow,
                { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[typography.data, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
          <View style={styles.notNattyRow}>
            <View style={styles.notNattyCopy}>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>Not natty</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Halves recovery time. These anabolic substances be crazy.
              </Text>
            </View>
            <Switch
              value={!!profile.notNatty}
              onValueChange={(v) => void setNotNatty(v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.primaryOn}
              ios_backgroundColor={colors.border}
            />
          </View>
        </Card>
      </ScrollView>

      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setEditorVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[typography.screenTitle, { fontSize: 22, color: colors.text }]}>Edit biodata</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Height, weight, age & gender
            </Text>
            <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Gender
            </Text>
            <View style={[styles.choiceRow, { marginBottom: spacing.md }]}>
              {(['male', 'female'] as const).map((sex) => {
                const selected = (sexSelection ?? profile.sex) === sex;
                return (
                  <Pressable
                    key={sex}
                    style={[
                      styles.choiceBtn,
                      selected
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                    onPress={() => setSexSelection(sex)}
                  >
                    <Text
                      style={[
                        typography.label,
                        { color: selected ? colors.primaryOn : colors.text, textTransform: 'capitalize' },
                      ]}
                    >
                      {sex}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                ]}
                placeholder={heightPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                ]}
                placeholder={weightPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
              />
            </View>
            <TextInput
              style={[
                styles.inputFull,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Age"
              placeholderTextColor={colors.textMuted}
              value={ageInput}
              onChangeText={setAgeInput}
              keyboardType="number-pad"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setEditorVisible(false)}
              >
                <Text style={[typography.button, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary, borderWidth: 0 }]}
                onPress={saveBiodata}
              >
                <Text style={[typography.button, { color: colors.primaryOn }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  editBtn: {
    flexShrink: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  notNattyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.md,
    minHeight: 44,
  },
  notNattyCopy: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg + 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choiceBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 76,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  inputRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  inputFull: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
});
