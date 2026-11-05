import { memo, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  formatMuscleLabels,
  instructionSteps,
  muscleLabel,
  type Exercise,
  type MuscleId,
} from '@muscleos/types';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import { ExerciseMuscleFigures } from '@/components/ExerciseMuscleFigures';
import { PickerHeaderActions } from '@/components/PickerHeaderActions';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useExercisesStore } from '@/store/exercisesStore';
import { useTheme } from '@/theme/ThemeContext';
import type { ThemeColors } from '@/theme/palette';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { useKeyboardOverlap } from '@/theme/layout';
import { exerciseDemoPosterUrl } from '@/utils/exerciseDemo';
import { exerciseTypeLine } from '@/utils/exerciseLibraryFilter';
import {
  activePickerFilterCount,
  exerciseMuscleSplit,
  NO_PICKER_FILTERS,
  PICKER_EQUIPMENT,
  pickerFooter,
  pickerResults,
  type PickerFilters,
} from '@/utils/exercisePicker';
import { MUSCLE_AREAS } from '@/utils/muscleAreas';

type ExercisePickerSheetProps = {
  mode: 'add' | 'replace';
  /** Under the title, e.g. which exercise is being swapped. */
  hint?: string;
  /** Exercises already in the workout; never offered, so neither mode can add a duplicate. */
  excludeIds: readonly string[];
  search: string;
  onSearchChange: (search: string) => void;
  onPick: (exerciseId: string) => void;
  /**
   * The picker stays open after a pick (the template editor): added rows show a check, and tapping
   * it calls this to take the exercise back out. Omitted, the caller closes the picker on pick.
   */
  onUnpick?: (exerciseId: string) => void;
  /** + New and the `Create "<query>"` row. Omitted, the picker offers no create. */
  onCreate?: () => void;
  /** The template's muscles so far: shows the coverage strip and the **New muscles only** filter. */
  coverage?: { muscleIds: readonly MuscleId[]; exerciseCount: number };
  onClose: () => void;
};

type FilterMenu = 'type' | 'equipment' | null;

/**
 * Full-screen exercise picker for the template editor, the workout screen and Edit workout: search,
 * muscle / type / equipment filters, a two-column grid of cards showing each exercise's demo poster
 * (its body figures where there's no demo), and a detail view (tap a card) shown in the same modal —
 * stacking a second Modal froze iOS.
 * Spec: docs/features/exercise-library.md#exercise-pickers
 */
