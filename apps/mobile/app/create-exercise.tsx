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
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  MUSCLE_GROUPS,
} from '@muscleos/types';
import type { ExerciseCategory, MuscleId, Equipment } from '@muscleos/types';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { useRequirePro } from '@/hooks/useProGate';

const EQUIPMENT_OPTIONS: Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
  'ez_bar',
  'other',
];

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  band: 'Band',
  ez_bar: 'EZ Bar',
  other: 'Other',
};

const MUSCLE_IDS = Object.keys(MUSCLE_GROUPS) as MuscleId[];

export default function CreateExerciseScreen() {
  const isPro = useRequirePro('custom_exercises');
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const addExercise = useExercisesStore((s) => s.addExercise);
  const updateExercise = useExercisesStore((s) => s.updateExercise);
  const getExercise = useExercisesStore((s) => s.getExercise);

  const existing = editId ? getExercise(editId) : undefined;
  const isEdit = Boolean(existing && existing.id.startsWith('custom_'));

  const [name, setName] = useState(
    existing?.name ?? (typeof params.name === 'string' ? params.name : '')
  );
  const [category, setCategory] = useState<ExerciseCategory | null>(existing?.category ?? null);
  const [muscles, setMuscles] = useState<MuscleId[]>(existing?.muscles ?? []);
  const [equipment, setEquipment] = useState<Equipment[]>(existing?.equipment ?? []);
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setCategory(existing.category);
    setMuscles(existing.muscles);
    setEquipment(existing.equipment);
    setInstructions(existing.instructions ?? '');
  }, [existing?.id]);

  function toggleMuscle(id: MuscleId) {
    setMuscles((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function toggleEquip(eq: Equipment) {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName || muscles.length === 0 || !category) return;
    const payload = {
      name: trimmedName,
      category,
      muscles,
      equipment,
      instructions: instructions.trim() || undefined,
    };
    if (isEdit && editId) {
      await updateExercise(editId, payload);
    } else {
      await addExercise(payload);
    }
    router.back();
  }

  const canSave = name.trim().length > 0 && muscles.length > 0 && category !== null;

  if (!isPro) return null;

  return (
    <Screen>
      <ScreenHeader
        title={isEdit ? 'Edit exercise' : 'New exercise'}
        onBack={() => router.back()}
        backIcon="close"
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="e.g. Cable row"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>Type</Text>
        <View style={styles.chipsRow}>
          {EXERCISE_CATEGORIES.map((key) => {
            const selected = category === key;
            return (
              <Pressable
                key={key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setCategory(key)}
              >
                <Text style={[typography.label, { color: selected ? '#fff' : colors.textSecondary }]}>
                  {EXERCISE_CATEGORY_LABELS[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>
          Muscles · {muscles.length}
        </Text>
        <View style={styles.chipsRow}>
          {MUSCLE_IDS.map((id) => {
            const selected = muscles.includes(id);
            return (
              <Pressable
                key={id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleMuscle(id)}
              >
                <Text style={[typography.label, { color: selected ? '#fff' : colors.textSecondary }]}>
                  {MUSCLE_GROUPS[id].name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {muscles.length > 0 && (
          <Card style={styles.diagramCard}>
            <MuscleDiagram muscleIds={muscles} size={0.7} />
          </Card>
        )}

        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>
          Equipment · optional
        </Text>
        <View style={styles.chipsRow}>
          {EQUIPMENT_OPTIONS.map((eq) => {
            const selected = equipment.includes(eq);
            return (
              <Pressable
                key={eq}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleEquip(eq)}
              >
                <Text style={[typography.label, { color: selected ? '#fff' : colors.textSecondary }]}>
                  {EQUIPMENT_LABELS[eq]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>
          Instructions (optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.inputMulti,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Cues, setup, tempo…"
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg + 4, paddingBottom: 40 },
  label: { marginBottom: spacing.sm, marginTop: spacing.sm },
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
