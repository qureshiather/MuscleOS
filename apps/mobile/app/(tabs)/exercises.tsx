import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen, SheetFrame } from '@/components/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useExercisesStore } from '@/store/exercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useProGate } from '@/hooks/useProGate';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { Exercise, MuscleId } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';

/** Equipment type filter: Cable, Machine, or Free Weight (barbell, dumbbell, etc.). */
const EQUIPMENT_TYPE = {
  cable: ['cable'] as const,
  machine: ['machine'] as const,
  free_weight: ['barbell', 'dumbbell', 'kettlebell', 'ez_bar', 'bodyweight', 'band'] as const,
} as const;
type EquipmentTypeKey = keyof typeof EQUIPMENT_TYPE;

/** Large muscle groups for filtering: small muscle IDs in each. */
const LARGE_MUSCLE_GROUPS: Record<string, MuscleId[]> = {
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  back: ['lats', 'traps', 'lower_back', 'rhomboids'],
  chest: ['chest'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
};

const LARGE_GROUP_LABELS: Record<string, string> = {
  legs: 'Legs',
  back: 'Back',
  chest: 'Chest',
  shoulders: 'Shoulders',
};

function exerciseMatchesType(e: Exercise, typeKey: EquipmentTypeKey | null): boolean {
  if (!typeKey) return true;
  const equipmentList = EQUIPMENT_TYPE[typeKey];
  return e.equipment.some((eq) => (equipmentList as readonly string[]).includes(eq));
}

function exerciseMatchesMuscleFilter(e: Exercise, muscleFilter: string | null): boolean {
  if (!muscleFilter) return true;
  const largeIds = LARGE_MUSCLE_GROUPS[muscleFilter];
  if (largeIds) {
    return e.muscles.some((m) => largeIds.includes(m));
  }
  return e.muscles.includes(muscleFilter as MuscleId);
}

export default function ExercisesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isPro, gatePro } = useProGate();
  const getAllExercises = useExercisesStore((s) => s.getAllExercises);
  const notes = useExerciseNotesStore((s) => s.notes);
  const setNote = useExerciseNotesStore((s) => s.setNote);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EquipmentTypeKey | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const allExercises = getAllExercises();

  const toggleFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltersExpanded((v) => !v);
  };

  const typeLabel = typeFilter === null ? 'All' : typeFilter === 'free_weight' ? 'Free Weight' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1);
  const muscleLabel = muscleFilter === null ? 'All' : LARGE_GROUP_LABELS[muscleFilter] ?? MUSCLE_GROUPS[muscleFilter as MuscleId]?.name ?? muscleFilter;
  const filterSummary = `${typeLabel} · ${muscleLabel}`;

  const filtered = useMemo(() => {
    let list = allExercises;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscles.some((m) => MUSCLE_GROUPS[m].name.toLowerCase().includes(q)) ||
          e.equipment.some((eq) => eq.toLowerCase().includes(q))
      );
    }
    list = list.filter((e) => exerciseMatchesType(e, typeFilter));
    list = list.filter((e) => exerciseMatchesMuscleFilter(e, muscleFilter));
    return list;
  }, [allExercises, search, typeFilter, muscleFilter]);

  return (
    <Screen kind="tab">
      <View style={screenHeaderStyles.headerFixed}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Exercises</Text>
            <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
              {allExercises.length} movements · tap for muscle map
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (gatePro('custom_exercises')) router.push('/create-exercise');
            }}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: isPro ? colors.primarySurface : colors.surface,
                borderColor: isPro ? colors.primaryBorder : colors.border,
              },
              pressed && { opacity: 0.85 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color={isPro ? colors.primary : colors.textSecondary} />
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
          {!filtersExpanded && (
            <Text style={[styles.filterSummaryInline, { color: colors.textMuted }]} numberOfLines={1}>
              {filterSummary}
            </Text>
          )}
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
                {(['cable', 'machine', 'free_weight'] as const).map((key) => (
                  <Pressable
                    key={key}
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
                      {key === 'free_weight' ? 'Free Weight' : key.charAt(0).toUpperCase() + key.slice(1)}
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
                {Object.keys(LARGE_MUSCLE_GROUPS).map((key) => (
                  <Pressable
                    key={key}
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
                      {LARGE_GROUP_LABELS[key]}
                    </Text>
                  </Pressable>
                ))}
                {Object.values(MUSCLE_GROUPS).map((m) => (
                  <Pressable
                    key={m.id}
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
              setNoteDraft(notes[item.id] ?? '');
              setSelected(item);
            }}
          >
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
              {item.id.startsWith('custom_') && (
                <View style={[styles.customBadge, { backgroundColor: colors.border }]}>
                  <Text style={[styles.customBadgeText, { color: colors.textSecondary }]}>
                    Custom
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {item.muscles.map((id) => MUSCLE_GROUPS[id].name).join(' · ')}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {item.equipment.join(', ')}
            </Text>
          </Pressable>
        )}
      />
      <Modal
        visible={selected !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (selected) void setNote(selected.id, noteDraft);
          setSelected(null);
        }}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => {
            if (selected) void setNote(selected.id, noteDraft);
            setSelected(null);
          }}
        >
          <SheetFrame onStartShouldSetResponder={() => true}>
            {selected && (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selected.name}</Text>
                  <Pressable
                    onPress={() => {
                      void setNote(selected.id, noteDraft);
                      setSelected(null);
                    }}
                  >
                    <Text style={[styles.modalClose, { color: colors.primary }]}>Close</Text>
                  </Pressable>
                </View>
                <MuscleDiagram muscleIds={selected.muscles} showLabels size={0.9} />
                <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Muscles</Text>
                  <Text style={[styles.bodyText, { color: colors.text }]}>
                    {selected.muscles.map((id) => MUSCLE_GROUPS[id].name).join(', ')}
                  </Text>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Equipment</Text>
                  <Text style={[styles.bodyText, { color: colors.text }]}>
                    {selected.equipment.join(', ')}
                  </Text>
                  {selected.instructions && (
                    <>
                      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Instructions</Text>
                      <Text style={[styles.bodyText, { color: colors.text }]}>
                        {selected.instructions}
                      </Text>
                    </>
                  )}
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your notes</Text>
                  <Text style={[styles.noteHint, { color: colors.textMuted }]}>
                    Seat height, lever settings, and other personal adjustments. Synced to your account.
                  </Text>
                  <TextInput
                    style={[
                      styles.noteInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="e.g. seat 4 · lever underneath on 3"
                    placeholderTextColor={colors.textMuted}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    onEndEditing={() => void setNote(selected.id, noteDraft)}
                    multiline
                    textAlignVertical="top"
                  />
                </ScrollView>
              </>
            )}
          </SheetFrame>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg + 4,
  },
  modalTitle: { ...typography.sectionTitle, flex: 1 },
  modalClose: { ...typography.label },
  modalBody: { padding: spacing.lg + 4 },
  sectionLabel: { ...typography.caption, fontFamily: typography.label.fontFamily, marginTop: spacing.lg, marginBottom: spacing.xs },
  bodyText: { ...typography.body },
  noteHint: { ...typography.caption, marginBottom: spacing.sm },
  noteInput: {
    ...typography.body,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
