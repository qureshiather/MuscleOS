import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { spacing, touch } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { cmToDisplay, kgToDisplay } from '@/utils/weightUnits';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { authProviderLabel, linkedAuthProvider } from '@/auth/accountProvider';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const isLinked = !useAuthStore((s) => s.isAnonymous);
  const authUser = useAuthStore((s) => s.user);
  const authProfile = useAuthStore((s) => s.profile);

  const provider = isLinked && authUser ? linkedAuthProvider(authUser) : null;
  const providerIcon =
    provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'mail-outline';

  const biodataParts = [
    profile.heightCm != null
      ? `${cmToDisplay(profile.heightCm, heightUnit)} ${heightUnit === 'in' ? 'in' : 'cm'}`
      : null,
    profile.weightKg != null ? `${kgToDisplay(profile.weightKg, bodyWeightUnit)} ${bodyWeightUnit}` : null,
    profile.age != null ? String(profile.age) : null,
    profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : null,
    profile.notNatty ? 'Not natty' : null,
  ].filter((part): part is string => part != null);

  return (
    <Screen kind="tab">
      <ScrollView contentContainerStyle={[screenHeaderStyles.scrollContent, styles.scrollExtra]}>
        <View style={screenHeaderStyles.headerInScroll}>
          <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Profile</Text>
          <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
            Account, settings & biodata
          </Text>
        </View>

        <Card style={styles.section}>
          <Pressable
            testID="profile-account"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.accountRow, { opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={styles.accountCopy}>
              <Text style={[typography.sectionTitle, { color: colors.text }]}>Account</Text>
              {isLinked ? (
                <View style={styles.accountIdentity}>
                  {provider ? (
                    <View style={styles.providerRow}>
                      <Ionicons name={providerIcon} size={16} color={colors.textSecondary} />
                      <Text style={[typography.label, { color: colors.textSecondary }]}>
                        {authProviderLabel(provider)}
                      </Text>
                    </View>
                  ) : null}
                  {authProfile?.displayName ? (
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>
                      {authProfile.displayName}
                    </Text>
                  ) : null}
                  <Text style={[typography.body, { color: colors.textSecondary }]} numberOfLines={1}>
                    {authProfile?.email ?? 'Account linked'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[typography.bodyMedium, { color: colors.text, marginTop: spacing.sm }]}>
                    Email, Google, Apple sign in
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    Back up your data and restore Pro on any device.
                  </Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Settings
          </Text>
          <ListRow
            inset
            last
            title="Appearance, units, sounds"
            hint="How the app looks and measures"
            testID="profile-settings"
            onPress={() => router.push('/settings')}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Biodata
          </Text>
          <ListRow
            inset
            last
            title="Height, weight, age, gender"
            hint={biodataParts.length > 0 ? biodataParts.join(' · ') : 'Used for recovery estimates'}
            testID="profile-biodata"
            onPress={() => router.push('/biodata')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollExtra: { paddingBottom: 40 },
  section: { marginBottom: spacing.md },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.min,
  },
  accountCopy: { flex: 1, minWidth: 0, marginRight: spacing.sm },
  accountIdentity: { marginTop: spacing.sm },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
});
