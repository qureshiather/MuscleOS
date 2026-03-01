import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useExercisesStore } from '@/store/exercisesStore';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { Exercise, MuscleId, Equipment } from '@muscleos/types';

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
  const { colors } = useTheme();
  const router = useRouter();
  const addExercise = useExercisesStore((s) => s.addExercise);
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState<MuscleId[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [instructions, setInstructions] = useState('');

  function toggleMuscle(id: MuscleId) {
    setMuscles((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function toggleEquip(eq: Equipment) {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>New exercise</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. My Cable Row"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Muscles (tap to select)</Text>
        <View style={styles.chipsRow}>
          {MUSCLE_IDS.map((id) => (
            <Pressable
              key={id}
              style={[
                styles.chip,
                {
                  backgroundColor: muscles.includes(id) ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => toggleMuscle(id)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: muscles.includes(id) ? '#fff' : colors.textSecondary },
                ]}
              >
                {MUSCLE_GROUPS[id].name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Equipment (tap to select)</Text>
        <View style={styles.chipsRow}>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <Pressable
              key={eq}
              style={[
                styles.chip,
                {
                  backgroundColor: equipment.includes(eq) ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => toggleEquip(eq)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: equipment.includes(eq) ? '#fff' : colors.textSecondary },
                ]}
              >
                {EQUIPMENT_LABELS[eq]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Instructions (optional)</Text>
        <TextInput
          style={[
            styles.input,
            styles.inputMulti,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="How to perform the exercise..."
          placeholderTextColor={colors.textMuted}
          value={instructions}
          onChangeText={setInstructions}
          multiline
        />

        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>Save exercise</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  backText: { fontSize: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22 },
  chipText: { fontSize: 14, fontWeight: '500' },
  saveBtn: { padding: 16, borderRadius: 12, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