export function ExercisePickerSheet({
  mode,
  hint,
  excludeIds,
  search,
  onSearchChange,
  onPick,
  onUnpick,
  onCreate,
  coverage,
  onClose,
}: ExercisePickerSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - spacing.lg * 2 - GRID_GAP) / 2);
  const keyboard = useKeyboardOverlap();
  const getAllExercises = useExercisesStore((s) => s.getAllExercises);
  const customExercises = useExercisesStore((s) => s.customExercises);
  const [filters, setFilters] = useState<PickerFilters>(NO_PICKER_FILTERS);
  const [menu, setMenu] = useState<FilterMenu>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  /** Exercises added during this visit (stay-open pickers only); they stay listed with a check. */
  const [addedHere, setAddedHere] = useState<string[]>([]);

  const excludeKey = excludeIds.join(',');
  const coveredKey = coverage?.muscleIds.join(',') ?? '';
  const addedKey = addedHere.join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: customExercises changes what getAllExercises returns; the keys stand in for their arrays
  const results = useMemo(
    () =>
      pickerResults(getAllExercises(), search, excludeKey.split(','), {
        filters,
        covered: new Set(coveredKey.split(',') as MuscleId[]),
        keepIds: new Set(addedKey.split(',')),
      }),
    [search, customExercises, getAllExercises, excludeKey, filters, coveredKey, addedKey]
  );
  const filterCount = activePickerFilterCount(filters);
  const footer = pickerFooter(search, results.length, filterCount > 0);
  const stayOpen = onUnpick != null;
  const isAdded = (id: string) => stayOpen && addedHere.includes(id) && excludeIds.includes(id);

  const pick = (id: string) => {
    if (stayOpen) setAddedHere((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onPick(id);
  };
  const unpick = (id: string) => {
    setAddedHere((prev) => prev.filter((x) => x !== id));
    onUnpick?.(id);
  };

  const detail = detailId ? getAllExercises().find((e) => e.id === detailId) ?? null : null;
  const setFilter = (patch: Partial<PickerFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setMenu(null);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={detail ? () => setDetailId(null) : onClose}>
      <View
        style={[
          styles.screen,
          { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: Math.max(keyboard, insets.bottom) },
        ]}
      >
        {detail ? (
          <PickerExerciseDetail
            exercise={detail}
            mode={mode}
            added={isAdded(detail.id)}
            canUndo={stayOpen}
            onBack={() => setDetailId(null)}
            onPick={() => {
              pick(detail.id);
              setDetailId(null);
            }}
            onUnpick={() => unpick(detail.id)}
          />
        ) : (
          <>
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
              <PickerHeaderActions onNew={onCreate} onDone={onClose} doneCount={stayOpen ? addedHere.length : 0} />
            </View>

            {coverage && keyboard === 0 ? (
              <View
                style={[styles.coverage, { backgroundColor: colors.surface, borderColor: colors.border }]}
                testID="picker-coverage"
              >
                <ExerciseMuscleFigures muscles={coverage.muscleIds} width={26} even />
                <View style={styles.coverageText}>
                  <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Template so far</Text>
                  <Text style={[typography.data, { color: colors.text }]}>
                    {coverage.exerciseCount === 1 ? '1 exercise' : `${coverage.exerciseCount} exercises`}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                    {coverage.muscleIds.length > 0 ? formatMuscleLabels([...coverage.muscleIds]) : 'No muscles yet'}
                  </Text>
                </View>
              </View>
            ) : null}

            <TextInput
              style={[styles.search, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Search exercises..."
              testID="picker-search"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={onSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {coverage ? (
                <Chip
                  label="New muscles only"
                  icon="add-circle-outline"
                  active={filters.newMusclesOnly}
                  onPress={() => setFilter({ newMusclesOnly: !filters.newMusclesOnly })}
                  testID="picker-filter-new-muscles"
                  colors={colors}
                  round
                />
              ) : null}
              <Chip
                label={`Type: ${filters.category ? EXERCISE_CATEGORY_LABELS[filters.category] : 'All'}`}
                trailingIcon={menu === 'type' ? 'chevron-up' : 'chevron-down'}
                active={filters.category != null}
                onPress={() => setMenu(menu === 'type' ? null : 'type')}
                testID="picker-filter-type"
                colors={colors}
                round
              />
              <Chip
                label={`Equipment: ${filters.equipment ? EQUIPMENT_LABELS[filters.equipment] : 'Any'}`}
                trailingIcon={menu === 'equipment' ? 'chevron-up' : 'chevron-down'}
                active={filters.equipment != null}
                onPress={() => setMenu(menu === 'equipment' ? null : 'equipment')}
                testID="picker-filter-equipment"
                colors={colors}
                round
              />
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {menu === 'type' ? (
                <>
                  <Chip label="All" active={filters.category == null} onPress={() => setFilter({ category: null })} colors={colors} />
                  {EXERCISE_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      label={EXERCISE_CATEGORY_LABELS[c]}
                      active={filters.category === c}
                      onPress={() => setFilter({ category: c })}
                      testID={`picker-type-${c}`}
                      colors={colors}
                    />
                  ))}
                </>
              ) : menu === 'equipment' ? (
                <>
                  <Chip label="Any" active={filters.equipment == null} onPress={() => setFilter({ equipment: null })} colors={colors} />
                  {PICKER_EQUIPMENT.map((e) => (
                    <Chip
                      key={e}
                      label={EQUIPMENT_LABELS[e]}
                      active={filters.equipment === e}
                      onPress={() => setFilter({ equipment: e })}
                      testID={`picker-equipment-${e}`}
                      colors={colors}
                    />
                  ))}
                </>
              ) : (
                <>
                  <Chip label="All" active={filters.area == null} onPress={() => setFilter({ area: null })} colors={colors} />
                  {MUSCLE_AREAS.map((a) => (
                    <Chip
                      key={a.key}
                      label={a.label}
                      active={filters.area === a.key}
                      onPress={() => setFilter({ area: filters.area === a.key ? null : a.key })}
                      testID={`picker-area-${a.key}`}
                      colors={colors}
                    />
                  ))}
                </>
              )}
            </ScrollView>

            <View style={styles.countRow}>
              <Text style={[typography.data, styles.count, { color: colors.textMuted }]} testID="picker-count">
                {results.length === 1 ? '1 exercise' : `${results.length} exercises`}
              </Text>
              {filterCount > 0 ? (
                <Pressable onPress={() => setFilter(NO_PICKER_FILTERS)} hitSlop={8} testID="picker-clear-filters">
                  <Text style={[typography.caption, { color: colors.primary }]}>Clear filters</Text>
                </Pressable>
              ) : (
                <Text style={[typography.caption, { color: colors.textMuted }]}>Tap for details</Text>
              )}
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              style={[styles.list, { borderTopColor: colors.subtleDivider }]}
              contentContainerStyle={styles.grid}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={8}
              windowSize={7}
              ListEmptyComponent={
                footer.emptyMessage ? (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>{footer.emptyMessage}</Text>
                ) : null
              }
              ListFooterComponent={
                onCreate && footer.createName != null ? (
                  <Pressable
                    testID="picker-create-exercise"
                    style={[styles.createRow, { borderColor: colors.border }]}
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
                <PickerCard
                  exercise={item}
                  width={cardWidth}
                  mode={mode}
                  added={isAdded(item.id)}
                  onOpen={setDetailId}
                  onPick={pick}
                  onUnpick={unpick}
                />
              )}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

/** Space between the grid's two columns and between its rows. */
const GRID_GAP = spacing.md;

const PickerCard = memo(function PickerCard({
  exercise,
  width,
  mode,
  added,
  onOpen,
  onPick,
  onUnpick,
}: {
  exercise: Exercise;
  width: number;
  mode: 'add' | 'replace';
  added: boolean;
  onOpen: (id: string) => void;
  onPick: (id: string) => void;
  onUnpick: (id: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const { main } = exerciseMuscleSplit(exercise.muscles);
  const posterUrl = exerciseDemoPosterUrl(exercise, isDark ? 'dark' : 'light');
  const [posterFailed, setPosterFailed] = useState(false);
  return (
    <View
      style={[styles.card, { width, backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Pressable
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        testID={`picker-row-${exercise.id}`}
        onPress={() => onOpen(exercise.id)}
        accessibilityRole="button"
        accessibilityLabel={exercise.name}
        accessibilityHint="Shows its muscles and how to do it"
      >
        <View style={[styles.cardImage, { height: width }]}>
          {posterUrl && !posterFailed ? (
            <Image
              source={{ uri: posterUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setPosterFailed(true)}
              testID={`picker-poster-${exercise.id}`}
            />
          ) : (
            <ExerciseMuscleFigures muscles={exercise.muscles} width={Math.floor(width * 0.36)} gap={spacing.xs} />
          )}
        </View>
        <View style={styles.cardLabel}>
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
            {exercise.name}
          </Text>
          {main ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
              {muscleLabel(main)}
            </Text>
          ) : null}
          <Text style={[styles.typeLine, { color: colors.textMuted }]} numberOfLines={1}>
            {exerciseTypeLine(exercise)}
          </Text>
        </View>
      </Pressable>
      {/* Overlaid so the thicker outline doesn't shift the card's contents. */}
      {added ? <View pointerEvents="none" style={[styles.cardAdded, { borderColor: colors.success }]} /> : null}
      <Pressable
        onPress={() => (added ? onUnpick(exercise.id) : onPick(exercise.id))}
        testID={`picker-add-${exercise.id}`}
        accessibilityRole="button"
        accessibilityLabel={
          added ? `Added ${exercise.name}, tap to remove` : mode === 'replace' ? `Swap in ${exercise.name}` : `Add ${exercise.name}`
        }
        accessibilityState={{ selected: added }}
        hitSlop={4}
        style={({ pressed }) => [
          styles.addBtn,
          added
            ? { backgroundColor: colors.success, borderColor: colors.success }
            : { backgroundColor: colors.primary, borderColor: colors.primary },
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons
          name={added ? 'checkmark' : mode === 'replace' ? 'swap-horizontal' : 'add'}
          size={22}
          color={added ? colors.successOn : colors.primaryOn}
        />
      </Pressable>
    </View>
  );
});

function PickerExerciseDetail({
  exercise,
  mode,
  added,
  canUndo,
  onBack,
  onPick,
  onUnpick,
}: {
  exercise: Exercise;
  mode: 'add' | 'replace';
  added: boolean;
  canUndo: boolean;
  onBack: () => void;
  onPick: () => void;
  onUnpick: () => void;
}) {
  const { colors } = useTheme();
  const { main, also } = exerciseMuscleSplit(exercise.muscles);
  const steps = instructionSteps(exercise.instructions);
  const { width } = useWindowDimensions();
  return (
    <>
      <View style={styles.detailHeader}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          testID="picker-detail-back"
          accessibilityRole="button"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.primary }]}>Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.detailBody}>
        <Text style={[typography.screenTitle, { color: colors.text }]}>{exercise.name}</Text>
        <Text style={[styles.typeLine, styles.detailType, { color: colors.textSecondary }]}>
          {exerciseTypeLine(exercise)}
        </Text>
        <View style={[styles.figureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ExerciseDemo
            exercise={exercise}
            size={Math.min(width - (spacing.lg + 4 + spacing.md) * 2, 320)}
            fallback={<ExerciseMuscleFigures muscles={exercise.muscles} width={110} gap={spacing.xl} />}
          />
          <View style={[styles.legend, { borderTopColor: colors.subtleDivider }]}>
            {main ? (
              <View style={styles.legendRow}>
                <Text style={[typography.caption, styles.legendLabel, { color: colors.textMuted }]}>Main</Text>
                <MusclePill label={muscleLabel(main)} strong colors={colors} />
              </View>
            ) : null}
            {also.length > 0 ? (
              <View style={styles.legendRow}>
                <Text style={[typography.caption, styles.legendLabel, { color: colors.textMuted }]}>Also works</Text>
                <View style={styles.pillWrap}>
                  {also.map((m) => (
                    <MusclePill key={m} label={muscleLabel(m)} colors={colors} />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
        {steps.length > 0 ? (
          <>
            <Text style={[styles.eyebrow, styles.stepsLabel, { color: colors.textMuted }]}>How to</Text>
            {steps.map((step, i) => (
              <View key={`${i}-${step}`} style={styles.stepRow}>
                {steps.length > 1 ? (
                  <Text style={[typography.body, styles.stepNumber, { color: colors.textSecondary }]}>{i + 1}.</Text>
                ) : null}
                <Text style={[typography.body, styles.stepText, { color: colors.text }]}>{step}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.detailFooter, { borderTopColor: colors.subtleDivider }]}>
        {added ? (
          <PrimaryButton
            label="Added · tap to remove"
            variant="outline"
            onPress={onUnpick}
            disabled={!canUndo}
            testID="picker-detail-remove"
          />
        ) : (
          <PrimaryButton
            label={mode === 'replace' ? 'Swap in this exercise' : 'Add exercise'}
            onPress={onPick}
            testID="picker-detail-add"
          />
        )}
      </View>
    </>
  );
}

function MusclePill({ label, strong = false, colors }: { label: string; strong?: boolean; colors: ThemeColors }) {
  return (
    <View style={[styles.pill, { backgroundColor: strong ? colors.successSurface : colors.surfaceElevated }]}>
      <Text style={[typography.caption, { color: strong ? colors.text : colors.textSecondary, fontFamily: typography.label.fontFamily }]}>
        {label}
      </Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  colors,
  icon,
  trailingIcon,
  round = false,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  icon?: keyof typeof Ionicons.glyphMap;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  round?: boolean;
  testID?: string;
}) {
  const fg = active ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        round && styles.chipRound,
        {
          backgroundColor: active ? colors.primarySurface : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[typography.caption, styles.chipText, { color: fg }]}>{label}</Text>
      {trailingIcon ? <Ionicons name={trailingIcon} size={12} color={fg} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  titleBlock: { flex: 1, paddingRight: 12, gap: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { ...typography.caption, fontSize: 13, lineHeight: 18 },
  coverage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coverageText: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  search: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  chipScroll: { flexGrow: 0, marginTop: spacing.sm },
  chipRow: { gap: spacing.sm - 2, paddingHorizontal: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: spacing.md - 1,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipRound: { borderRadius: 16 },
  chipText: { fontFamily: typography.label.fontFamily },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  count: { fontSize: 12 },
  list: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { paddingVertical: 24, paddingHorizontal: 20, textAlign: 'center', fontSize: 15 },
  grid: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardAdded: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.lg, borderWidth: 2 },
  cardImage: { alignItems: 'center', justifyContent: 'center' },
  cardLabel: { paddingHorizontal: spacing.sm + 2, paddingTop: spacing.sm, paddingBottom: spacing.sm + 2, gap: 2 },
  cardName: { fontSize: 15, fontWeight: '500', lineHeight: 19 },
  typeLine: { ...typography.caption, fontFamily: typography.data.fontFamily, fontSize: 11 },
  addBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: touch.min,
    height: touch.min,
    borderRadius: touch.min / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  detailHeader: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: touch.min, alignSelf: 'flex-start', gap: 2 },
  detailBody: { paddingHorizontal: spacing.lg + 4, paddingBottom: spacing.xl },
  detailType: { fontSize: 13, marginTop: spacing.xs },
  figureCard: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  legend: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  legendLabel: { width: 76, paddingTop: 3 },
  pillWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  pill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.sm },
  stepsLabel: { marginTop: spacing.xl, marginBottom: spacing.sm },
  stepRow: { flexDirection: 'row', marginBottom: spacing.xs },
  stepNumber: { width: 24 },
  stepText: { flex: 1 },
  detailFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
