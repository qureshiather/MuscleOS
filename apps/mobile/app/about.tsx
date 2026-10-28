import { Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatAppVersion } from '@/utils/appVersion';
import { LEGAL_URLS } from '@/utils/legalUrls';

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const version = formatAppVersion(Application.nativeApplicationVersion, Application.nativeBuildVersion);

  function openLegal(page: keyof typeof LEGAL_URLS) {
    void WebBrowser.openBrowserAsync(LEGAL_URLS[page]);
  }

  return (
    <Screen>
      <ScreenHeader title="About" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>MuscleOS</Text>
          <Text style={[typography.data, styles.version, { color: colors.textSecondary }]} testID="about-version">
            Version {version}
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>Legal</Text>
          <ListRow
            inset
            title="Privacy Policy"
            hint="How we handle your data"
            testID="about-privacy"
            onPress={() => openLegal('privacy')}
          />
          <ListRow
            inset
            last
            title="Terms of Service"
            hint="Using MuscleOS"
            testID="about-terms"
            onPress={() => openLegal('terms')}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>Credits</Text>
          <ListRow
            inset
            last
            title="Acknowledgements"
            hint="Open-source licenses and artwork"
            testID="about-acknowledgements"
            onPress={() => router.push('/acknowledgements')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  version: { marginTop: spacing.xs },
});
