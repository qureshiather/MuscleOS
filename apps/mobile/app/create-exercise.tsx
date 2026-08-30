import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useExercisesStore } from '@/store/exercisesStore';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { MuscleId, Equipment } from '@muscleos/types';
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
  const addExercise = useExercisesStore((s) => s.addExercise);
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState<MuscleId[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [instructions, setInstructions] = useState('');

  function toggleMuscle(id: MuscleId) {
    setMuscles((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function toggleEquip(eq: Equipment) {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName || muscles.length === 0 || equipment.length === 0) return;
    await addExercise({
      name: trimmedName,
      muscles,
      equipment,
      instructions: instructions.trim() || undefined,
    });
    router.back();
  }

  const canSave = name.trim().length > 0 && muscles.length > 0 && equipment.length > 0;

  if (!isPro) return null;

  return (
    <Screen>
      <ScreenHeader title="New exercise" onBack={() => router.back()} backIcon="close" />
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
          Equipment · {equipment.length}
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
          label="Save exercise"
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
