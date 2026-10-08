import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import { kgToDisplay } from '@/utils/weightUnits';
import { buildProfileFromInputs, formatBodyWeight, formatSex } from '@/utils/biodata';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { fontScaleCap } from '@/theme/layout';

export default function BiodataScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const [editorVisible, setEditorVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [sexSelection, setSexSelection] = useState<'male' | 'female' | null>(null);

  function openEditor() {
    const { profile: p, bodyWeightUnit: bwu } = useSettingsStore.getState();
    setWeightInput(p.weightKg != null ? String(kgToDisplay(p.weightKg, bwu)) : '');
    setAgeInput(p.age != null ? String(p.age) : '');
    setSexSelection(p.sex ?? null);
    setEditorVisible(true);
  }

  function saveBiodata() {
    const next = buildProfileFromInputs(
      { weight: weightInput, age: ageInput, sex: sexSelection },
      { bodyWeightUnit },
      profile
    );
    void setProfile(next);
    setEditorVisible(false);
  }

  const weightDisplay = profile.weightKg != null ? formatBodyWeight(profile.weightKg, bodyWeightUnit) : '—';
  const ageDisplay = profile.age != null ? String(profile.age) : '—';
  const sexDisplay = formatSex(profile.sex) ?? '—';
  const weightLabel = bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)';

  return (
    <Screen>
      <ScreenHeader
        title="Biodata"
        subtitle="Used for strength standards"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[typography.sectionTitle, { color: colors.text }]}>Body</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Weight, age & gender
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
              [weightLabel, weightDisplay],
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
            <Text style={[typography.screenTitle, { fontSize: 22, color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>Edit biodata</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Weight, age & gender
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
            {/* Labels sit above the fields: a placeholder alone disappears once a value is in. */}
            <Text style={[typography.label, styles.fieldLabel, { color: colors.textMuted }]}>
              {weightLabel}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              accessibilityLabel={weightLabel}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
            />
            <Text style={[typography.label, styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textMuted }]}>
              Age
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              accessibilityLabel="Age"
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
  fieldLabel: { marginBottom: spacing.xs },
  fieldLabelSpaced: { marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
});
