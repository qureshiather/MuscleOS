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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { EXERCISES, getExercise } from '@/data/exercises';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { Exercise } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';

export default function ExercisesScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    let list = EXERCISES;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscles.some((m) => MUSCLE_GROUPS[m].name.toLowerCase().includes(q)) ||
          e.equipment.some((eq) => eq.toLowerCase().includes(q))
      );
    }
    if (muscleFilter) {
      list = list.filter((e) => e.muscles.includes(muscleFilter as any));
    }
    return list;
  }, [search, muscleFilter]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Exercise catalog</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {EXERCISES.length} exercises · tap for muscles
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
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
          >
            All
          </Text>
        </Pressable>
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
            >
              {m.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
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
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  chips: { maxHeight: 44, marginBottom: 8 },
  chipsContent: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  listContent: { padding: 20, paddingBottom: 40 },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
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
