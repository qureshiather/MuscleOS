import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExercisesStore } from '@/store/exercisesStore';
import type { WorkoutTemplate, WorkoutDay } from '@muscleos/types';
import { Ionicons } from '@expo/vector-icons';

export default function CreateTemplateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const allExercises = useExercisesStore((s) => s.getAllExercises)();

  const [name, setName] = useState('');
  const [dayName, setDayName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const pickerExercises = useMemo(() => {
    let list = allExercises;
    if (pickerSearch.trim()) {
      const q = pickerSearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscles.some((m) => m.toLowerCase().includes(q)) ||
          e.equipment.some((eq) => eq.toLowerCase().includes(q))
      );
    }
    return list.filter((e) => !selectedIds.includes(e.id));
  }, [allExercises, pickerSearch, selectedIds]);

  function addExerciseId(id: string) {
    if (!selectedIds.includes(id)) setSelectedIds((prev) => [...prev, id]);
  }

  function removeExerciseId(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  function handleSave() {
    if (!name.trim() || !dayName.trim() || selectedIds.length === 0) return;
    const day: WorkoutDay = {
      id: 'day_' + Date.now(),
      name: dayName.trim(),
      exerciseIds: selectedIds,
    };
    const template: WorkoutTemplate = {
      id: 'tpl_' + Date.now(),
      name: name.trim(),
      days: [day],
      isBuiltIn: false,
    };
    addTemplate(template);
    router.back();
  }

  const canSave = name.trim().length > 0 && dayName.trim().length > 0 && selectedIds.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Create template</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.form}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Template name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. My Push Day"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Day name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. Push"
          placeholderTextColor={colors.textMuted}
          value={dayName}
          onChangeText={setDayName}
        />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Exercises</Text>
        <View style={styles.selectedRow}>
          {selectedIds.length === 0 ? (
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              No exercises added
            </Text>
          ) : (
            selectedIds.map((id) => {
              const ex = getExercise(id);
              return (
                <View
                  key={id}
                  style={[styles.selectedChip, { backgroundColor: colors.surfaceElevated }]}
                >
                  <Text style={[styles.selectedChipText, { color: colors.text }]} numberOfLines={1}>
                    {ex?.name ?? id}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => removeExerciseId(id)}
                    style={styles.removeChip}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
        <Pressable
          style={[styles.addExercisesBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={[styles.addExercisesBtnText, { color: colors.primary }]}>Add exercises</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>Save template</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showPicker} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View
            style={[styles.pickerContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Add exercise</Text>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={[styles.pickerDone, { color: colors.primary }]}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.pickerSearch,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={pickerSearch}
              onChangeText={setPickerSearch}
            />
            <FlatList
              data={pickerExercises}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                  onPress={() => addExerciseId(item.id)}
                >
                  <Text style={[styles.pickerRowText, { color: colors.text }]}>{item.name}</Text>
                  <Ionicons name="add" size={20} color={colors.accent} />
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  backText: { fontSize: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  scroll: { flex: 1 },
  form: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  placeholderText: { fontSize: 14, marginBottom: 8 },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingVertical: 8,
    paddingRight: 4,
    borderRadius: 20,
    maxWidth: '100%',
  },
  selectedChipText: { fontSize: 14, maxWidth: 140 },
  removeChip: { marginLeft: 4 },
  addExercisesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  addExercisesBtnText: { fontSize: 16, fontWeight: '500' },
  saveBtn: { padding: 16, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerTitle: { fontSize: 18, fontWeight: '600' },
  pickerDone: { fontSize: 16 },
  pickerSearch: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  pickerList: { maxHeight: 400 },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  pickerRowText: { fontSize: 16 },
});
