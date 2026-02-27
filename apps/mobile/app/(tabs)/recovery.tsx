import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useHealthStore } from '@/store/healthStore';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';

const ALL_MUSCLE_IDS: MuscleId[] = Object.keys(MUSCLE_GROUPS) as MuscleId[];

export default function RecoveryScreen() {
  const { colors } = useTheme();
  const load = useRecoveryStore((s) => s.load);
  const activeRecovery = useRecoveryStore((s) => s.activeRecovery);
  const isLoading = useRecoveryStore((s) => s.isLoading);
  const metabolism = useHealthStore((s) => s.metabolism);
  const diagramVariant = metabolism?.sex === 'female' ? 'female' : 'male';

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const active = activeRecovery();
  const muscleIds = [...new Set(active.map((r) => r.muscleId))];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Recovery</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {active.length === 0
            ? 'All muscles ready – you can work out any muscle'
            : 'Avoid training these muscles until recovered'}
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      ) : active.length === 0 ? (
        <View style={styles.readyWrap}>
          <MuscleDiagram
            muscleIds={ALL_MUSCLE_IDS}
            variant={diagramVariant}
            highlightColor="green"
            size={0.9}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.diagramWrap}>
            <MuscleDiagram muscleIds={muscleIds} variant={diagramVariant} showLabels size={0.85} />
          </View>
          <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.listTitle, { color: colors.text }]}>In recovery</Text>
            {active.map((r, i) => (
              <View key={`${r.muscleId}-${r.trainedAt}-${i}`} style={styles.listRow}>
                <Text style={[styles.muscleName, { color: colors.text }]}>
                  {MUSCLE_GROUPS[r.muscleId].name}
                </Text>
                <Text style={[styles.recoveryUntil, { color: colors.textMuted }]}>
                  Until {new Date(r.recoveryUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  placeholder: { flex: 1, padding: 20, justifyContent: 'center' },
  placeholderText: { fontSize: 15, textAlign: 'center' },
  readyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scroll: { padding: 20, paddingBottom: 40 },
  diagramWrap: { alignItems: 'center', marginBottom: 24 },
  listCard: { padding: 16, borderRadius: 16 },
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  muscleName: { fontSize: 16 },
  recoveryUntil: { fontSize: 13 },
});
