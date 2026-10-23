import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheetFrame } from '@/components/layout';
import { PickerHeaderActions } from '@/components/PickerHeaderActions';
import { useExercisesStore } from '@/store/exercisesStore';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { useModalMaxHeight } from '@/theme/layout';
import { pickerFooter, pickerResults } from '@/utils/exercisePicker';

type ExercisePickerSheetProps = {
  mode: 'add' | 'replace';
  /** Under the title, e.g. which exercise is being swapped. */
  hint?: string;
  /** Exercises already in the workout; never offered, so neither mode can add a duplicate. */
  excludeIds: readonly string[];
  search: string;
  onSearchChange: (search: string) => void;
  onPick: (exerciseId: string) => void;
  /** + New and the `Create "<query>"` row. Omitted, the sheet offers no create. */
  onCreate?: () => void;
  onClose: () => void;
};

/**
 * Bottom sheet for adding or replacing an exercise in a workout (the workout screen and Edit
 * workout). Spec: docs/features/exercise-library.md#exercise-pickers
 */
export function ExercisePickerSheet({
  mode,
  hint,
  excludeIds,
  search,
  onSearchChange,
  onPick,
  onCreate,
  onClose,
}: ExercisePickerSheetProps) {
  const { colors } = useTheme();
  const sheetMaxHeight = useModalMaxHeight();
  const listMaxHeight = Math.max(80, sheetMaxHeight - 180);
  const getAllExercises = useExercisesStore((s) => s.getAllExercises);
  const customExercises = useExercisesStore((s) => s.customExercises);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardSubRef = useRef<{ remove: () => void } | null>(null);

  const excludeKey = excludeIds.join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: customExercises changes what getAllExercises returns
  const results = useMemo(
    () => pickerResults(getAllExercises(), search, excludeKey.split(',')),
    [search, customExercises, getAllExercises, excludeKey]
  );
  const footer = pickerFooter(search, results.length);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const subs = [Keyboard.addListener('keyboardWillShow', onShow), Keyboard.addListener('keyboardDidShow', onShow)];
    return () => {
      for (const sub of subs) sub.remove();
      keyboardSubRef.current?.remove();
    };
  }, []);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay, paddingBottom: keyboardHeight }]}
        onPress={onClose}
      >
        <SheetFrame
          onStartShouldSetResponder={() => true}
          style={
            keyboardHeight > 0
              ? {
                  height: Math.max(240, sheetMaxHeight - keyboardHeight),
                  maxHeight: Math.max(240, sheetMaxHeight - keyboardHeight),
                  paddingBottom: 12,
                }
              : undefined
          }
        >
          <View style={[styles.header, { borderBottomColor: colors.subtleDivider }]}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: colors.text }]}>
                {mode === 'replace' ? 'Replace exercise' : 'Add exercise'}
              </Text>
              {hint ? (
                <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={2}>
                  {hint}
                </Text>
              ) : null}
            </View>
            <PickerHeaderActions onNew={onCreate} onDone={onClose} />
          </View>
          <TextInput
            style={[styles.search, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Search exercises..."
            testID="picker-search"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={onSearchChange}
            autoCorrect={false}
            autoCapitalize="none"
            onFocus={() => {
              const metrics = Keyboard.metrics();
              if (metrics?.height) setKeyboardHeight(metrics.height);
              keyboardSubRef.current?.remove();
              keyboardSubRef.current = Keyboard.addListener('keyboardDidShow', (e) => {
                setKeyboardHeight(e.endCoordinates.height);
              });
              setTimeout(() => {
                setKeyboardHeight((current) =>
                  current > 0 ? current : Math.round(Dimensions.get('window').height * 0.38)
                );
              }, 280);
            }}
            onBlur={() => {
              keyboardSubRef.current?.remove();
              keyboardSubRef.current = null;
              setKeyboardHeight(0);
            }}
          />
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            style={keyboardHeight > 0 ? { flex: 1, minHeight: 0 } : { maxHeight: listMaxHeight }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              footer.showNoMatches ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>No matching exercises</Text>
              ) : null
            }
            ListFooterComponent={
              onCreate && footer.createName != null ? (
                <Pressable
                  testID="picker-create-exercise"
                  style={[styles.row, styles.createRow, { borderBottomColor: colors.border }]}
                  onPress={onCreate}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={[typography.bodyMedium, { color: colors.primary, flex: 1 }]}>
                    Create “{footer.createName}”
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, { borderBottomColor: colors.border }]}
                testID={`picker-row-${item.id}`}
                onPress={() => onPick(item.id)}
              >
                <Text style={[styles.rowText, { color: colors.text }]}>{item.name}</Text>
                <Ionicons name={mode === 'replace' ? 'swap-horizontal' : 'add'} size={20} color={colors.primary} />
              </Pressable>
            )}
          />
        </SheetFrame>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  titleBlock: { flex: 1, paddingRight: 12, gap: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { ...typography.caption, fontSize: 13, lineHeight: 18 },
  search: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  empty: { paddingVertical: 24, paddingHorizontal: 20, textAlign: 'center', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  createRow: { justifyContent: 'flex-start', gap: 10 },
  rowText: { fontSize: 16, fontWeight: '500' },
});
