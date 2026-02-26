import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';

export default function WorkoutsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Workouts</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose a template or start a session
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/templates')}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Templates</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Push/Pull/Legs, Upper/Lower, Strong Lifts, Arnold & custom
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/active-workout')}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Start workout</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Quick start or pick a planned workout
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardDesc: { fontSize: 14, marginTop: 4 },
});
