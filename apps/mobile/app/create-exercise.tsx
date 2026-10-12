import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useExercisesStore } from '@/store/exercisesStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  formatMuscleLabels,
  muscleLabel,
} from '@muscleos/types';
import type { ExerciseCategory, MuscleId, Equipment } from '@muscleos/types';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  buildCustomExerciseDraft,
  equipmentForCategory,
  equipmentOptions,
  missingFieldsHint,
  resolveExerciseEditTarget,
} from '@/utils/customExerciseForm';
import {
  MUSCLE_AREAS,
  areaSelection,
  prefersSpecificMuscles,
  toggleArea,
  toggleMuscle,
} from '@/utils/muscleAreas';

type MuscleView = 'areas' | 'specific';

const MUSCLE_VIEW_OPTIONS: { value: MuscleView; label: string }[] = [
  { value: 'areas', label: 'Body areas' },
  { value: 'specific', label: 'Specific muscles' },
];

/** Field heading with optional right-aligned meta (`Optional`, `3 selected`). */
function FieldLabel({ title, meta }: { title: string; meta?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.labelRow}>
      <Text style={[typography.label, { color: colors.textSecondary }]}>{title}</Text>
      {meta ? <Text style={[typography.caption, { color: colors.textMuted }]}>{meta}</Text> : null}
    </View>
  );
}

