import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { fontScaleCap } from '@/theme/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useExercisesStore } from '@/store/exercisesStore';
import { EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS, MUSCLE_GROUPS, formatMuscleLabels } from '@muscleos/types';
import type { Exercise, ExerciseCategory } from '@muscleos/types';
import { ExerciseDetailSheet } from '@/components/ExerciseDetailSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  LARGE_MUSCLE_GROUPS,
  filterLibraryExercises,
  libraryExercises,
  exerciseTypeLine,
  libraryFilterSummary,
  type LibrarySource,
} from '@/utils/exerciseLibraryFilter';
import { isCustomExerciseId } from '@/utils/exerciseIds';

export default function ExercisesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  // Subscribe to the arrays (not the getAllExercises function) so deletes and catalog refreshes
  // re-render the list.
  const catalogExercises = useExercisesStore((s) => s.catalogExercises);
  const customExercises = useExercisesStore((s) => s.customExercises);
  const removeExercise = useExercisesStore((s) => s.removeExercise);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<LibrarySource>('all');
  /** Custom exercise waiting on the delete confirm. */
  const [deleting, setDeleting] = useState<Exercise | null>(null);
  const [typeFilter, setTypeFilter] = useState<ExerciseCategory | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const allExercises = useMemo(
    () => libraryExercises(catalogExercises, customExercises),
    [catalogExercises, customExercises]
  );

  const toggleFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltersExpanded((v) => !v);
  };

  const filterSummary = libraryFilterSummary(source, typeFilter, muscleFilter);

  const filtered = useMemo(
    () => filterLibraryExercises(allExercises, { query: search, source, type: typeFilter, muscle: muscleFilter }),
    [allExercises, search, source, typeFilter, muscleFilter]
  );

  return (
    <Screen kind="tab">
      <View style={screenHeaderStyles.headerFixed}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={[screenHeaderStyles.title, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>Exercises</Text>
            <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
              {allExercises.length} movements
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/create-exercise')}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: colors.primarySurface,
                borderColor: colors.primaryBorder,
              },
              pressed && { opacity: 0.85 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Create exercise"
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      <TextInput
        style={[
          styles.search,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Search by name, muscle, equipment..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterWrapper}>
        <Pressable
          style={({ pressed }) => [
            styles.filterToggleRow,
            {
              backgroundColor: colors.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={toggleFilters}
        >
          <Text style={[styles.filterToggleTitle, { color: colors.text }]}>Filters</Text>
          <Text style={[styles.filterSummaryInline, { color: colors.primary }]} numberOfLines={1}>
            {!filtersExpanded && filterSummary ? filterSummary : ''}
          </Text>
          <Ionicons
            name={filtersExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
        {filtersExpanded && (
          <View style={styles.filterExpandedContent}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                Show
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContent}
              >
                {(
                  [
                    ['all', 'All'],
                    ['catalog', 'Catalog'],
                    ['mine', `My exercises (${customExercises.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    testID={`source-${key}`}
                    accessibilityState={{ selected: source === key }}
                    style={[styles.chip, { backgroundColor: source === key ? colors.primary : colors.surface }]}
                    onPress={() => setSource(source === key ? 'all' : key)}
                  >
                    <Text
                      style={[styles.chipText, { color: source === key ? colors.primaryOn : colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                Type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContent}
              >
                <Pressable
                  style={[
                    styles.chip,
                    { backgroundColor: typeFilter === null ? colors.primary : colors.surface },
                  ]}
                  testID="type-chip-all"
                  onPress={() => setTypeFilter(null)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: typeFilter === null ? colors.primaryOn : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    All
                  </Text>
                </Pressable>
                {EXERCISE_CATEGORIES.map((key) => (
                  <Pressable
                    key={key}
                    testID={`type-chip-${key}`}
                    style={[
                      styles.chip,
                      { backgroundColor: typeFilter === key ? colors.primary : colors.surface },
                    ]}
                    onPress={() => setTypeFilter(typeFilter === key ? null : key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: typeFilter === key ? colors.primaryOn : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {EXERCISE_CATEGORY_LABELS[key]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                Muscle
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContent}
              >
                <Pressable
                  style={[
                    styles.chip,
                    { backgroundColor: muscleFilter === null ? colors.primary : colors.surface },
                  ]}
                  testID="muscle-chip-all"
                  onPress={() => setMuscleFilter(null)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: muscleFilter === null ? colors.primaryOn : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    All
                  </Text>
                </Pressable>
                {Object.entries(LARGE_MUSCLE_GROUPS).map(([key, group]) => (
                  <Pressable
                    key={key}
                    testID={`muscle-chip-${key}`}
                    style={[
                      styles.chip,
                      { backgroundColor: muscleFilter === key ? colors.primary : colors.surface },
                    ]}
                    onPress={() => setMuscleFilter(muscleFilter === key ? null : key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: muscleFilter === key ? colors.primaryOn : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {group.label}
                    </Text>
                  </Pressable>
                ))}
                {Object.values(MUSCLE_GROUPS).map((m) => (
                  <Pressable
                    key={m.id}
                    testID={`muscle-chip-${m.id}`}
                    style={[
                      styles.chip,
                      { backgroundColor: muscleFilter === m.id ? colors.primary : colors.surface },
                    ]}
                    onPress={() => setMuscleFilter(muscleFilter === m.id ? null : m.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: muscleFilter === m.id ? colors.primaryOn : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
      <View style={styles.listHeader}>
        <Text style={[styles.listCount, { color: colors.textSecondary }]}>
          {filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          search.trim() ? (
            <Pressable
              style={[styles.emptyCreate, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() =>
                router.push({ pathname: '/create-exercise', params: { name: search.trim() } })
              }
            >
              <Text style={[styles.emptyCreateTitle, { color: colors.text }]}>
                Create “{search.trim()}”
              </Text>
              <Text style={[styles.emptyCreateHint, { color: colors.textMuted }]}>
                Save it as your own exercise.
              </Text>
            </Pressable>
          ) : source === 'mine' && customExercises.length === 0 ? (
            <View style={[styles.emptyMine, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
              <Text style={[styles.emptyCreateTitle, { color: colors.text }]}>No exercises of your own yet</Text>
              <Text style={[styles.emptyMineHint, { color: colors.textMuted }]}>
                Make one for a movement that isn't in the library. It shows up here to edit or delete.
              </Text>
              <PrimaryButton label="Create exercise" onPress={() => router.push('/create-exercise')} />
            </View>
          ) : (
            <Text style={[styles.emptyCreateHint, { color: colors.textMuted }]}>No exercises match these filters.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => {
              setSelected(item);
            }}
          >
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
              {isCustomExerciseId(item.id) && source === 'all' && (
                <View style={[styles.customBadge, { backgroundColor: colors.border }]}>
                  <Text style={[styles.customBadgeText, { color: colors.textSecondary }]}>
                    Custom
                  </Text>
                </View>
              )}
              {isCustomExerciseId(item.id) && source === 'mine' && (
                <Pressable
                  onPress={() => setDeleting(item)}
                  hitSlop={10}
                  testID={`delete-exercise-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              )}
            </View>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {formatMuscleLabels(item.muscles, ' · ')}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {exerciseTypeLine(item)}
            </Text>
          </Pressable>
        )}
      />
      <ExerciseDetailSheet exercise={selected} onClose={() => setSelected(null)} canManage />
      <ConfirmDialog
        visible={deleting !== null}
        title="Delete exercise"
        message={`Remove ${deleting?.name ?? ''} from your account? Past workouts keep the name if you logged it.`}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        destructive="confirm"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void removeExercise(deleting.id);
          setDeleting(null);
        }}
        cancelTestID="delete-exercise-cancel"
        confirmTestID="delete-exercise-confirm"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextBlock: { flex: 1, minWidth: 0 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  deleteBtn: { padding: 2 },
  emptyMine: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyMineHint: { ...typography.caption, textAlign: 'center', marginBottom: spacing.sm },
  filterWrapper: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm + 2,
  },
  filterToggleTitle: { ...typography.bodyMedium },
  filterSummaryInline: { ...typography.caption, flex: 1, textAlign: 'right' },
  filterExpandedContent: { paddingTop: spacing.lg },
  filterSection: { marginBottom: spacing.lg },
  filterLabel: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  chipsScroll: { flexGrow: 0 },
  chipsContent: {
    paddingHorizontal: spacing.lg,
    paddingRight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  chipText: { ...typography.label },
  listHeader: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  listCount: { ...typography.caption },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  card: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cardTitle: { ...typography.bodyMedium, flex: 1 },
  customBadge: { paddingHorizontal: spacing.sm - 2, paddingVertical: 2, borderRadius: radius.sm - 2 },
  customBadgeText: { ...typography.caption, fontFamily: typography.label.fontFamily },
  cardMeta: { ...typography.caption, marginTop: spacing.xs },
  emptyCreate: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  emptyCreateTitle: { ...typography.bodyMedium },
  emptyCreateHint: { ...typography.caption, marginTop: spacing.sm },
});
