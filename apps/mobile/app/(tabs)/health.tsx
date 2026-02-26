import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useHealthStore, computeBMR } from '@/store/healthStore';

export default function HealthScreen() {
  const { colors } = useTheme();
  const load = useHealthStore((s) => s.load);
  const macroTargets = useHealthStore((s) => s.macroTargets);
  const metabolism = useHealthStore((s) => s.metabolism);
  const setMacroTargets = useHealthStore((s) => s.setMacroTargets);
  const setMetabolism = useHealthStore((s) => s.setMetabolism);
  const isLoading = useHealthStore((s) => s.isLoading);

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [bmrResult, setBmrResult] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (macroTargets) {
      setCalories(String(macroTargets.caloriesKcal));
      setProtein(String(macroTargets.proteinG));
      setCarbs(String(macroTargets.carbsG));
      setFat(String(macroTargets.fatG));
    }
    if (metabolism) {
      setHeight(metabolism.heightCm !== undefined ? String(metabolism.heightCm) : '');
      setWeight(metabolism.weightKg !== undefined ? String(metabolism.weightKg) : '');
      setAge(metabolism.age !== undefined ? String(metabolism.age) : '');
      setSex(metabolism.sex === 'female' ? 'female' : 'male');
      setBmrResult(metabolism.bmrKcal ?? null);
    }
  }, [macroTargets, metabolism]);

  function handleSaveMacros() {
    const c = parseInt(calories, 10);
    const p = parseInt(protein, 10);
    const cr = parseInt(carbs, 10);
    const f = parseInt(fat, 10);
    if (!Number.isNaN(c) && !Number.isNaN(p) && !Number.isNaN(cr) && !Number.isNaN(f)) {
      setMacroTargets({ caloriesKcal: c, proteinG: p, carbsG: cr, fatG: f });
    }
  }

  function handleComputeBMR() {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10);
    if (!Number.isNaN(h) && !Number.isNaN(w) && !Number.isNaN(a)) {
      const bmr = computeBMR(w, h, a, sex);
      setBmrResult(bmr);
      setMetabolism({
        heightCm: h,
        weightKg: w,
        age: a,
        sex,
        bmrKcal: bmr,
      });
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Health</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Metabolism & macro targets (no meal planning)
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Metabolism (BMR)</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Height (cm), weight (kg), age, sex → BMR estimate
          </Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Height cm"
              placeholderTextColor={colors.textMuted}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Weight kg"
              placeholderTextColor={colors.textMuted}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Age"
              placeholderTextColor={colors.textMuted}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
            <View style={styles.sexRow}>
              <Pressable
                style={[styles.sexBtn, sex === 'male' && { backgroundColor: colors.primary }]}
                onPress={() => setSex('male')}
              >
                <Text style={[styles.sexBtnText, { color: sex === 'male' ? '#fff' : colors.textSecondary }]}>Male</Text>
              </Pressable>
              <Pressable
                style={[styles.sexBtn, sex === 'female' && { backgroundColor: colors.primary }]}
                onPress={() => setSex('female')}
              >
                <Text style={[styles.sexBtnText, { color: sex === 'female' ? '#fff' : colors.textSecondary }]}>Female</Text>
              </Pressable>
            </View>
          </View>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleComputeBMR}>
            <Text style={styles.primaryBtnText}>Compute BMR</Text>
          </Pressable>
          {bmrResult !== null && (
            <Text style={[styles.result, { color: colors.text }]}>
              BMR: {Math.round(bmrResult)} kcal/day
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Macro targets</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Daily calories and protein / carbs / fat (grams)
          </Text>
          <TextInput
            style={[styles.inputFull, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Calories (kcal)"
            placeholderTextColor={colors.textMuted}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Protein g"
              placeholderTextColor={colors.textMuted}
              value={protein}
              onChangeText={setProtein}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Carbs g"
              placeholderTextColor={colors.textMuted}
              value={carbs}
              onChangeText={setCarbs}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Fat g"
              placeholderTextColor={colors.textMuted}
              value={fat}
              onChangeText={setFat}
              keyboardType="number-pad"
            />
          </View>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSaveMacros}>
            <Text style={styles.primaryBtnText}>Save targets</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  scroll: { padding: 20, paddingBottom: 40 },
  placeholder: { flex: 1, justifyContent: 'center', padding: 20 },
  placeholderText: { fontSize: 15, textAlign: 'center' },
  card: { padding: 20, borderRadius: 16, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 12, color: '#71717a' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  inputFull: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  sexRow: { flexDirection: 'row', gap: 8 },
  sexBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2a2a2e',
  },
  sexBtnText: { fontSize: 14, fontWeight: '600' },
  primaryBtn: { padding: 14, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  result: { marginTop: 12, fontSize: 16 },
});