/** Selectable chip; `partial` marks a body area with only some of its muscles picked. */
function Chip({
  label,
  state,
  onPress,
}: {
  label: string;
  state: 'on' | 'partial' | 'off';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const backgroundColor =
    state === 'on' ? colors.primary : state === 'partial' ? colors.primarySurface : colors.surface;
  const borderColor = state === 'off' ? colors.border : colors.primary;
  const textColor =
    state === 'on' ? colors.primaryOn : state === 'partial' ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      style={[styles.chip, { backgroundColor, borderColor }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: state === 'on' }}
    >
      <Text style={[typography.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export default function CreateExerciseScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    origin?: string;
    workoutMode?: string;
    workoutExIdx?: string;
  }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const addExercise = useExercisesStore((s) => s.addExercise);
  const updateExercise = useExercisesStore((s) => s.updateExercise);
  const getExercise = useExercisesStore((s) => s.getExercise);

  // Only customs are editable; a catalog id opens an empty create form rather than a clone.
  const existing = resolveExerciseEditTarget(editId, editId ? getExercise(editId) : undefined);
  const isEdit = existing !== undefined;

  const [name, setName] = useState(
    existing?.name ?? (typeof params.name === 'string' ? params.name : '')
  );
  const [category, setCategory] = useState<ExerciseCategory | null>(existing?.category ?? null);
  const [muscles, setMuscles] = useState<MuscleId[]>(existing?.muscles ?? []);
  const [equipment, setEquipment] = useState<Equipment[]>(existing?.equipment ?? []);
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [muscleView, setMuscleView] = useState<MuscleView>(
    prefersSpecificMuscles(existing?.muscles ?? []) ? 'specific' : 'areas'
  );

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setCategory(existing.category);
    setMuscles(existing.muscles);
    setEquipment(existing.equipment);
    setInstructions(existing.instructions ?? '');
    if (prefersSpecificMuscles(existing.muscles)) setMuscleView('specific');
  }, [existing?.id]);

  function selectCategory(next: ExerciseCategory) {
    setCategory(next);
    setEquipment((prev) => equipmentForCategory(next, prev));
  }

  function toggleEquip(eq: Equipment) {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));
  }

  const draft = buildCustomExerciseDraft({ name, category, muscles, equipment, instructions });

  async function handleSave() {
    if (!draft.ok) return;
    const payload = draft.exercise;
    if (existing) {
      await updateExercise(existing.id, payload);
    } else {
      const created = await addExercise(payload);
      // Launched from the mid-workout picker: drop the new exercise into the live session so the
      // user lands back on their workout with it already added (or swapped in for replace).
      if (params.origin === 'active-workout') {
        const workout = useActiveWorkoutStore.getState();
        const exIdx = Number(params.workoutExIdx);
        if (params.workoutMode === 'replace' && Number.isInteger(exIdx)) {
          workout.replaceExercise(exIdx, created.id);
        } else {
          workout.addExercise(created.id);
        }
      }
    }
    router.back();
  }

  const canSave = draft.ok;
  const saveHint = draft.ok ? null : missingFieldsHint(draft.errors);
  const equipmentChoices = equipmentOptions(category, equipment);

  return (
    <Screen>
      <ScreenHeader
        title={isEdit ? 'Edit exercise' : 'New exercise'}
        onBack={() => router.back()}
        backIcon="close"
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <FieldLabel title="Name" />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="e.g. Cable row"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <FieldLabel title="Type" />
        <View style={styles.chipsRow}>
          {EXERCISE_CATEGORIES.map((key) => (
            <Chip
              key={key}
              label={EXERCISE_CATEGORY_LABELS[key]}
              state={category === key ? 'on' : 'off'}
              onPress={() => selectCategory(key)}
            />
          ))}
        </View>

        {equipmentChoices.length > 0 && (
          <>
            <FieldLabel title="Equipment" meta="Optional" />
            <View style={styles.chipsRow}>
              {equipmentChoices.map((eq) => (
                <Chip
                  key={eq}
                  label={EQUIPMENT_LABELS[eq]}
                  state={equipment.includes(eq) ? 'on' : 'off'}
                  onPress={() => toggleEquip(eq)}
                />
              ))}
            </View>
          </>
        )}

        <FieldLabel
          title="Muscles"
          meta={muscles.length > 0 ? `${muscles.length} selected` : undefined}
        />
        <View style={styles.segment}>
          <SegmentedControl
            options={MUSCLE_VIEW_OPTIONS}
            value={muscleView}
            onChange={setMuscleView}
          />
        </View>
        {muscleView === 'areas' ? (
          <>
            <View style={styles.chipsRow}>
              {MUSCLE_AREAS.map((area) => {
                const state = areaSelection(muscles, area);
                const picked = area.muscles.filter((m) => muscles.includes(m)).length;
                return (
                  <Chip
                    key={area.key}
                    label={state === 'some' ? `${area.label} ${picked}/${area.muscles.length}` : area.label}
                    state={state === 'all' ? 'on' : state === 'some' ? 'partial' : 'off'}
                    onPress={() => setMuscles((prev) => toggleArea(prev, area))}
                  />
                );
              })}
            </View>
            {muscles.length > 0 && (
              <Text style={[typography.caption, styles.selectedLine, { color: colors.textMuted }]}>
                {formatMuscleLabels(muscles, ' · ')}
              </Text>
            )}
          </>
        ) : (
          MUSCLE_AREAS.map((area) => (
            <View key={area.key}>
              <Text style={[typography.caption, styles.areaHeading, { color: colors.textMuted }]}>
                {area.label}
              </Text>
              <View style={styles.chipsRow}>
                {area.muscles.map((id) => (
                  <Chip
                    key={id}
                    label={muscleLabel(id)}
                    state={muscles.includes(id) ? 'on' : 'off'}
                    onPress={() => setMuscles((prev) => toggleMuscle(prev, id))}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {muscles.length > 0 && (
          <Card style={styles.diagramCard}>
            <MuscleDiagram muscleIds={muscles} size={0.7} />
          </Card>
        )}

        <FieldLabel title="Instructions" meta="Optional" />
        <TextInput
          style={[
            styles.input,
            styles.inputMulti,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="One step per line: setup, cues, tempo…"
          placeholderTextColor={colors.textMuted}
          value={instructions}
          onChangeText={setInstructions}
          multiline
        />

        <PrimaryButton
          label={isEdit ? 'Save changes' : 'Save exercise'}
          onPress={handleSave}
          disabled={!canSave}
          style={{ marginTop: spacing.sm, opacity: canSave ? 1 : 0.5 }}
        />
        {saveHint && (
          <Text style={[typography.caption, styles.saveHint, { color: colors.textMuted }]}>
            {saveHint}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg + 4, paddingBottom: 40 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  segment: { marginBottom: spacing.md },
  areaHeading: { marginBottom: spacing.xs },
  selectedLine: { marginTop: -spacing.xs, marginBottom: spacing.md },
  saveHint: { textAlign: 'center', marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.md,
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  diagramCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },
});
