import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import {
  useHealthStore,
  computeBMR,
  computeTDEE,
  computeMacros,
  type ActivityLevel,
  type MacroGoal,
} from '@/store/healthStore';
import { useSettingsStore } from '@/store/settingsStore';
import { kgToDisplay, displayToKg } from '@/utils/weightUnits';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very active',
};

const GOAL_LABELS: Record<MacroGoal, string> = {
  maintain: 'Maintain',
  lose: 'Lose weight',
  gain: 'Gain muscle',
};

export default function HealthScreen() {
  const { colors } = useTheme();
  const load = useHealthStore((s) => s.load);
  const macroTargets = useHealthStore((s) => s.macroTargets);
  const metabolism = useHealthStore((s) => s.metabolism);
  const setMacroTargets = useHealthStore((s) => s.setMacroTargets);
  const setMetabolism = useHealthStore((s) => s.setMetabolism);
  const isLoading = useHealthStore((s) => s.isLoading);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const weightPlaceholder = weightUnit === 'lb' ? 'Weight lb' : 'Weight kg';

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<MacroGoal>('maintain');
  const [bmrResult, setBmrResult] = useState<number | null>(null);
  const [tdeeResult, setTdeeResult] = useState<number | null>(null);

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
      setWeight(metabolism.weightKg !== undefined ? String(kgToDisplay(metabolism.weightKg, weightUnit)) : '');
      setAge(metabolism.age !== undefined ? String(metabolism.age) : '');
      setSex(metabolism.sex === 'female' ? 'female' : 'male');
      setBmrResult(metabolism.bmrKcal ?? null);
      setTdeeResult(metabolism.tdeeKcal ?? null);
    }
  }, [macroTargets, metabolism, weightUnit]);

  function handleComputeBMR() {
    const h = parseFloat(height);
    const weightDisplay = parseFloat(weight);
    const a = parseInt(age, 10);
    const w = Number.isNaN(weightDisplay) ? NaN : displayToKg(weightDisplay, weightUnit);
    if (!Number.isNaN(h) && !Number.isNaN(w) && !Number.isNaN(a)) {
      const bmr = computeBMR(w, h, a, sex);
      setBmrResult(bmr);
      const tdee = computeTDEE(bmr, activity);
      setTdeeResult(tdee);
      setMetabolism({
        heightCm: h,
        weightKg: w,
        age: a,
        sex,
        bmrKcal: bmr,
        tdeeKcal: tdee,
      });
    }
  }

  function handleCalculateMacros() {
    const weightDisplay = parseFloat(weight);
    const w = Number.isNaN(weightDisplay) ? 0 : displayToKg(weightDisplay, weightUnit);
    if (w <= 0) return;
    const bmr = bmrResult ?? (() => {
      const h = parseFloat(height);
      const a = parseInt(age, 10);
      if (Number.isNaN(h) || Number.isNaN(a)) return null;
      return computeBMR(w, h, a, sex);
    })();
    if (bmr == null) return;
    const tdee = computeTDEE(bmr, activity);
    setTdeeResult(tdee);
    const macros = computeMacros(tdee, goal, w);
    setCalories(String(macros.caloriesKcal));
    setProtein(String(macros.proteinG));
    setCarbs(String(macros.carbsG));
    setFat(String(macros.fatG));
    setMacroTargets(macros);
  }

  function handleSaveMacros() {
    const c = parseInt(calories, 10);
    const p = parseInt(protein, 10);
    const cr = parseInt(carbs, 10);
    const f = parseInt(fat, 10);
    if (!Number.isNaN(c) && !Number.isNaN(p) && !Number.isNaN(cr) && !Number.isNaN(f)) {
      setMacroTargets({ caloriesKcal: c, proteinG: p, carbsG: cr, fatG: f });
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
          Enter your info → we figure out macros; you can adjust
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your info (BMR / TDEE)</Text>
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
              placeholder={weightPlaceholder}
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Activity level</Text>
          <View style={styles.wrapRow}>
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
              <Pressable
                key={a}
                style={[styles.chip, activity === a && { backgroundColor: colors.primary }]}
                onPress={() => setActivity(a)}
              >
                <Text style={[styles.chipText, { color: activity === a ? '#fff' : colors.textSecondary }]}>
                  {ACTIVITY_LABELS[a]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleComputeBMR}>
            <Text style={styles.primaryBtnText}>Compute BMR / TDEE</Text>
          </Pressable>
          {bmrResult !== null && (
            <Text style={[styles.result, { color: colors.text }]}>
              BMR: {Math.round(bmrResult)} kcal · TDEE: {tdeeResult != null ? Math.round(tdeeResult) : '—'} kcal
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Macro targets</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            We calculate from your info; you can edit any value after.
          </Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Goal</Text>
          <View style={styles.wrapRow}>
            {(Object.keys(GOAL_LABELS) as MacroGoal[]).map((g) => (
              <Pressable
                key={g}
                style={[styles.chip, goal === g && { backgroundColor: colors.primary }]}
                onPress={() => setGoal(g)}
              >
                <Text style={[styles.chipText, { color: goal === g ? '#fff' : colors.textSecondary }]}>
                  {GOAL_LABELS[g]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={handleCalculateMacros}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Calculate macro targets</Text>
          </Pressable>
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
  hint: { fontSize: 13, marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  chipText: { fontSize: 13, fontWeight: '500' },
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
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  sexBtnText: { fontSize: 14, fontWeight: '600' },
  primaryBtn: { padding: 14, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryBtn: { padding: 12, borderRadius: 12, marginBottom: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  result: { marginTop: 12, fontSize: 16 },
});
