import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ProgramCard } from '@/components/programs/ProgramCard';
import { NoProgramCard } from '@/components/programs/NoProgramCard';
import { BUILT_IN_PROGRAMS } from '@/data/builtInTemplates';
import { useSettingsStore } from '@/store/settingsStore';
import { orderPrograms } from '@/utils/programs';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';

/** Every built-in program; at most one is in Your workouts (docs/features/templates.md#programs). */
export default function ProgramsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProgramId = useSettingsStore((s) => s.activeProgramId);
  const setActiveProgram = useSettingsStore((s) => s.setActiveProgram);

  return (
    <Screen kind="chrome">
      <ScreenHeader title="Programs" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.caption, styles.intro, { color: colors.textSecondary }]}>
          Follow one program at a time, or none. A program's workouts sit next to your own templates
          on the Workouts tab.
        </Text>
        {orderPrograms(BUILT_IN_PROGRAMS, activeProgramId).map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            active={program.id === activeProgramId}
            onPress={(p) => router.push({ pathname: '/program', params: { id: p.id } })}
          />
        ))}
        <NoProgramCard selected={activeProgramId == null} onSelect={() => void setActiveProgram(null)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { marginBottom: spacing.xs },
});
