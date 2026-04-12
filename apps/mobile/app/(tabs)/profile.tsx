import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { kgToDisplay, displayToKg, cmToDisplay, displayToCm } from '@/utils/weightUnits';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const bodyWeightUnit = useSettingsStore((s) => s.bodyWeightUnit);
  const heightUnit = useSettingsStore((s) => s.heightUnit);
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const isLinked = !useAuthStore((s) => s.isAnonymous);
  const authProfile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const loadSubscription = useSubscriptionStore((s) => s.load);

  async function handleSignOut() {
    Alert.alert(
      'Sign out',
      'You will stay on this device as a guest. Your subscription stays on your account and can be restored on another device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            loadSubscription();
          },
        },
      ]
    );
  }

  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [sexSelection, setSexSelection] = useState<'male' | 'female' | null>(null);

  useEffect(() => {
    const { profile: p, bodyWeightUnit: bwu, heightUnit: hu } = useSettingsStore.getState();
    if (p.heightCm != null) setHeightInput(String(cmToDisplay(p.heightCm, hu)));
    else setHeightInput('');
    if (p.weightKg != null) setWeightInput(String(kgToDisplay(p.weightKg, bwu)));
    else setWeightInput('');
    if (p.age != null) setAgeInput(String(p.age));
    else setAgeInput('');
  }, [profile.heightCm, profile.weightKg, profile.age, heightUnit, bodyWeightUnit]);

  function openProfileModal() {
    const { profile: p, bodyWeightUnit: bwu, heightUnit: hu } = useSettingsStore.getState();
    if (p.heightCm != null) setHeightInput(String(cmToDisplay(p.heightCm, hu)));
    else setHeightInput('');
    if (p.weightKg != null) setWeightInput(String(kgToDisplay(p.weightKg, bwu)));
    else setWeightInput('');
    if (p.age != null) setAgeInput(String(p.age));
    else setAgeInput('');
    setSexSelection(p.sex ?? null);
    setProfileModalVisible(true);
  }

  function saveProfileFromModal() {
    const h = parseFloat(heightInput);
    const w = parseFloat(weightInput);
    const a = parseInt(ageInput, 10);
    const next: typeof profile = { ...profile };
    if (!Number.isNaN(h) && h > 0) next.heightCm = displayToCm(h, heightUnit);
    else delete next.heightCm;
    if (!Number.isNaN(w) && w > 0) next.weightKg = displayToKg(w, bodyWeightUnit);
    else delete next.weightKg;
    if (!Number.isNaN(a) && a > 0 && a < 150) next.age = a;
    else delete next.age;
    next.sex = sexSelection ?? profile.sex;
    if (next.sex == null) delete next.sex;
    setProfile(next);
    setProfileModalVisible(false);
  }

  const heightPlaceholder = heightUnit === 'in' ? 'Height (in)' : 'Height (cm)';
  const weightPlaceholder = bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)';

  const heightDisplay = profile.heightCm != null ? `${cmToDisplay(profile.heightCm, heightUnit)} ${heightUnit === 'in' ? 'in' : 'cm'}` : '—';
  const weightDisplay =
    profile.weightKg != null ? `${kgToDisplay(profile.weightKg, bodyWeightUnit)} ${bodyWeightUnit}` : '—';
  const ageDisplay = profile.age != null ? String(profile.age) : '—';
  const sexDisplay = profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : '—';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Account, biodata & subscription
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          {isLinked ? (
            <>
              <View style={styles.accountInfo}>
                {authProfile?.displayName ? (
                  <Text style={[styles.accountName, { color: colors.text }]}>{authProfile.displayName}</Text>
                ) : null}
                <Text style={[styles.accountEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {authProfile?.email ?? 'Account linked'}
                </Text>
              </View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                Your subscription is tied to this account and restores on other devices.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.accountSignOutBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleSignOut}
              >
                <Text style={[styles.accountSignOutText, { color: colors.text }]}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                Sign in to subscribe and restore your purchase on other devices.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.accountSignInBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.accountSignInText}>Sign in</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.profileSectionHeader}>
            <View style={styles.profileSectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Biodata</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                Height, weight, age & gender (used for recovery estimates)
              </Text>
            </View>
            <Pressable
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={openProfileModal}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.readOnlyRow}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>{heightUnit === 'in' ? 'Height (in)' : 'Height (cm)'}</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{heightDisplay}</Text>
          </View>
          <View style={styles.readOnlyRow}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>
              {bodyWeightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)'}
            </Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{weightDisplay}</Text>
          </View>
          <View style={styles.readOnlyRow}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>Age</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{ageDisplay}</Text>
          </View>
          <View style={[styles.readOnlyRow, styles.readOnlyRowLast]}>
            <Text style={[styles.readOnlyLabel, { color: colors.textMuted }]}>Gender</Text>
            <Text style={[styles.readOnlyValue, { color: colors.text }]}>{sexDisplay}</Text>
          </View>
        </View>

        <Modal
          visible={profileModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setProfileModalVisible(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit biodata</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted, marginBottom: 12 }]}>Height, weight, age & gender</Text>
              <Text style={[styles.unitLabel, { color: colors.textMuted }]}>Gender</Text>
              <View style={[styles.themeRow, { marginBottom: 12 }]}>
                <Pressable
                  style={[
                    styles.themeBtn,
                    (sexSelection ?? profile.sex) === 'male'
                      ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                      : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
                  ]}
                  onPress={() => setSexSelection('male')}
                >
                  <Text style={[styles.themeBtnText, { color: (sexSelection ?? profile.sex) === 'male' ? '#fff' : colors.text }]}>Male</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.themeBtn,
                    (sexSelection ?? profile.sex) === 'female'
                      ? { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.primary }
                      : { backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.border },
                  ]}
                  onPress={() => setSexSelection('female')}
                >
                  <Text style={[styles.themeBtnText, { color: (sexSelection ?? profile.sex) === 'female' ? '#fff' : colors.text }]}>Female</Text>
                </Pressable>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder={heightPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={heightInput}
                  onChangeText={setHeightInput}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder={weightPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                />
              </View>
              <TextInput
                style={[styles.inputFull, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Age"
                placeholderTextColor={colors.textMuted}
                value={ageInput}
                onChangeText={setAgeInput}
                keyboardType="number-pad"
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]}
                  onPress={() => setProfileModalVisible(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSave, { backgroundColor: colors.primary }]}
                  onPress={saveProfileFromModal}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/subscription')}
        >
          <Text style={[styles.rowText, { color: colors.text }]}>Subscription</Text>
          <Text style={[styles.rowHint, { color: colors.textMuted }]}>Pro features</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/settings')}
        >
          <Text style={[styles.rowText, { color: colors.text }]}>Settings</Text>
          <Text style={[styles.rowHint, { color: colors.textMuted }]}>Appearance, units, data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  section: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionHint: { fontSize: 13, marginBottom: 12 },
  accountInfo: { marginBottom: 8 },
  accountName: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  accountEmail: { fontSize: 15 },
  accountSignOutBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  accountSignOutText: { fontSize: 16, fontWeight: '600' },
  accountSignInBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  accountSignInText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  profileSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  profileSectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  editBtn: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  readOnlyLabel: { fontSize: 15 },
  readOnlyValue: { fontSize: 16, fontWeight: '500' },
  readOnlyRowLast: { borderBottomWidth: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnSave: {},
  modalBtnText: { fontSize: 16, fontWeight: '600' },
  unitLabel: { fontSize: 14, marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
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
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
  },
  rowText: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 76,
    alignItems: 'center' as const,
  },
  themeBtnText: { fontSize: 14, fontWeight: '600' },
});
