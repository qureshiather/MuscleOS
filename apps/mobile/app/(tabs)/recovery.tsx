import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { useRecoveryStore } from '@/store/recoveryStore';
import { MUSCLE_GROUPS } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';

export default function RecoveryScreen() {
  const { colors } = useTheme();
  const load = useRecoveryStore((s) => s.load);
  const activeRecovery = useRecoveryStore((s) => s.activeRecovery);
  const isLoading = useRecoveryStore((s) => s.isLoading);

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
          Avoid training these muscles until recovered
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      ) : active.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
            No muscles in recovery. Complete a workout to see recovery status.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.diagramWrap}>
            <MuscleDiagram muscleIds={muscleIds} showLabels size={0.85} />
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
  scroll: { padding: 20, paddingBottom: 40 },
  diagramWrap: { alignItems: 'center', marginBottom: 24 },
  listCard: { padding: 16, borderRadius: 16 },
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  muscleName: { fontSize: 16 },
  recoveryUntil: { fontSize: 13 },
});
