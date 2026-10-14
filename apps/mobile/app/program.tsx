import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { WorkoutTemplate } from '@muscleos/types';
import { muscleLabel } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { Screen, ScreenFooter } from '@/components/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { builtInProgram } from '@/data/builtInTemplates';
import { useSettingsStore } from '@/store/settingsStore';
import { encodeStartParams } from '@/store/activeWorkoutLogic';
import { resolveTemplateExercises } from '@/utils/templateExercises';
import {
  programAction,
  programActionHint,
  programDayMeta,
  programOverview,
  type ProgramDay,
} from '@/utils/programs';
import { useExercisesStore } from '@/store/exercisesStore';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { fontScaleCap } from '@/theme/layout';
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

  const overview = programOverview(program.id, getExercise);
  const action = programAction(program.id, activeProgramId);
  const facts: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { icon: 'calendar-outline', label: `${program.daysPerWeek} days/wk` },
    { icon: 'barbell-outline', label: `${overview.days.length} workouts` },
    { icon: 'layers-outline', label: `${overview.totalSets} sets/cycle` },
  ];

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
      <Pressable
        onPress={() => router.back()}
        style={styles.backRow}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
        <Text style={[typography.label, { color: colors.primary }]}>Back</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>Program</Text>
            <View style={[styles.levelTag, { borderColor: colors.border }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>{program.level}</Text>
            </View>
            {action.kind === 'remove' ? (
              <View style={styles.activeTag}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.tagText, { color: colors.success }]}>In your workouts</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[typography.screenTitle, { color: colors.text }]}
            maxFontSizeMultiplier={fontScaleCap.title}
          >
            {program.name}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{program.summary}</Text>
        </View>

        <View style={styles.facts}>
          {facts.map((f) => (
            <View key={f.icon} style={[styles.fact, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name={f.icon} size={13} color={colors.textSecondary} />
              <Text
                style={[styles.mono, { color: colors.textSecondary }]}
                maxFontSizeMultiplier={fontScaleCap.chrome}
              >
                {f.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Workouts</Text>
        {overview.days.map((day, i) => (
          <DayCard key={day.template.id} day={day} index={i} onPress={() => openPreview(day.template)} />
        ))}
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

/** A workout: day number, name, size, its own muscle diagram, then one row per exercise. */
function DayCard({ day, index, onPress }: { day: ProgramDay; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const t = day.template;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Preview ${t.name}`}
      testID={`program-day-${t.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.day,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.dayHeader}>
        <View style={styles.dayTitle}>
          <Text style={[styles.dayTag, { color: colors.primary }]}>{`DAY ${index + 1}`}</Text>
          <Text style={[styles.dayName, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>
            {t.name}
          </Text>
          <Text style={[styles.mono, { color: colors.textSecondary }]}>{programDayMeta(day)}</Text>
        </View>
        {day.muscleIds.length > 0 ? (
          <View style={styles.diagram} importantForAccessibility="no-hide-descendants">
            <MuscleDiagram muscleIds={day.muscleIds} size={0.28} />
          </View>
        ) : null}
      </View>
      {t.description ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t.description}</Text>
      ) : null}
      <View style={[styles.exercises, { borderTopColor: colors.border }]}>
        {day.exercises.map((e) => (
          <View key={e.exerciseId} style={styles.exerciseRow}>
            <Text style={[typography.label, styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
              {e.name}
            </Text>
            {e.muscle ? (
              <View style={[styles.musclePill, { backgroundColor: colors.primarySurface }]}>
                <Text style={[styles.musclePillText, { color: colors.primary }]} numberOfLines={1}>
                  {muscleLabel(e.muscle)}
                </Text>
              </View>
            ) : null}
            <Text
              style={[styles.mono, styles.sets, { color: colors.textMuted }]}
              maxFontSizeMultiplier={fontScaleCap.tabular}
            >
              {`${e.sets}×`}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  missing: { padding: spacing.lg },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  content: { padding: spacing.lg + 4, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.sm, marginBottom: spacing.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  eyebrow: { fontFamily: fontFamily.monoMedium, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  levelTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontFamily: fontFamily.sansSemiBold, fontSize: 11 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  mono: { fontFamily: fontFamily.mono, fontSize: 13 },
  sectionLabel: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: spacing.md,
    paddingHorizontal: 2,
  },
  day: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayTitle: { flex: 1, minWidth: 0, gap: 2 },
  dayTag: { fontFamily: fontFamily.monoMedium, fontSize: 11, letterSpacing: 1.2 },
  dayName: { fontFamily: fontFamily.sansBold, fontSize: 20, lineHeight: 26 },
  diagram: { width: 128 },
  exercises: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.sm + 2 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { flex: 1, minWidth: 0 },
  musclePill: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2, maxWidth: 120 },
  musclePillText: { fontFamily: fontFamily.sansSemiBold, fontSize: 11 },
  sets: { width: 28, textAlign: 'right' },
  hint: { textAlign: 'center', marginTop: spacing.sm },
});
