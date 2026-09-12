import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  Keyboard,
  Dimensions,
  type KeyboardEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useTheme } from '@/theme/ThemeContext';
import { Screen, SheetFrame } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useBottomSpace, useModalMaxHeight } from '@/theme/layout';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExercisesStore } from '@/store/exercisesStore';
import type { WorkoutTemplate } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { formatMuscleLabels } from '@muscleos/types';
import { Ionicons } from '@expo/vector-icons';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRequirePro } from '@/hooks/useProGate';
import { searchExercises } from '@/utils/exerciseSearch';

export default function CreateTemplateScreen() {
  const isPro = useRequirePro('custom_templates');
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace(spacing.xl);
  const sheetMaxHeight = useModalMaxHeight();
  const pickerListMaxHeight = Math.max(80, sheetMaxHeight - 180);
  const router = useRouter();
  const { templateId: editTemplateId } = useLocalSearchParams<{ templateId?: string }>();
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const loadTemplates = useTemplatesStore((s) => s.load);
  const userTemplates = useTemplatesStore((s) => s.userTemplates);
  const folders = useTemplatesStore((s) => s.folders);
  const savingRef = useRef(false);

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
  const [pickerKeyboardHeight, setPickerKeyboardHeight] = useState(0);
  const pickerKeyboardSubRef = useRef<{ remove: () => void } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickerExercises = useMemo(() => {
    return searchExercises(allExercises, pickerSearch).filter((e) => !selectedIds.includes(e.id));
  }, [allExercises, pickerSearch, selectedIds]);

  function addExerciseId(id: string) {
    if (!selectedIds.includes(id)) setSelectedIds((prev) => [...prev, id]);
    setPickerSearch('');
  }

  function removeExerciseId(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  function closePicker() {
    setShowPicker(false);
    setPickerSearch('');
    setPickerKeyboardHeight(0);
    pickerKeyboardSubRef.current?.remove();
    pickerKeyboardSubRef.current = null;
  }

  useEffect(() => {
    if (!showPicker) {
      setPickerKeyboardHeight(0);
      return;
    }
    const onShow = (e: KeyboardEvent) => {
      setPickerKeyboardHeight(e.endCoordinates.height);
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', onShow),
      Keyboard.addListener('keyboardDidShow', onShow),
    ];
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, [showPicker]);

  async function handleSave() {
    if (savingRef.current) return;
    const missingName = !name.trim();
    const missingExercises = selectedIds.length === 0;
    if (missingName || missingExercises) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    savingRef.current = true;
    setSaving(true);
    try {
      if (isEditMode && existingTemplate) {
        await updateTemplate(existingTemplate.id, {
          name: name.trim(),
          exerciseIds: selectedIds,
          ...(folderId !== undefined && { folderId }),
        });
      } else {
        const template: WorkoutTemplate = {
          id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: name.trim(),
          exerciseIds: selectedIds,
          isBuiltIn: false,
          ...(folderId && { folderId }),
        };
        await addTemplate(template);
      }
      router.back();
    } catch {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const templateMuscleIds: MuscleId[] = useMemo(
    () => Array.from(new Set(selectedIds.flatMap((id) => getExercise(id)?.muscles ?? []))),
    [selectedIds, getExercise]
  );

  const canReorder = selectedIds.length > 1;

  if (!isPro) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Screen kind="chrome">
      <ScreenHeader
        title={isEditMode ? 'Edit template' : 'New template'}
        onBack={() => router.back()}
        backIcon="close"
      />
      <DraggableFlatList
        data={selectedIds}
        keyExtractor={(id) => id}
        onDragEnd={({ data }) => setSelectedIds(data)}
        activationDistance={9999}
        containerStyle={styles.scroll}
        contentContainerStyle={[styles.form, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
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
            {canReorder ? (
              <Text style={[typography.caption, styles.reorderHint, { color: colors.textMuted }]}>
                Hold and drag to rearrange
              </Text>
            ) : null}
            {selectedIds.length === 0 ? (
              <Card
                elevated
                style={[
                  styles.selectedCard,
                  showErrors ? { borderColor: colors.danger } : null,
                ]}
              >
                <Text style={[typography.body, { color: colors.textMuted }]}>No exercises yet</Text>
              </Card>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View>
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
                  {formatMuscleLabels(templateMuscleIds)}
                </Text>
              </Card>
            )}

            <PrimaryButton
              label={
                saving
                  ? 'Saving…'
                  : isEditMode
                    ? 'Save changes'
                    : 'Save template'
              }
              onPress={handleSave}
              disabled={saving}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        }
        renderItem={({ item: id, getIndex, drag, isActive }: RenderItemParams<string>) => {
          const index = getIndex() ?? 0;
          const ex = getExercise(id);
          const isFirst = index === 0;
          const isLast = index === selectedIds.length - 1;
          return (
            <ScaleDecorator>
              <View
                style={[
                  styles.selectedRow,
                  {
                    backgroundColor: isActive ? colors.surfaceElevated : colors.surface,
                    borderColor: colors.border,
                    borderTopWidth: isFirst ? StyleSheet.hairlineWidth : 0,
                    borderTopLeftRadius: isFirst ? radius.md : 0,
                    borderTopRightRadius: isFirst ? radius.md : 0,
                    borderBottomLeftRadius: isLast ? radius.md : 0,
                    borderBottomRightRadius: isLast ? radius.md : 0,
                    marginBottom: isLast ? spacing.md : 0,
                  },
                  isActive && styles.selectedRowActive,
                ]}
              >
                <Pressable
                  onLongPress={canReorder ? drag : undefined}
                  delayLongPress={120}
                  style={styles.selectedRowMain}
                >
                  {canReorder ? (
                    <View style={styles.dragHandle}>
                      <Ionicons name="reorder-three" size={22} color={colors.textMuted} />
                    </View>
                  ) : null}
                  <Text style={[typography.data, styles.index, { color: colors.textMuted }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {ex?.name ?? id}
                  </Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => removeExerciseId(id)}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </ScaleDecorator>
          );
        }}
      />

      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={closePicker}>
        <Pressable
          style={[
            styles.modalOverlay,
            { backgroundColor: colors.overlay, paddingBottom: pickerKeyboardHeight },
          ]}
          onPress={closePicker}
        >
          <SheetFrame
            onStartShouldSetResponder={() => true}
            style={
              pickerKeyboardHeight > 0
                ? {
                    height: Math.max(240, sheetMaxHeight - pickerKeyboardHeight),
                    maxHeight: Math.max(240, sheetMaxHeight - pickerKeyboardHeight),
                    paddingBottom: 12,
                  }
                : undefined
            }
          >
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[typography.sectionTitle, { color: colors.text }]}>Add exercise</Text>
              <Pressable onPress={closePicker} hitSlop={8}>
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
              autoCorrect={false}
              autoCapitalize="none"
              onFocus={() => {
                const metrics = Keyboard.metrics();
                if (metrics?.height) {
                  setPickerKeyboardHeight(metrics.height);
                }
                pickerKeyboardSubRef.current?.remove();
                pickerKeyboardSubRef.current = Keyboard.addListener('keyboardDidShow', (e) => {
                  setPickerKeyboardHeight(e.endCoordinates.height);
                });
                setTimeout(() => {
                  setPickerKeyboardHeight((current) =>
                    current > 0 ? current : Math.round(Dimensions.get('window').height * 0.38)
                  );
                }, 280);
              }}
              onBlur={() => {
                pickerKeyboardSubRef.current?.remove();
                pickerKeyboardSubRef.current = null;
                setPickerKeyboardHeight(0);
              }}
            />
            <FlatList
              data={pickerExercises}
              keyExtractor={(item) => item.id}
              style={pickerKeyboardHeight > 0 ? { flex: 1, minHeight: 0 } : { maxHeight: pickerListMaxHeight }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                  onPress={() => addExerciseId(item.id)}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {formatMuscleLabels(item.muscles, ' · ')}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={colors.primary} />
                </Pressable>
              )}
              ListEmptyComponent={
                pickerSearch.trim() ? (
                  <Pressable
                    style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      closePicker();
                      router.push({
                        pathname: '/create-exercise',
                        params: { name: pickerSearch.trim() },
                      });
                    }}
                  >
                    <Text style={[typography.bodyMedium, { color: colors.primary }]}>
                      Create “{pickerSearch.trim()}”
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[typography.body, { color: colors.textMuted, padding: spacing.lg, textAlign: 'center' }]}>
                    No matching exercises
                  </Text>
                )
              }
            />
          </SheetFrame>
        </Pressable>
      </Modal>
    </Screen>
    </GestureHandlerRootView>
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
  reorderHint: { marginBottom: spacing.sm, marginTop: -spacing.xs },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedRowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dragHandle: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRowActive: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
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
