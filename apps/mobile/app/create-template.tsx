import { useState, useMemo, useEffect } from 'react';
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
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExercisesStore } from '@/store/exercisesStore';
import type { WorkoutTemplate } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { MUSCLE_GROUPS } from '@muscleos/types';
import { Ionicons } from '@expo/vector-icons';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function CreateTemplateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { templateId: editTemplateId } = useLocalSearchParams<{ templateId?: string }>();
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const loadTemplates = useTemplatesStore((s) => s.load);
  const userTemplates = useTemplatesStore((s) => s.userTemplates);
  const folders = useTemplatesStore((s) => s.folders);

  const isEditMode = Boolean(editTemplateId?.trim());
  const existingTemplate = useMemo(
    () => (isEditMode ? userTemplates.find((t) => t.id === editTemplateId) : null),
    [isEditMode, editTemplateId, userTemplates]
  );

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name);
      setSelectedIds([...existingTemplate.exerciseIds]);
      setFolderId(existingTemplate.folderId);
    }
  }, [existingTemplate?.id]);

  const getExercise = useExercisesStore((s) => s.getExercise);
  const allExercises = useExercisesStore((s) => s.getAllExercises)();

  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [showErrors, setShowErrors] = useState(false);

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
    setPickerSearch('');
  }

  function removeExerciseId(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  function handleSave() {
    const missingName = !name.trim();
    const missingExercises = selectedIds.length === 0;
    if (missingName || missingExercises) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (isEditMode && existingTemplate) {
      updateTemplate(existingTemplate.id, {
        name: name.trim(),
        exerciseIds: selectedIds,
        ...(folderId !== undefined && { folderId }),
      });
    } else {
      const template: WorkoutTemplate = {
        id: 'tpl_' + Date.now(),
        name: name.trim(),
        exerciseIds: selectedIds,
        isBuiltIn: false,
        ...(folderId && { folderId }),
      };
      addTemplate(template);
    }
    router.back();
  }

  const templateMuscleIds: MuscleId[] = useMemo(
    () => Array.from(new Set(selectedIds.flatMap((id) => getExercise(id)?.muscles ?? []))),
    [selectedIds, getExercise]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title={isEditMode ? 'Edit template' : 'New template'}
        onBack={() => router.back()}
        backIcon="close"
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>Template name</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: showErrors && !name.trim() ? colors.danger : colors.border,
            },
          ]}
          placeholder="e.g. Push A"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (showErrors) setShowErrors(false);
          }}
        />
        {showErrors && !name.trim() ? (
          <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
            Name is required
          </Text>
        ) : null}

        {folders.length > 0 && (
          <>
            <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>Folder</Text>
            <View style={styles.folderRow}>
              <Pressable
                style={[
                  styles.folderChip,
                  {
                    borderColor: colors.border,
                    backgroundColor: !folderId ? colors.primary : colors.surface,
                  },
                ]}
                onPress={() => setFolderId(undefined)}
              >
                <Text
                  style={[typography.label, { color: !folderId ? '#fff' : colors.textSecondary }]}
                >
                  None
                </Text>
              </Pressable>
              {folders.map((f) => (
                <Pressable
                  key={f.id}
                  style={[
                    styles.folderChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: folderId === f.id ? colors.primary : colors.surface,
                    },
                  ]}
                  onPress={() => setFolderId(f.id)}
                >
                  <Text
                    style={[typography.label, { color: folderId === f.id ? '#fff' : colors.text }]}
                  >
                    {f.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>
          Exercises · {selectedIds.length}
        </Text>
        <Card
          elevated
          style={[
            styles.selectedCard,
            showErrors && selectedIds.length === 0 ? { borderColor: colors.danger } : null,
          ]}
        >
          {selectedIds.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>No exercises yet</Text>
          ) : (
            selectedIds.map((id, index) => {
              const ex = getExercise(id);
              return (
                <View
                  key={id}
                  style={[
                    styles.selectedRow,
                    index < selectedIds.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.data, styles.index, { color: colors.textMuted }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {ex?.name ?? id}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeExerciseId(id)}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>
        {showErrors && selectedIds.length === 0 ? (
          <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
            Add at least one exercise
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.addExercisesBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={[typography.button, { color: colors.primary }]}>Add exercises</Text>
        </Pressable>

        {templateMuscleIds.length > 0 && (
          <Card style={styles.musclesSection}>
            <Text style={[typography.caption, styles.sectionLabel, { color: colors.textMuted }]}>
              Muscles used
            </Text>
            <MuscleDiagram muscleIds={templateMuscleIds} size={0.85} />
            <Text style={[typography.caption, styles.muscleNames, { color: colors.textSecondary }]}>
              {templateMuscleIds.map((id) => MUSCLE_GROUPS[id].name).join(', ')}
            </Text>
          </Card>
        )}

        <PrimaryButton
          label={isEditMode ? 'Save changes' : 'Save template'}
          onPress={handleSave}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>

      <Modal visible={showPicker} animationType="slide" transparent>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowPicker(false)}>
          <View
            style={[styles.pickerContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[typography.sectionTitle, { color: colors.text }]}>Add exercise</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                <Text style={[typography.label, { color: colors.primary }]}>Done</Text>
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
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                  onPress={() => addExerciseId(item.id)}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {item.muscles.map((m) => MUSCLE_GROUPS[m].name).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={colors.primary} />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[typography.body, { color: colors.textMuted, padding: spacing.lg, textAlign: 'center' }]}>
                  No matching exercises
                </Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  form: { padding: spacing.lg + 4, paddingBottom: 40 },
  label: { marginBottom: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.sm,
  },
  errorText: { marginBottom: spacing.md },
  folderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  folderChip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  selectedCard: { marginBottom: spacing.md, paddingVertical: spacing.sm },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  index: { width: 28 },
  addExercisesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  musclesSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
  },
  muscleNames: { marginTop: spacing.sm, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerContent: {
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerSearch: {
    marginHorizontal: spacing.lg + 4,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  pickerList: { maxHeight: 400 },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
});
