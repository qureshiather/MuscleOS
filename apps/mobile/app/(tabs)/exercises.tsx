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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { useExercisesStore } from '@/store/exercisesStore';
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
  const getAllExercises = useExercisesStore((s) => s.getAllExercises);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EquipmentTypeKey | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Exercise catalog</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {allExercises.length} exercises · tap for muscles
        </Text>
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
                      { color: typeFilter === null ? '#fff' : colors.textSecondary },
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
                        { color: typeFilter === key ? '#fff' : colors.textSecondary },
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
                      { color: muscleFilter === null ? '#fff' : colors.textSecondary },
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
                        { color: muscleFilter === key ? '#fff' : colors.textSecondary },
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
                        { color: muscleFilter === m.id ? '#fff' : colors.textSecondary },
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
              { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => setSelected(item)}
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
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selected.name}</Text>
                  <Pressable onPress={() => setSelected(null)}>
                    <Text style={[styles.modalClose, { color: colors.primary }]}>Close</Text>
                  </Pressable>
                </View>
                <MuscleDiagram muscleIds={selected.muscles} showLabels size={0.9} />
                <ScrollView style={styles.modalBody}>
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
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  search: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  filterWrapper: { marginHorizontal: 20, marginBottom: 16 },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
  },
  filterToggleTitle: { fontSize: 16, fontWeight: '600' },
  filterSummaryInline: { fontSize: 14, flex: 1, textAlign: 'right' },
  filterExpandedContent: { paddingTop: 16 },
  filterSection: { marginBottom: 20 },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  chipsScroll: { flexGrow: 0 },
  chipsContent: {
    paddingHorizontal: 20,
    paddingRight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    flexShrink: 0,
  },
  chipText: { fontSize: 15, fontWeight: '500' },
  listHeader: { paddingHorizontal: 20, marginBottom: 8 },
  listCount: { fontSize: 13 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 17, fontWeight: '600', flex: 1 },
  customBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  customBadgeText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { fontSize: 13, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', flex: 1 },
  modalClose: { fontSize: 16 },
  modalBody: { padding: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 4 },
  bodyText: { fontSize: 15 },
});
