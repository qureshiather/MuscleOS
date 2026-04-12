import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { useTemplatesStore } from '@/store/templatesStore';
import { BUILT_IN_FOLDERS } from '@/data/builtInTemplates';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { formatRelative } from '@/utils/relativeTime';
import type { WorkoutTemplate, TemplateFolder, WorkoutSession } from '@muscleos/types';

const UNCATEGORIZED = '_uncategorized';
const ARCHIVED_SECTION = '_archived';

export default function WorkoutsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const loadTemplates = useTemplatesStore((s) => s.load);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const userTemplates = useTemplatesStore((s) => s.userTemplates);
  const folders = useTemplatesStore((s) => s.folders);
  const addFolder = useTemplatesStore((s) => s.addFolder);
  const updateFolder = useTemplatesStore((s) => s.updateFolder);
  const deleteFolder = useTemplatesStore((s) => s.deleteFolder);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const deleteTemplate = useTemplatesStore((s) => s.deleteTemplate);
  const isLoading = useTemplatesStore((s) => s.isLoading);
  const loadSessions = useSessionsStore((s) => s.load);
  const sessions = useSessionsStore((s) => s.sessions);
  const completedSessions = useSessionsStore((s) => s.completedSessions);
  const subscriptionState = useSubscriptionStore((s) => s.state);
  const isPro =
    subscriptionState?.tier === 'pro' &&
    (!subscriptionState?.expiresAt || new Date(subscriptionState.expiresAt) > new Date());
  const activeSession = useActiveWorkoutStore((s) => s.session);

  const [builtInExpanded, setBuiltInExpanded] = useState(false);
  const [customExpanded, setCustomExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [folderExpanded, setFolderExpanded] = useState<Record<string, boolean>>({});
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<TemplateFolder | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState<WorkoutTemplate | null>(null);
  const [editingTemplateNewName, setEditingTemplateNewName] = useState('');
  const [moveTemplateModal, setMoveTemplateModal] = useState<WorkoutTemplate | null>(null);
  const [showCreateFolderInMoveModal, setShowCreateFolderInMoveModal] = useState(false);
  const [moveModalNewFolderName, setMoveModalNewFolderName] = useState('');
  const [templateMenuTarget, setTemplateMenuTarget] = useState<WorkoutTemplate | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [folderDropdownLayout, setFolderDropdownLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const folderDropdownRef = useRef<View>(null);

  useEffect(() => {
    if (folderMenuId === null) setFolderDropdownLayout(null);
  }, [folderMenuId]);

  useEffect(() => {
    if (moveTemplateModal) {
      setShowCreateFolderInMoveModal(false);
      setMoveModalNewFolderName('');
    }
  }, [moveTemplateModal]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const templates = allTemplates();
  const { builtIn, custom } = useMemo(() => {
    const builtIn: WorkoutTemplate[] = [];
    const custom: WorkoutTemplate[] = [];
    templates.forEach((t) => (t.isBuiltIn ? builtIn.push(t) : custom.push(t)));
    return { builtIn, custom };
  }, [templates]);

  const { byFolder, uncategorized } = useMemo(() => {
    const byFolder: Record<string, WorkoutTemplate[]> = {};
    folders.forEach((f) => {
      byFolder[f.id] = custom.filter((t) => t.folderId === f.id);
    });
    const uncategorized = custom.filter((t) => !t.folderId);
    return { byFolder, uncategorized };
  }, [custom, folders]);

  const { favoriteFolders, normalFolders, archivedFolders } = useMemo(() => {
    const favorite: TemplateFolder[] = [];
    const normal: TemplateFolder[] = [];
    const archived: TemplateFolder[] = [];
    folders.forEach((f) => {
      if (f.archived) archived.push(f);
      else if (f.favorite) favorite.push(f);
      else normal.push(f);
    });
    return { favoriteFolders: favorite, normalFolders: normal, archivedFolders: archived };
  }, [folders]);

  const builtInByFolder = useMemo(() => {
    const byFolder: Record<string, WorkoutTemplate[]> = {};
    BUILT_IN_FOLDERS.forEach((f) => {
      byFolder[f.id] = builtIn.filter((t) => t.folderId === f.id);
    });
    return byFolder;
  }, [builtIn]);

  const builtInUncategorized = useMemo(
    () => builtIn.filter((t) => !t.folderId),
    [builtIn]
  );

  const recentWorkouts = useMemo(() => {
    const completed = completedSessions();
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    return completed
      .filter((s) => templateMap.has(s.templateId))
      .slice(0, 5)
      .map((s) => ({
        session: s,
        template: templateMap.get(s.templateId)!,
      }));
  }, [sessions, templates]);

  const lastDoneByTemplate = useMemo(() => {
    const completed = sessions.filter((s) => s.completedAt != null);
    const map: Record<string, string> = {};
    for (const s of completed) {
      const completedAt = s.completedAt!;
      if (!map[s.templateId] || completedAt > map[s.templateId]) {
        map[s.templateId] = completedAt;
      }
    }
    return map;
  }, [sessions]);

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    addFolder({ id: 'folder_' + Date.now(), name });
    setNewFolderName('');
    setShowFolderModal(false);
  }

  function handleSaveFolderRename() {
    if (!editingFolder || !editingFolderName.trim()) return;
    updateFolder(editingFolder.id, { name: editingFolderName.trim() });
    setEditingFolder(null);
    setEditingFolderName('');
  }

  function handleSaveTemplateRename() {
    if (!editingTemplateName || !editingTemplateNewName.trim()) return;
    updateTemplate(editingTemplateName.id, { name: editingTemplateNewName.trim() });
    setEditingTemplateName(null);
    setEditingTemplateNewName('');
  }

  function handleDeleteFolder(folder: TemplateFolder) {
    const templatesInFolder = byFolder[folder.id] ?? [];
    const templateCount = templatesInFolder.length;
    if (templateCount === 0) {
      Alert.alert(
        'Delete folder',
        `Delete "${folder.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(folder.id) },
        ]
      );
    } else {
      Alert.alert(
        'Delete folder',
        `"${folder.name}" has ${templateCount} template${templateCount === 1 ? '' : 's'}. Move them to Uncategorized or delete them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Move to Uncategorized',
            onPress: () => deleteFolder(folder.id),
          },
          {
            text: 'Delete folder and templates',
            style: 'destructive',
            onPress: async () => {
              for (const t of templatesInFolder) {
                await deleteTemplate(t.id);
              }
              await deleteFolder(folder.id);
            },
          },
        ]
      );
    }
  }

  function handleMoveTemplate(template: WorkoutTemplate, folderId: string | undefined) {
    updateTemplate(template.id, { folderId });
    setMoveTemplateModal(null);
    setShowCreateFolderInMoveModal(false);
    setMoveModalNewFolderName('');
  }

  function handleCreateFolderAndMove() {
    const name = moveModalNewFolderName.trim();
    if (!name || !moveTemplateModal) return;
    const id = 'folder_' + Date.now();
    addFolder({ id, name });
    handleMoveTemplate(moveTemplateModal, id);
  }

  function getTemplateDisplayName(template: WorkoutTemplate): string {
    return template.name;
  }

  function getLastDone(template: WorkoutTemplate): string | null {
    const last = lastDoneByTemplate[template.id];
    return last ? formatRelative(last) : null;
  }

  function renderRecentWorkoutCard(
    session: WorkoutSession,
    template: WorkoutTemplate,
    cardStyle: StyleProp<ViewStyle>
  ) {
    const completedAgo = session.completedAt ? formatRelative(session.completedAt) : null;
    return (
      <Pressable
        key={session.id}
        style={({ pressed }) => [cardStyle, pressed && styles.templateCardPressed]}
        onPress={() => handleStartTemplate(template)}
      >
        <View style={styles.templateCardHeader}>
          <View style={styles.templateCardTitleRow}>
            <Text
              style={[styles.templateName, { color: colors.accent }]}
              numberOfLines={1}
            >
              {template.name}
            </Text>
          </View>
          {completedAgo && (
            <Text style={[styles.lastDoneText, { color: colors.textMuted }]}>
              Done {completedAgo}
            </Text>
          )}
          <Text style={[styles.exerciseCount, { color: colors.textMuted }]}>
            {template.exerciseIds.length} exercises
          </Text>
        </View>
      </Pressable>
    );
  }

  function isFolderExpanded(folderId: string): boolean {
    return folderExpanded[folderId] ?? true;
  }

  function toggleFolderExpanded(folderId: string) {
    setFolderExpanded((prev) => ({ ...prev, [folderId]: !(prev[folderId] ?? true) }));
  }

  function renderTemplateCard(
    template: WorkoutTemplate,
    cardStyle?: StyleProp<ViewStyle>,
    showMoveOption?: boolean
  ) {
    const displayName = getTemplateDisplayName(template);
    const hasDescription = Boolean(template.description?.trim());
    const lastDone = getLastDone(template);
    const resolvedCardStyle = cardStyle ?? [
      styles.templateCard,
      { backgroundColor: colors.surfaceElevated },
    ];
    return (
      <Pressable
        key={template.id}
        style={({ pressed }) => [resolvedCardStyle, pressed && styles.templateCardPressed]}
        onPress={() => handleStartTemplate(template)}
      >
        <View style={styles.templateCardHeader}>
          <View style={styles.templateCardTitleRow}>
            <Text
              style={[
                styles.templateName,
                { color: colors.accent },
                !hasDescription && styles.templateNameNoDesc,
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {showMoveOption && (
              <Pressable
                hitSlop={8}
                style={({ pressed: p }) => [
                  styles.templateMenuBtn,
                  { opacity: p ? 0.7 : 1 },
                ]}
                onPress={() => setTemplateMenuTarget(template)}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
          {hasDescription ? (
            <Text style={[styles.templateDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {template.description}
            </Text>
          ) : null}
          {lastDone && (
            <Text style={[styles.lastDoneText, { color: colors.textMuted }]}>
              Last done: {lastDone}
            </Text>
          )}
          <Text style={[styles.exerciseCount, { color: colors.textMuted }]}>
            {template.exerciseIds.length} exercises
          </Text>
        </View>
      </Pressable>
    );
  }

  function handleStartTemplate(template: WorkoutTemplate) {
    if (activeSession) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting another.',
        [
          { text: 'Resume workout', onPress: () => router.push('/active-workout') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    router.push({
      pathname: '/workout-preview',
      params: {
        templateId: template.id,
        exerciseIds: template.exerciseIds.join(','),
        ...(template.defaultSets != null && { defaultSets: String(template.defaultSets) }),
      },
    });
  }

  function handleStartEmptyWorkout() {
    if (activeSession) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting another.',
        [
          { text: 'Resume workout', onPress: () => router.push('/active-workout') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    router.push({
      pathname: '/active-workout',
      params: {
        templateId: '_empty',
        exerciseIds: '',
      },
    });
  }

  const sectionStyle = [
    styles.collapsibleSection,
    { backgroundColor: colors.surface },
    !isDark && {
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
        },
        android: { elevation: 2 },
      }),
    },
  ];

  const nestedSectionStyle = [
    styles.collapsibleSection,
    styles.nestedSection,
    { backgroundColor: colors.surfaceElevated },
    !isDark && { borderWidth: 1, borderColor: colors.border },
  ];

  const templateCardStyle = [
    styles.templateCard,
    { backgroundColor: colors.surfaceElevated },
    ...(!isDark ? [{ borderWidth: 1, borderColor: colors.border }] : []),
  ];

  function renderFolderDropdown(folder: TemplateFolder) {
    return (
      <View
        ref={folderDropdownRef}
        style={[
          styles.folderDropdown,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
          folderDropdownLayout !== null && { opacity: 0 },
        ]}
        onLayout={() => {
          if (folderMenuId !== folder.id) return;
          folderDropdownRef.current?.measureInWindow((x, y, width, height) => {
            setFolderDropdownLayout({ x, y, width, height });
          });
        }}
        collapsable={false}
      >
        <Pressable
          style={[
            styles.folderDropdownItem,
            styles.folderDropdownItemBorder,
            { borderBottomColor: colors.border },
          ]}
          onPress={() => {
            setEditingFolder(folder);
            setEditingFolderName(folder.name);
            setFolderMenuId(null);
            setFolderDropdownLayout(null);
          }}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.text} />
          <Text style={[styles.folderDropdownItemText, { color: colors.text }]}>Rename</Text>
        </Pressable>
        <Pressable
          style={[
            styles.folderDropdownItem,
            styles.folderDropdownItemBorder,
            { borderBottomColor: colors.border },
          ]}
          onPress={() => {
            setFolderMenuId(null);
            setFolderDropdownLayout(null);
            updateFolder(folder.id, { favorite: !folder.favorite });
          }}
        >
          <Ionicons
            name={folder.favorite ? 'star' : 'star-outline'}
            size={18}
            color={folder.favorite ? colors.accent : colors.text}
          />
          <Text style={[styles.folderDropdownItemText, { color: colors.text }]}>
            {folder.favorite ? 'Unpin from top' : 'Pin to top'}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.folderDropdownItem,
            styles.folderDropdownItemBorder,
            { borderBottomColor: colors.border },
          ]}
          onPress={() => {
            setFolderMenuId(null);
            setFolderDropdownLayout(null);
            updateFolder(folder.id, { archived: !folder.archived });
          }}
        >
          <Ionicons
            name={folder.archived ? 'arrow-undo-outline' : 'archive-outline'}
            size={18}
            color={colors.text}
          />
          <Text style={[styles.folderDropdownItemText, { color: colors.text }]}>
            {folder.archived ? 'Unarchive' : 'Archive'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.folderDropdownItem}
          onPress={() => {
            setFolderMenuId(null);
            setFolderDropdownLayout(null);
            handleDeleteFolder(folder);
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.folderDropdownItemText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  function renderBuiltInFolderSection(folder: TemplateFolder) {
    const templatesInFolder = builtInByFolder[folder.id] ?? [];
    const expanded = isFolderExpanded(folder.id);
    return (
      <View key={folder.id} style={nestedSectionStyle}>
        <Pressable
          style={({ pressed }) => [
            styles.sectionHeader,
            styles.sectionHeaderLeft,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => toggleFolderExpanded(folder.id)}
        >
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={colors.textSecondary}
          />
          <Ionicons name="folder-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{folder.name}</Text>
        </Pressable>
        {expanded && (
          <View style={styles.sectionContent}>
            {templatesInFolder.length === 0 ? null : (
              templatesInFolder.map((template) =>
                renderTemplateCard(template, templateCardStyle)
              )
            )}
          </View>
        )}
      </View>
    );
  }

  function renderFolderSection(folder: TemplateFolder, isArchived?: boolean) {
    const templatesInFolder = byFolder[folder.id] ?? [];
    const expanded = isFolderExpanded(folder.id);
    const mutedStyle = isArchived ? { opacity: 0.7 } : undefined;
    const titleColor = isArchived ? colors.textMuted : colors.text;
    const iconColor = isArchived ? colors.textMuted : colors.primary;
    return (
      <View key={folder.id} style={[nestedSectionStyle, mutedStyle]}>
        <View style={styles.folderSectionHeaderWrap}>
          <View style={styles.sectionHeader}>
            <Pressable
              style={[styles.sectionHeaderLeft, { opacity: 1 }]}
              onPress={() => toggleFolderExpanded(folder.id)}
            >
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.textSecondary}
              />
              <Ionicons name="folder-outline" size={18} color={iconColor} />
              {folder.favorite && !isArchived && (
                <Ionicons name="star" size={14} color={colors.accent} style={styles.folderStar} />
              )}
              <Text style={[styles.sectionTitle, { color: titleColor }]}>{folder.name}</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() =>
                setFolderMenuId((id) => (id === folder.id ? null : folder.id))
              }
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          {folderMenuId === folder.id && renderFolderDropdown(folder)}
        </View>
        {expanded && (
          <View style={styles.sectionContent}>
            {templatesInFolder.length === 0 ? (
              <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                No templates in this folder.
              </Text>
            ) : (
              templatesInFolder.map((template) =>
                renderTemplateCard(template, templateCardStyle, true)
              )
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={screenHeaderStyles.scrollContent}>
        <View style={screenHeaderStyles.headerInScroll}>
          <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Workouts</Text>
          <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
            Start empty or pick a template
          </Text>

          {/* Start Empty Workout - distinctive card-style CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.startEmptyCard,
              {
                backgroundColor: isPro ? colors.primary : colors.surfaceElevated,
                borderColor: isPro ? colors.primary : colors.border,
                opacity: pressed ? 0.92 : 1,
              },
              !isDark && isPro && {
                ...Platform.select({
                  ios: {
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  },
                  android: { elevation: 4 },
                }),
              },
            ]}
            onPress={() =>
              isPro ? handleStartEmptyWorkout() : router.push('/subscription')
            }
          >
            <View style={styles.startEmptyCardInner}>
              <View
                style={[
                  styles.startEmptyIconWrap,
                  { backgroundColor: isPro ? 'rgba(255,255,255,0.2)' : colors.background },
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={28}
                  color={isPro ? '#fff' : colors.primary}
                />
              </View>
              <View style={styles.startEmptyTextWrap}>
                <Text
                  style={[
                    styles.startEmptyCardTitle,
                    { color: isPro ? '#fff' : colors.text },
                  ]}
                >
                  {isPro ? 'Start Empty Workout' : 'Pro: Start Empty Workout'}
                </Text>
                <Text
                  style={[
                    styles.startEmptyCardSubtitle,
                    { color: isPro ? 'rgba(255,255,255,0.85)' : colors.textMuted },
                  ]}
                >
                  {isPro ? 'Add exercises as you go' : 'Upgrade to unlock'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={isPro ? 'rgba(255,255,255,0.8)' : colors.textMuted}
              />
            </View>
          </Pressable>
        </View>

        <View style={styles.templatesSection}>
          <View style={styles.templatesSectionRow}>
            <Text style={[styles.templatesSectionTitle, { color: colors.text }]}>Templates</Text>
            <Pressable
              style={[styles.addBtn, { borderColor: colors.border }]}
              onPress={() => router.push('/create-template')}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>New template</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.placeholder}>
              <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
            </View>
          ) : (
            <>
              {/* Recent workouts section */}
              {recentWorkouts.length > 0 && (
                <View style={sectionStyle}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.sectionHeader,
                      styles.sectionHeaderLeft,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                    onPress={() => setRecentExpanded((e) => !e)}
                  >
                    <Ionicons
                      name={recentExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Recent Workouts
                    </Text>
                  </Pressable>
                  {recentExpanded && (
                    <View style={styles.sectionContent}>
                      {recentWorkouts.map(({ session, template }) =>
                        renderRecentWorkoutCard(session, template, templateCardStyle)
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Custom section with folders */}
              <View style={sectionStyle}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sectionHeader,
                    styles.sectionHeaderLeft,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setCustomExpanded((e) => !e)}
                >
                  <Ionicons
                    name={customExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Custom</Text>
                  <Pressable
                    hitSlop={8}
                    style={({ pressed: p2 }) => [
                      styles.folderAddBtn,
                      { backgroundColor: colors.surfaceElevated, opacity: p2 ? 0.8 : 1 },
                    ]}
                    onPress={() => setShowFolderModal(true)}
                  >
                    <Ionicons name="folder-open-outline" size={16} color={colors.primary} />
                    <Text style={[styles.folderAddBtnText, { color: colors.primary }]}>
                      New folder
                    </Text>
                  </Pressable>
                </Pressable>
                {customExpanded && (
                  <View style={styles.sectionContent}>
                    {favoriteFolders.map((f) => renderFolderSection(f))}
                    {normalFolders.map((f) => renderFolderSection(f))}
                    {uncategorized.length > 0 && (
                      <View style={nestedSectionStyle}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.sectionHeader,
                            styles.sectionHeaderLeft,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                          onPress={() => toggleFolderExpanded(UNCATEGORIZED)}
                        >
                          <Ionicons
                            name={
                              isFolderExpanded(UNCATEGORIZED) ? 'chevron-down' : 'chevron-forward'
                            }
                            size={18}
                            color={colors.textSecondary}
                          />
                          <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            Uncategorized
                          </Text>
                        </Pressable>
                        {isFolderExpanded(UNCATEGORIZED) && (
                          <View style={styles.sectionContent}>
                            {uncategorized.map((template) =>
                              renderTemplateCard(template, templateCardStyle, true)
                            )}
                          </View>
                        )}
                      </View>
                    )}
                    {archivedFolders.length > 0 && (
                      <View style={nestedSectionStyle}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.sectionHeader,
                            styles.sectionHeaderLeft,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                          onPress={() => toggleFolderExpanded(ARCHIVED_SECTION)}
                        >
                          <Ionicons
                            name={
                              isFolderExpanded(ARCHIVED_SECTION) ? 'chevron-down' : 'chevron-forward'
                            }
                            size={18}
                            color={colors.textMuted}
                          />
                          <Ionicons name="archive-outline" size={18} color={colors.textMuted} />
                          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                            Archived
                          </Text>
                        </Pressable>
                        {isFolderExpanded(ARCHIVED_SECTION) && (
                          <View style={styles.sectionContent}>
                            {archivedFolders.map((f) => renderFolderSection(f, true))}
                          </View>
                        )}
                      </View>
                    )}
                    {custom.length === 0 && (
                      <View style={styles.emptySectionRow}>
                        <Text style={[styles.emptySectionText, styles.emptySectionTextInRow, { color: colors.textMuted }]}>
                          No custom templates yet.
                        </Text>
                        <Pressable
                          onPress={() => router.push('/create-template')}
                          hitSlop={8}
                          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                        >
                          <Text style={[styles.emptySectionLink, { color: colors.primary }]}>
                            Create one
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Built-in section */}
              <View style={sectionStyle}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sectionHeader,
                    styles.sectionHeaderLeft,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setBuiltInExpanded((e) => !e)}
                >
                  <Ionicons
                    name={builtInExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Built-in</Text>
                </Pressable>
                {builtInExpanded && (
                  <View style={styles.sectionContent}>
                    {BUILT_IN_FOLDERS.map((f) => renderBuiltInFolderSection(f))}
                    {builtInUncategorized.length > 0 && (
                      <View style={nestedSectionStyle}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.sectionHeader,
                            styles.sectionHeaderLeft,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                          onPress={() => toggleFolderExpanded(UNCATEGORIZED + '_builtin')}
                        >
                          <Ionicons
                            name={
                              isFolderExpanded(UNCATEGORIZED + '_builtin')
                                ? 'chevron-down'
                                : 'chevron-forward'
                            }
                            size={18}
                            color={colors.textSecondary}
                          />
                          <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            Uncategorized
                          </Text>
                        </Pressable>
                        {isFolderExpanded(UNCATEGORIZED + '_builtin') && (
                          <View style={styles.sectionContent}>
                            {builtInUncategorized.map((template) =>
                              renderTemplateCard(template, templateCardStyle)
                            )}
                          </View>
                        )}
                      </View>
                    )}
                    {builtIn.length === 0 && (
                      <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                        No built-in templates
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showFolderModal} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFolderModal(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>New folder</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setShowFolderModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!editingFolder} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditingFolder(null)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Rename folder</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              value={editingFolderName}
              onChangeText={setEditingFolderName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setEditingFolder(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleSaveFolderRename}
                disabled={!editingFolderName.trim()}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Folder dropdown overlay: tap outside to close */}
      {folderDropdownLayout !== null && folderMenuId !== null && (() => {
        const folder = folders.find((f) => f.id === folderMenuId);
        if (!folder) return null;
        return (
          <Modal visible transparent animationType="none">
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  setFolderMenuId(null);
                  setFolderDropdownLayout(null);
                }}
              />
              <View
                style={[
                  styles.folderDropdown,
                  {
                    position: 'absolute',
                    left: folderDropdownLayout!.x,
                    top: folderDropdownLayout!.y,
                    width: folderDropdownLayout!.width,
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onStartShouldSetResponder={() => true}
              >
                <Pressable
                  style={[
                    styles.folderDropdownItem,
                    styles.folderDropdownItemBorder,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    setEditingFolder(folder);
                    setEditingFolderName(folder.name);
                    setFolderMenuId(null);
                    setFolderDropdownLayout(null);
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.text} />
                  <Text style={[styles.folderDropdownItemText, { color: colors.text }]}>
                    Rename
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.folderDropdownItem,
                    styles.folderDropdownItemBorder,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    setFolderMenuId(null);
                    setFolderDropdownLayout(null);
                    updateFolder(folder.id, { favorite: !folder.favorite });
                  }}
                >
                  <Ionicons
                    name={folder.favorite ? 'star' : 'star-outline'}
                    size={18}
                    color={folder.favorite ? colors.accent : colors.text}
                  />
                  <Text style={[styles.folderDropdownItemText, { color: colors.text }]}>
                    {folder.favorite ? 'Unpin from top' : 'Pin to top'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.folderDropdownItem,
                    styles.folderDropdownItemBorder,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    setFolderMenuId(null);
                    setFolderDropdownLayout(null);
                    updateFolder(folder.id, { archived: !folder.archived });
                  }}
                >
                  <Ionicons
                    name={folder.archived ? 'arrow-undo-outline' : 'archive-outline'}
                    size={18}
                    color={colors.text}
                  />
                  <Text style={[styles.folderDropdownItemText, { color: colors.text }]}>
                    {folder.archived ? 'Unarchive' : 'Archive'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.folderDropdownItem}
                  onPress={() => {
                    setFolderMenuId(null);
                    setFolderDropdownLayout(null);
                    handleDeleteFolder(folder);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.folderDropdownItemText, { color: colors.danger }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        );
      })()}

      <Modal visible={!!templateMenuTarget} animationType="fade" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTemplateMenuTarget(null)}
        >
          <View
            style={[styles.templateMenuContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Pressable
              style={[styles.templateMenuItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                if (templateMenuTarget) {
                  setEditingTemplateName(templateMenuTarget);
                  setEditingTemplateNewName(templateMenuTarget.name);
                }
                setTemplateMenuTarget(null);
              }}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.text} />
              <Text style={[styles.templateMenuItemText, { color: colors.text }]}>Rename</Text>
            </Pressable>
            <Pressable
              style={[styles.templateMenuItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                if (templateMenuTarget) setMoveTemplateModal(templateMenuTarget);
                setTemplateMenuTarget(null);
              }}
            >
              <Ionicons name="arrow-redo-outline" size={18} color={colors.text} />
              <Text style={[styles.templateMenuItemText, { color: colors.text }]}>Move</Text>
            </Pressable>
            <Pressable
              style={styles.templateMenuItem}
              onPress={() => {
                if (templateMenuTarget) {
                  router.push({
                    pathname: '/create-template',
                    params: { templateId: templateMenuTarget.id },
                  });
                }
                setTemplateMenuTarget(null);
              }}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[styles.templateMenuItemText, { color: colors.text }]}>Edit</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!editingTemplateName} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditingTemplateName(null)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Rename template</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Template name"
              placeholderTextColor={colors.textMuted}
              value={editingTemplateNewName}
              onChangeText={setEditingTemplateNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setEditingTemplateName(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleSaveTemplateRename}
                disabled={!editingTemplateNewName.trim()}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!moveTemplateModal} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setMoveTemplateModal(null);
            setShowCreateFolderInMoveModal(false);
            setMoveModalNewFolderName('');
          }}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Move "{moveTemplateModal ? getTemplateDisplayName(moveTemplateModal) : ''}" to
            </Text>
            {showCreateFolderInMoveModal ? (
              <View style={styles.moveModalCreateFolderBlock}>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Folder name"
                  placeholderTextColor={colors.textMuted}
                  value={moveModalNewFolderName}
                  onChangeText={setMoveModalNewFolderName}
                  autoFocus
                />
                <View style={styles.moveModalCreateFolderActions}>
                  <Pressable
                    style={[styles.modalBtn, { borderColor: colors.border }]}
                    onPress={() => {
                      setShowCreateFolderInMoveModal(false);
                      setMoveModalNewFolderName('');
                    }}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                    onPress={handleCreateFolderAndMove}
                    disabled={!moveModalNewFolderName.trim()}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create & move</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <ScrollView style={styles.moveFolderList} nestedScrollEnabled>
                  <Pressable
                    style={[styles.moveFolderRow, { borderBottomColor: colors.border }]}
                    onPress={() =>
                      moveTemplateModal && handleMoveTemplate(moveTemplateModal, undefined)
                    }
                  >
                    <Ionicons name="folder-open-outline" size={18} color={colors.textMuted} />
                    <Text style={[styles.moveFolderRowText, { color: colors.text }]}>
                      Uncategorized
                    </Text>
                  </Pressable>
                  {folders
                    .filter((f) => f.id !== moveTemplateModal?.folderId)
                    .map((folder) => (
                      <Pressable
                        key={folder.id}
                        style={[styles.moveFolderRow, { borderBottomColor: colors.border }]}
                        onPress={() =>
                          moveTemplateModal && handleMoveTemplate(moveTemplateModal, folder.id)
                        }
                      >
                        <Ionicons name="folder-outline" size={18} color={colors.primary} />
                        <Text style={[styles.moveFolderRowText, { color: colors.text }]}>
                          {folder.name}
                        </Text>
                      </Pressable>
                    ))}
                  <Pressable
                    style={[styles.moveFolderRow, { borderBottomColor: colors.border }]}
                    onPress={() => setShowCreateFolderInMoveModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.moveFolderRowText, { color: colors.primary }]}>
                      New folder…
                    </Text>
                  </Pressable>
                </ScrollView>
                <Pressable
                  style={[styles.modalBtn, { borderColor: colors.border, alignSelf: 'flex-end', marginTop: 12 }]}
                  onPress={() => {
                    setMoveTemplateModal(null);
                    setShowCreateFolderInMoveModal(false);
                    setMoveModalNewFolderName('');
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  startEmptyCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  startEmptyCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  startEmptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startEmptyTextWrap: { flex: 1 },
  startEmptyCardTitle: { fontSize: 16, fontWeight: '700' },
  startEmptyCardSubtitle: { fontSize: 12, marginTop: 2 },
  templatesSection: { marginTop: 12 },
  templatesSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  templatesSectionTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  folderAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  folderAddBtnText: { fontSize: 13, fontWeight: '600' },
  collapsibleSection: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  nestedSection: {
    marginBottom: 6,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  folderSectionHeaderWrap: {
    position: 'relative',
  },
  folderDropdown: {
    position: 'absolute',
    top: '100%',
    right: 12,
    minWidth: 140,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 5,
  },
  folderDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  folderDropdownItemBorder: {
    borderBottomWidth: 1,
  },
  folderDropdownItemText: { fontSize: 15 },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  folderStar: { marginRight: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  sectionContent: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 0, gap: 6 },
  emptySectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptySectionText: { fontSize: 14, paddingVertical: 12, paddingHorizontal: 4 },
  emptySectionTextInRow: { paddingVertical: 0, paddingHorizontal: 0 },
  emptySectionLink: { fontSize: 14, fontWeight: '600' },
  placeholder: { paddingVertical: 24, alignItems: 'center' },
  placeholderText: { fontSize: 15 },
  templateCard: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 2,
    marginBottom: 2,
  },
  templateCardPressed: { opacity: 0.85 },
  templateCardHeader: { marginBottom: 0 },
  templateCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  templateActionBtn: { padding: 4 },
  templateMenuBtn: {
    padding: 4,
  },
  templateMenuContent: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    minWidth: 200,
  },
  templateMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  templateMenuItemText: { fontSize: 16, fontWeight: '500' },
  templateMoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  templateMoveLabel: { fontSize: 13, fontWeight: '600' },
  lastDoneText: { fontSize: 11, marginTop: 2 },
  templateName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  templateNameNoDesc: { marginBottom: 6 },
  templateDesc: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
  exerciseCount: { fontSize: 11, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalBtnPrimary: { borderWidth: 0 },
  modalBtnText: { fontSize: 16, fontWeight: '600' },
  moveFolderList: { maxHeight: 300, marginBottom: 8 },
  moveFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  moveFolderRowText: { fontSize: 16 },
  moveModalCreateFolderBlock: { marginBottom: 12 },
  moveModalCreateFolderActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
