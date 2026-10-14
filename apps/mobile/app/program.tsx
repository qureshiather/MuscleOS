import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { WorkoutTemplate } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { Screen, ScreenFooter } from '@/components/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { builtInProgram, programTemplates } from '@/data/builtInTemplates';
import { useSettingsStore } from '@/store/settingsStore';
import { encodeStartParams } from '@/store/activeWorkoutLogic';
import { resolveTemplateExercises } from '@/utils/templateExercises';
import { programAction, programActionHint, programOverview } from '@/utils/programs';
import { useExercisesStore } from '@/store/exercisesStore';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { formatMuscleLabels } from '@muscleos/types';
import { fontFamily, typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

/** One program: what it is, its workouts, and the button that adds, replaces or removes it. */
export default function ProgramScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const activeProgramId = useSettingsStore((s) => s.activeProgramId);
  const setActiveProgram = useSettingsStore((s) => s.setActiveProgram);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const program = builtInProgram(id);

  if (!program) {
    return (
      <Screen kind="chrome">
        <ScreenHeader title="Program" onBack={() => router.back()} />
        <Text style={[typography.body, styles.missing, { color: colors.textMuted }]}>
          Program not found
        </Text>
      </Screen>
    );
  }

  const templates = programTemplates(program.id);
  const overview = programOverview(program.id, getExercise);
  const action = programAction(program.id, activeProgramId);
  const setsRange = setRange(templates);

  function openPreview(template: WorkoutTemplate) {
    router.push({
      pathname: '/workout-preview',
      params: { templateId: template.id, ...encodeStartParams(resolveTemplateExercises(template)) },
    });
  }

  async function handleAction() {
    await setActiveProgram(action.kind === 'remove' ? null : program!.id);
    router.dismissTo('/(tabs)');
  }

  return (
    <Screen kind="chrome">
      <ScreenHeader title={program.name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{program.summary}</Text>

        <View style={styles.facts}>
          <Fact value={program.daysPerWeek} label="days/wk" />
          <Fact value={String(templates.length)} label="workouts" />
          <Fact value={setsRange} label="sets each" />
        </View>

        <Text style={[typography.caption, styles.label, { color: colors.textMuted }]}>Workouts</Text>
        {overview.days.map(({ template: t, exercises }) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${t.name}`}
            testID={`program-day-${t.id}`}
            onPress={() => openPreview(t)}
            style={({ pressed }) => [
              styles.day,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.dayHeader}>
              <View style={styles.rowMain}>
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{t.name}</Text>
                {t.description ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t.description}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <View style={[styles.exercises, { borderTopColor: colors.border }]}>
              {exercises.map((e) => (
                <View key={e.exerciseId} style={styles.exerciseRow}>
                  <Text style={[typography.caption, styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                    {e.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{e.sets}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
        {overview.muscleIds.length > 0 && (
          <View style={[styles.muscles, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.caption, styles.label, styles.musclesLabel, { color: colors.textMuted }]}>
              Muscles trained
            </Text>
            <MuscleDiagram muscleIds={overview.muscleIds} size={0.5} />
            <Text style={[typography.caption, styles.muscleNames, { color: colors.textSecondary }]}>
              {formatMuscleLabels(overview.muscleIds)}
            </Text>
          </View>
        )}
      </ScrollView>
      <ScreenFooter>
        <PrimaryButton
          label={action.label}
          variant={action.kind === 'remove' ? 'outline' : 'filled'}
          onPress={handleAction}
        />
        <Text style={[typography.caption, styles.hint, { color: colors.textMuted }]}>
          {programActionHint(action)}
        </Text>
      </ScreenFooter>
    </Screen>
  );

}

function Fact({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.factValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.factLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/** `3–4` across a program's exercises, or `5` when they all match. */
function setRange(templates: readonly WorkoutTemplate[]): string {
  const sets = templates.flatMap((t) => resolveTemplateExercises(t).map((e) => e.sets));
  if (sets.length === 0) return '—';
  const min = Math.min(...sets);
  const max = Math.max(...sets);
  return min === max ? String(min) : `${min}–${max}`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  missing: { padding: spacing.lg },
  facts: { flexDirection: 'row', gap: spacing.sm },
  fact: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  factValue: { fontFamily: fontFamily.sansBold, fontSize: 20 },
  factLabel: { fontFamily: fontFamily.sansMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  label: { fontFamily: fontFamily.sansMedium, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: -spacing.sm },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  muscles: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  musclesLabel: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  muscleNames: { marginTop: spacing.sm, textAlign: 'center' },
  day: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exercises: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 6 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { flex: 1, minWidth: 0 },
  hint: { textAlign: 'center', marginTop: spacing.sm },
});
