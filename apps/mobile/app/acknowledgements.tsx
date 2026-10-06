import { Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { type Acknowledgement, FONT_ACKNOWLEDGEMENTS, PACKAGE_ACKNOWLEDGEMENTS } from '@/data/acknowledgements';
import { MIT_LICENSE_TEXT, OFL_LICENSE_TEXT } from '@/data/licenseTexts';

export default function AcknowledgementsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const renderGroup = (title: string, entries: readonly Acknowledgement[], licenseText: readonly string[]) => (
    <Card style={styles.section}>
      <Text style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
      {entries.map((a) => (
        <Text key={a.name} style={styles.entry}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>{a.name}</Text>
          {'\n'}
          <Text style={[typography.caption, { color: colors.textMuted }]}>{a.copyright}</Text>
        </Text>
      ))}
      {licenseText.map((p) => (
        <Text key={p} style={[typography.caption, styles.paragraph, { color: colors.textSecondary }]}>
          {p}
        </Text>
      ))}
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader title="Acknowledgements" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[typography.caption, styles.intro, { color: colors.textMuted }]}>
          MuscleOS is built with these open-source libraries and fonts. Thank you to their authors.
        </Text>
        {renderGroup('Libraries — MIT License', PACKAGE_ACKNOWLEDGEMENTS, MIT_LICENSE_TEXT)}
        {renderGroup('Fonts — SIL Open Font License 1.1', FONT_ACKNOWLEDGEMENTS, OFL_LICENSE_TEXT)}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  intro: { marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  entry: { marginTop: spacing.sm },
  paragraph: { marginTop: spacing.md },
});
