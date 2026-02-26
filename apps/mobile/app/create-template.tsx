import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import type { WorkoutTemplate, WorkoutDay } from '@muscleos/types';

export default function CreateTemplateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const [name, setName] = useState('');
  const [dayName, setDayName] = useState('');
  const [exerciseIdsStr, setExerciseIdsStr] = useState('');

  function handleSave() {
    const ids = exerciseIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || !dayName.trim() || ids.length === 0) return;
    const day: WorkoutDay = {
      id: 'day_' + Date.now(),
      name: dayName.trim(),
      exerciseIds: ids,
    };
    const template: WorkoutTemplate = {
      id: 'tpl_' + Date.now(),
      name: name.trim(),
      days: [day],
      isBuiltIn: false,
    };
    addTemplate(template);
    router.back();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Create template</Text>
      </View>
      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Template name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. My Push Day"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Day name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. Push"
          placeholderTextColor={colors.textMuted}
          value={dayName}
          onChangeText={setDayName}
        />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Exercise IDs (comma-separated)</Text>
        <TextInput
          style={[styles.input, styles.inputMulti, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. bench-press, overhead-press, tricep-pushdown"
          placeholderTextColor={colors.textMuted}
          value={exerciseIdsStr}
          onChangeText={setExerciseIdsStr}
          multiline
        />
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={!name.trim() || !dayName.trim() || !exerciseIdsStr.trim()}
        >
          <Text style={styles.saveBtnText}>Save template</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  backText: { fontSize: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  form: { padding: 20 },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { padding: 16, borderRadius: 12, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
