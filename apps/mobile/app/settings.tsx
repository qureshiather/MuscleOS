import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export default function SettingsScreen() {
  const { colors, themePreference, setTheme } = useTheme();
  const router = useRouter();
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const setHeightUnit = useSettingsStore((s) => s.setHeightUnit);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit);
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const setBodyWeightUnit = useSettingsStore((s) => s.setBodyWeightUnit);
  const workoutSoundsEnabled = useSettingsStore((s) => s.workoutSoundsEnabled);
  const setWorkoutSoundsEnabled = useSettingsStore((s) => s.setWorkoutSoundsEnabled);

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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
