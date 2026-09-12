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
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { useTemplatesStore } from '@/store/templatesStore';
import { BUILT_IN_FOLDERS } from '@/data/builtInTemplates';
import { useProGate } from '@/hooks/useProGate';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatRelative } from '@/utils/relativeTime';
import { recommendTemplates } from '@/utils/recommendTemplates';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  RecentWorkoutsRow,
  SuggestedWorkoutsGrid,
  type MusclesByTemplate,
} from '@/components/workouts/WorkoutHomeSections';
import { TemplateCard } from '@/components/workouts/TemplateCard';
import { computeHomeStats } from '@/utils/homeStats';
import { requiresProToStart } from '@/subscription/features';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useBottomSpace, useDeviceMetrics, useModalMaxHeight } from '@/theme/layout';
import type { WorkoutTemplate, TemplateFolder, MuscleId } from '@muscleos/types';

const ARCHIVED_SECTION = '_archived';
const HIDDEN_CUSTOM_SECTION = '_hidden_custom';
const HIDDEN_BUILT_IN_SECTION = '_hidden_builtin';

/** Basic is built-in only, so `mine` is offered to Pro accounts only. */
type HomeTab = 'for_you' | 'mine' | 'library';

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
  const setTemplateHidden = useTemplatesStore((s) => s.setTemplateHidden);
  const isTemplateHidden = useTemplatesStore((s) => s.isTemplateHidden);
  const hiddenBuiltInIds = useTemplatesStore((s) => s.hiddenBuiltInIds);
  const isLoading = useTemplatesStore((s) => s.isLoading);
  const loadSessions = useSessionsStore((s) => s.load);
  const sessions = useSessionsStore((s) => s.sessions);
  const completedSessions = useSessionsStore((s) => s.completedSessions);
  const loadRecovery = useRecoveryStore((s) => s.load);
  const recoveryItems = useRecoveryStore((s) => s.items);
  const activeRecovery = useRecoveryStore((s) => s.activeRecovery);
  const notNatty = useSettingsStore((s) => !!s.profile.notNatty);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const { isPro, gatePro } = useProGate();
  const activeSession = useActiveWorkoutStore((s) => s.session);

  const { width: screenWidth } = useDeviceMetrics();
  const modalMaxHeight = useModalMaxHeight();
  const modalPaddingBottom = useBottomSpace(spacing.xl);
  /** The folder list may take at most half the modal so the title and Cancel button stay visible. */
  const moveFolderListMaxHeight = Math.min(300, Math.round(modalMaxHeight / 2));
  const dropdownMinWidth = Math.min(140, screenWidth - spacing.xl * 2);
  const templateMenuMinWidth = Math.min(200, screenWidth - spacing.xl * 2);

  const [homeTab, setHomeTab] = useState<HomeTab>('for_you');
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
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateMenuTarget, setTemplateMenuTarget] = useState<WorkoutTemplate | null>(null);
  const [templateMenuWasHidden, setTemplateMenuWasHidden] = useState(false);
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
      loadRecovery();
    }, [loadSessions, loadRecovery])
  );

  const templates = allTemplates();
  const { builtIn, custom, hiddenCustom, hiddenBuiltIn } = useMemo(() => {
    const builtIn: WorkoutTemplate[] = [];
    const custom: WorkoutTemplate[] = [];
    const hiddenCustom: WorkoutTemplate[] = [];
    const hiddenBuiltIn: WorkoutTemplate[] = [];
    templates.forEach((t) => {
      const hidden = isTemplateHidden(t);
      if (t.isBuiltIn) {
        if (hidden) hiddenBuiltIn.push(t);
        else builtIn.push(t);
      } else if (hidden) {
        hiddenCustom.push(t);
      } else {
        custom.push(t);
      }
    });
    return { builtIn, custom, hiddenCustom, hiddenBuiltIn };
  }, [templates, hiddenBuiltInIds, userTemplates, isTemplateHidden]);

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

  const visibleBuiltInFolders = useMemo(
    () => BUILT_IN_FOLDERS.filter((f) => (builtInByFolder[f.id] ?? []).length > 0),
    [builtInByFolder]
  );

  const folderHasOnlyHiddenTemplates = (folderId: string) =>
    (byFolder[folderId] ?? []).length === 0 && hiddenCustom.some((t) => t.folderId === folderId);

  const visibleFavoriteFolders = favoriteFolders.filter((f) => !folderHasOnlyHiddenTemplates(f.id));
  const visibleNormalFolders = normalFolders.filter((f) => !folderHasOnlyHiddenTemplates(f.id));
  const visibleArchivedFolders = archivedFolders.filter((f) => !folderHasOnlyHiddenTemplates(f.id));

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

  /** Worked muscles per template, duplicates kept so cards can weigh dominance. */
  const musclesByTemplate = useMemo(() => {
    const map: MusclesByTemplate = {};
    for (const template of templates) {
      const muscles: MuscleId[] = [];
      for (const id of template.exerciseIds) {
        const exercise = getExercise(id);
        if (exercise) muscles.push(...exercise.muscles);
      }
      map[template.id] = muscles;
    }
    return map;
  }, [templates, getExercise]);

  const { sessionsThisWeek, weekStreak } = useMemo(
    () => computeHomeStats(sessions),
    [sessions]
  );

  const headerStats = useMemo(() => {
    const parts: string[] = [];
    if (sessionsThisWeek > 0) {
      parts.push(`${sessionsThisWeek} this week`);
    }
    if (weekStreak > 1) {
      parts.push(`${weekStreak}-week streak`);
    }
    return parts.join('  ·  ');
  }, [sessionsThisWeek, weekStreak]);

  const tabOptions = useMemo(
    () =>
      [
        { value: 'for_you', label: 'For you' },
        { value: 'mine', label: 'Mine' },
        { value: 'library', label: 'Library' },
      ] as { value: HomeTab; label: string }[],
    []
  );

  /**
   * Basic accounts keep their custom templates but cannot start one, so they are
   * left out of the recommendation surfaces and only appear (locked) under Mine.
   */
  const startableTemplates = useMemo(
    () => (isPro ? templates : templates.filter((t) => !requiresProToStart(t))),
    [templates, isPro]
  );

  const suggestedWorkouts = useMemo(() => {
    const recoveringMuscleIds = new Set(
      activeRecovery().map((r) => r.muscleId)
    );
    const recentMuscleWindowMs = 7 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const recentlyWorkedMuscleIds = new Set<MuscleId>();
    for (const session of sessions) {
      if (!session.completedAt) continue;
      if (nowMs - new Date(session.completedAt).getTime() > recentMuscleWindowMs) {
        continue;
      }
      for (const sessionExercise of session.exercises) {
        const exercise = getExercise(sessionExercise.exerciseId);
        if (exercise) {
          for (const muscleId of exercise.muscles) {
            recentlyWorkedMuscleIds.add(muscleId);
          }
        }
      }
    }
    const visible = startableTemplates.filter((t) => !isTemplateHidden(t));
    return recommendTemplates({
      templates: visible,
      recoveringMuscleIds,
      recentlyWorkedMuscleIds,
      lastDoneByTemplate,
      getTemplateMuscles: (template) => musclesByTemplate[template.id] ?? [],
      limit: 2,
    });
  }, [
    startableTemplates,
    recoveryItems,
    notNatty,
    sessions,
    lastDoneByTemplate,
    hiddenBuiltInIds,
    userTemplates,
    isTemplateHidden,
    activeRecovery,
    getExercise,
    musclesByTemplate,
  ]);

  /** Recent excludes Suggested so the two home launchers never repeat the same template. */
  const recentWorkouts = useMemo(() => {
    const suggestedIds = new Set(suggestedWorkouts.map((s) => s.template.id));
    const completed = completedSessions();
    const templateMap = new Map(startableTemplates.map((t) => [t.id, t]));
    const seenTemplateIds = new Set<string>();
    const items: { session: (typeof completed)[number]; template: WorkoutTemplate }[] = [];
    for (const s of completed) {
      if (suggestedIds.has(s.templateId) || seenTemplateIds.has(s.templateId)) continue;
      const t = templateMap.get(s.templateId);
      if (t == null || isTemplateHidden(t)) continue;
      seenTemplateIds.add(s.templateId);
      items.push({ session: s, template: t });
      if (items.length >= 6) break;
    }
    return items;
  }, [
    suggestedWorkouts,
    sessions,
    startableTemplates,
    hiddenBuiltInIds,
    userTemplates,
    isTemplateHidden,
    completedSessions,
  ]);

  function handleCreateFolder() {
    if (!gatePro('custom_templates')) return;
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

  function handleDeleteTemplate(template: WorkoutTemplate) {
    Alert.alert(
      'Delete template',
      `Delete "${template.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTemplate(template.id);
          },
        },
      ]
    );
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
        `"${folder.name}" has ${templateCount} template${templateCount === 1 ? '' : 's'}. Remove them from the folder or delete them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove from folder',
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
    if (!gatePro('custom_templates')) return;
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

  /** Archived and hidden groups start closed; real folders start open. */
  function defaultFolderExpanded(folderId: string): boolean {
    return (
      folderId !== ARCHIVED_SECTION &&
      folderId !== HIDDEN_CUSTOM_SECTION &&
      folderId !== HIDDEN_BUILT_IN_SECTION
    );
  }

  function isFolderExpanded(folderId: string): boolean {
    return folderExpanded[folderId] ?? defaultFolderExpanded(folderId);
  }

  function toggleFolderExpanded(folderId: string) {
    setFolderExpanded((prev) => ({
      ...prev,
      [folderId]: !(prev[folderId] ?? defaultFolderExpanded(folderId)),
    }));
  }

  function openTemplateMenu(template: WorkoutTemplate) {
    setTemplateMenuTarget(template);
    setTemplateMenuWasHidden(isTemplateHidden(template));
    setTemplateMenuOpen(true);
  }

  function closeTemplateMenu() {
    setTemplateMenuOpen(false);
  }

  function renderTemplateCard(template: WorkoutTemplate, showMenu?: boolean) {
    return (
      <TemplateCard
        key={template.id}
        template={template}
        muscleIds={musclesByTemplate[template.id] ?? []}
        lastDone={getLastDone(template)}
        onPress={handleStartTemplate}
        onMenu={showMenu ? openTemplateMenu : undefined}
        locked={!isPro && requiresProToStart(template)}
      />
    );
  }

  function handleStartTemplate(template: WorkoutTemplate) {
    if (!isPro && requiresProToStart(template)) {
      gatePro('custom_templates');
      return;
    }
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

  function renderFolderDropdown(folder: TemplateFolder) {
    return (
      <View
        ref={folderDropdownRef}
        style={[
          styles.folderDropdown,
          {
            minWidth: dropdownMinWidth,
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
            color={folder.favorite ? colors.warning : colors.text}
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

  /**
   * Folder groups render as flat labelled bands rather than nested cards — a box
   * inside a box inside a box was the main reason home read as a file manager.
   */
  function renderGroupHeader(options: {
    label: string;
    count?: number;
    expanded: boolean;
    onToggle: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    muted?: boolean;
    favorite?: boolean;
    trailing?: React.ReactNode;
  }) {
    const { label, count, expanded, onToggle, icon, muted, favorite, trailing } = options;
    const labelColor = muted ? colors.textMuted : colors.textSecondary;
    return (
      <View style={styles.groupHeaderRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={label}
          style={({ pressed }) => [styles.groupHeaderLeft, pressed && styles.pressedRow]}
          onPress={onToggle}
        >
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={labelColor}
          />
          {icon ? <Ionicons name={icon} size={13} color={labelColor} /> : null}
          {favorite ? <Ionicons name="star" size={11} color={colors.warning} /> : null}
          <Text style={[styles.groupLabel, { color: labelColor }]} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
          {count != null ? (
            <Text style={[styles.groupCount, { color: colors.textMuted }]}>{count}</Text>
          ) : null}
        </Pressable>
        {trailing}
      </View>
    );
  }

  function renderBuiltInFolderSection(folder: TemplateFolder) {
    const templatesInFolder = builtInByFolder[folder.id] ?? [];
    const expanded = isFolderExpanded(folder.id);
    return (
      <View key={folder.id} style={styles.folderGroup}>
        {renderGroupHeader({
          label: folder.name,
          count: templatesInFolder.length,
          expanded,
          onToggle: () => toggleFolderExpanded(folder.id),
          icon: 'folder-outline',
        })}
        {expanded && templatesInFolder.length > 0 && (
          <View style={styles.groupContent}>
            {templatesInFolder.map((template) => renderTemplateCard(template, true))}
          </View>
        )}
      </View>
    );
  }

  function renderFolderSection(folder: TemplateFolder, isArchived?: boolean) {
    const templatesInFolder = byFolder[folder.id] ?? [];
    const expanded = isFolderExpanded(folder.id);
    return (
      <View key={folder.id} style={[styles.folderGroup, isArchived && styles.dimmedGroup]}>
        <View style={styles.folderSectionHeaderWrap}>
          {renderGroupHeader({
            label: folder.name,
            count: templatesInFolder.length,
            expanded,
            onToggle: () => toggleFolderExpanded(folder.id),
            icon: 'folder-outline',
            muted: isArchived,
            favorite: folder.favorite && !isArchived,
            trailing: (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Options for ${folder.name}`}
                hitSlop={8}
                onPress={() => setFolderMenuId((id) => (id === folder.id ? null : folder.id))}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
              </Pressable>
            ),
          })}
          {folderMenuId === folder.id && renderFolderDropdown(folder)}
        </View>
        {expanded && (
          <View style={styles.groupContent}>
            {templatesInFolder.length === 0 ? (
              <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                No templates in this folder.
              </Text>
            ) : (
              templatesInFolder.map((template) => renderTemplateCard(template, true))
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <Screen kind="tab">
      <ScrollView contentContainerStyle={screenHeaderStyles.scrollContent}>
        <View style={screenHeaderStyles.headerInScroll}>
          <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Workouts</Text>
          {headerStats ? (
            <Text style={[styles.headerStats, { color: colors.textSecondary }]}>{headerStats}</Text>
          ) : (
            <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
              Pick a template or start from scratch
            </Text>
          )}

          {/* Start Empty Workout - hero CTA */}
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
              isPro ? handleStartEmptyWorkout() : gatePro('empty_workout')
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
                  color={isPro ? colors.primaryOn : colors.primary}
                />
              </View>
                <View style={styles.startEmptyTextWrap}>
                <View style={styles.startEmptyTitleRow}>
                  <Text
                    style={[
                      styles.startEmptyCardTitle,
                      { color: isPro ? colors.primaryOn : colors.text },
                    ]}
                  >
                    Empty workout
                  </Text>
                  {!isPro && (
                    <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                  )}
                </View>
                <Text
                  style={[
                    styles.startEmptyCardSubtitle,
                    { color: isPro ? 'rgba(255,255,255,0.88)' : colors.textMuted },
                  ]}
                >
                  {isPro ? 'Add exercises as you go' : 'Included with Pro'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={isPro ? 'rgba(255,255,255,0.88)' : colors.textMuted}
              />
            </View>
          </Pressable>
        </View>

        <View style={styles.templatesSection}>
          <View style={styles.tabBar}>
            <SegmentedControl options={tabOptions} value={homeTab} onChange={setHomeTab} />
          </View>

          {isLoading ? (
            <View style={styles.groupContent}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={2} />
            </View>
          ) : homeTab === 'for_you' ? (
            <>
              {suggestedWorkouts.length > 0 && (
                <View style={styles.homeSection}>
                  <SectionHeader
                    title="Suggested"
                    caption="Based on what has recovered and what you have not trained lately"
                  />
                  <SuggestedWorkoutsGrid
                    items={suggestedWorkouts}
                    musclesByTemplate={musclesByTemplate}
                    onPress={handleStartTemplate}
                  />
                </View>
              )}

              {recentWorkouts.length > 0 && (
                <View style={styles.homeSection}>
                  <SectionHeader title="Recent" />
                  <RecentWorkoutsRow
                    items={recentWorkouts}
                    musclesByTemplate={musclesByTemplate}
                    onPress={handleStartTemplate}
                    formatRelative={formatRelative}
                  />
                </View>
              )}

              {suggestedWorkouts.length === 0 && recentWorkouts.length === 0 && (
                <View style={styles.emptySectionRow}>
                  <Text
                    style={[
                      styles.emptySectionText,
                      styles.emptySectionTextInRow,
                      { color: colors.textMuted },
                    ]}
                  >
                    Nothing to suggest yet.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setHomeTab('library')}
                    hitSlop={8}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.emptySectionLink, { color: colors.primary }]}>
                      Browse the library
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : homeTab === 'mine' ? (
            <View style={styles.homeSection}>
              <View style={styles.templatesSectionRow}>
                <Text style={[styles.templatesSectionTitle, { color: colors.text }]}>
                  My templates
                </Text>
                <View style={styles.templatesSectionActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New folder"
                    style={[styles.addBtn, { borderColor: colors.border }]}
                    onPress={() => {
                      if (gatePro('custom_templates')) setShowFolderModal(true);
                    }}
                  >
                    <Ionicons name="folder-open-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New template"
                    style={[styles.addBtn, { borderColor: colors.border }]}
                    onPress={() => {
                      if (gatePro('custom_templates')) router.push('/create-template');
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text style={[styles.addBtnText, { color: colors.primary }]}>New</Text>
                  </Pressable>
                </View>
              </View>

              {!isPro && custom.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Your templates are saved. Resubscribe to Pro to run them."
                  onPress={() => gatePro('custom_templates')}
                  style={({ pressed }) => [
                    styles.lapsedNotice,
                    { backgroundColor: colors.primarySurface, borderColor: colors.primaryBorder },
                    pressed && styles.pressedRow,
                  ]}
                >
                  <Ionicons name="lock-closed" size={14} color={colors.primary} />
                  <Text style={[typography.caption, styles.lapsedNoticeText, { color: colors.text }]}>
                    Your templates are saved. Resubscribe to Pro to run them.
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </Pressable>
              ) : null}

              <View style={styles.groupContent}>
                {uncategorized.map((template) => renderTemplateCard(template, true))}
                {visibleFavoriteFolders.map((f) => renderFolderSection(f))}
                {visibleNormalFolders.map((f) => renderFolderSection(f))}

                {visibleArchivedFolders.length > 0 && (
                  <View style={styles.folderGroup}>
                    {renderGroupHeader({
                      label: 'Archived',
                      count: visibleArchivedFolders.length,
                      expanded: isFolderExpanded(ARCHIVED_SECTION),
                      onToggle: () => toggleFolderExpanded(ARCHIVED_SECTION),
                      icon: 'archive-outline',
                      muted: true,
                    })}
                    {isFolderExpanded(ARCHIVED_SECTION) && (
                      <View style={styles.groupContent}>
                        {visibleArchivedFolders.map((f) => renderFolderSection(f, true))}
                      </View>
                    )}
                  </View>
                )}

                {hiddenCustom.length > 0 && (
                  <View style={styles.folderGroup}>
                    {renderGroupHeader({
                      label: 'Hidden',
                      count: hiddenCustom.length,
                      expanded: isFolderExpanded(HIDDEN_CUSTOM_SECTION),
                      onToggle: () => toggleFolderExpanded(HIDDEN_CUSTOM_SECTION),
                      icon: 'eye-off-outline',
                      muted: true,
                    })}
                    {isFolderExpanded(HIDDEN_CUSTOM_SECTION) && (
                      <View style={[styles.groupContent, styles.dimmedGroup]}>
                        {hiddenCustom.map((template) => renderTemplateCard(template, true))}
                      </View>
                    )}
                  </View>
                )}

                {custom.length === 0 && hiddenCustom.length === 0 && (
                  <View style={styles.emptySectionRow}>
                    <Text
                      style={[
                        styles.emptySectionText,
                        styles.emptySectionTextInRow,
                        { color: colors.textMuted },
                      ]}
                    >
                      No templates yet.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push('/create-template')}
                      hitSlop={8}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={[styles.emptySectionLink, { color: colors.primary }]}>
                        Create template
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.homeSection}>
              <SectionHeader
                title="Built-in templates"
                caption="Proven programs, ready to run as-is"
              />
              <View style={styles.groupContent}>
                {builtInUncategorized.map((template) => renderTemplateCard(template, true))}
                {visibleBuiltInFolders.map((f) => renderBuiltInFolderSection(f))}

                {hiddenBuiltIn.length > 0 && (
                  <View style={styles.folderGroup}>
                    {renderGroupHeader({
                      label: 'Hidden',
                      count: hiddenBuiltIn.length,
                      expanded: isFolderExpanded(HIDDEN_BUILT_IN_SECTION),
                      onToggle: () => toggleFolderExpanded(HIDDEN_BUILT_IN_SECTION),
                      icon: 'eye-off-outline',
                      muted: true,
                    })}
                    {isFolderExpanded(HIDDEN_BUILT_IN_SECTION) && (
                      <View style={[styles.groupContent, styles.dimmedGroup]}>
                        {hiddenBuiltIn.map((template) => renderTemplateCard(template, true))}
                      </View>
                    )}
                  </View>
                )}

                {builtIn.length === 0 && hiddenBuiltIn.length === 0 && (
                  <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                    No built-in templates
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showFolderModal} animationType="slide" transparent>
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowFolderModal(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                maxHeight: modalMaxHeight,
                paddingBottom: modalPaddingBottom,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnInRow, { borderColor: colors.border }]}
                onPress={() => setShowFolderModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnInRow,
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
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
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setEditingFolder(null)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                maxHeight: modalMaxHeight,
                paddingBottom: modalPaddingBottom,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnInRow, { borderColor: colors.border }]}
                onPress={() => setEditingFolder(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnInRow,
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
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
                    color={folder.favorite ? colors.warning : colors.text}
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

      <Modal visible={templateMenuOpen} animationType="fade" transparent>
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={closeTemplateMenu}
        >
          <View
            style={[
              styles.templateMenuContent,
              { minWidth: templateMenuMinWidth, backgroundColor: colors.surface },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {!templateMenuTarget?.isBuiltIn && (
              <>
                <Pressable
                  style={[styles.templateMenuItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (!gatePro('custom_templates')) {
                      closeTemplateMenu();
                      return;
                    }
                    if (templateMenuTarget) {
                      setEditingTemplateName(templateMenuTarget);
                      setEditingTemplateNewName(templateMenuTarget.name);
                    }
                    closeTemplateMenu();
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.text} />
                  <Text style={[styles.templateMenuItemText, { color: colors.text }]}>Rename</Text>
                </Pressable>
                <Pressable
                  style={[styles.templateMenuItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (!gatePro('custom_templates')) {
                      closeTemplateMenu();
                      return;
                    }
                    if (templateMenuTarget) setMoveTemplateModal(templateMenuTarget);
                    closeTemplateMenu();
                  }}
                >
                  <Ionicons name="arrow-redo-outline" size={18} color={colors.text} />
                  <Text style={[styles.templateMenuItemText, { color: colors.text }]}>Move</Text>
                </Pressable>
                <Pressable
                  style={[styles.templateMenuItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (!gatePro('custom_templates')) {
                      closeTemplateMenu();
                      return;
                    }
                    if (templateMenuTarget) {
                      router.push({
                        pathname: '/create-template',
                        params: { templateId: templateMenuTarget.id },
                      });
                    }
                    closeTemplateMenu();
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={colors.text} />
                  <Text style={[styles.templateMenuItemText, { color: colors.text }]}>Edit</Text>
                </Pressable>
              </>
            )}
            <Pressable
              style={[
                styles.templateMenuItem,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: templateMenuTarget?.isBuiltIn ? 0 : 1,
                },
              ]}
              onPress={() => {
                const target = templateMenuTarget;
                const nextHidden = !templateMenuWasHidden;
                closeTemplateMenu();
                if (target) {
                  void setTemplateHidden(target, nextHidden);
                }
              }}
            >
              <Ionicons
                name={templateMenuWasHidden ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.text}
              />
              <Text style={[styles.templateMenuItemText, { color: colors.text }]}>
                {templateMenuWasHidden ? 'Unhide' : 'Hide'}
              </Text>
            </Pressable>
            {!templateMenuTarget?.isBuiltIn && (
              <Pressable
                style={[styles.templateMenuItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  const target = templateMenuTarget;
                  closeTemplateMenu();
                  if (target) handleDeleteTemplate(target);
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.templateMenuItemText, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!editingTemplateName} animationType="slide" transparent>
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setEditingTemplateName(null)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                maxHeight: modalMaxHeight,
                paddingBottom: modalPaddingBottom,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnInRow, { borderColor: colors.border }]}
                onPress={() => setEditingTemplateName(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnInRow,
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
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
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => {
            setMoveTemplateModal(null);
            setShowCreateFolderInMoveModal(false);
            setMoveModalNewFolderName('');
          }}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                maxHeight: modalMaxHeight,
                paddingBottom: modalPaddingBottom,
              },
            ]}
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
                    style={[styles.modalBtn, styles.modalBtnInRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setShowCreateFolderInMoveModal(false);
                      setMoveModalNewFolderName('');
                    }}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalBtn,
                      styles.modalBtnInRow,
                      styles.modalBtnPrimary,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handleCreateFolderAndMove}
                    disabled={!moveModalNewFolderName.trim()}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create & move</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <ScrollView
                  style={[styles.moveFolderList, { maxHeight: moveFolderListMaxHeight }]}
                  nestedScrollEnabled
                >
                  <Pressable
                    style={[styles.moveFolderRow, { borderBottomColor: colors.border }]}
                    onPress={() =>
                      moveTemplateModal && handleMoveTemplate(moveTemplateModal, undefined)
                    }
                  >
                    <Ionicons name="folder-open-outline" size={18} color={colors.textMuted} />
                    <Text style={[styles.moveFolderRowText, { color: colors.text }]}>
                      No folder
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerStats: {
    fontFamily: typography.data.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  startEmptyCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
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
  startEmptyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  startEmptyCardTitle: {
    ...typography.bodyMedium,
    fontFamily: typography.screenTitle.fontFamily,
    fontSize: typography.sectionTitle.fontSize,
  },
  startEmptyCardSubtitle: { ...typography.caption, marginTop: 2 },
  templatesSection: { marginTop: spacing.sm },
  tabBar: { marginBottom: spacing.lg },
  homeSection: { marginBottom: spacing.lg },
  folderGroup: { marginTop: spacing.xs },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  groupHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  groupLabel: {
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  groupCount: {
    fontFamily: typography.data.fontFamily,
    fontSize: 11,
    lineHeight: 16,
  },
  groupContent: { gap: spacing.sm },
  lapsedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  lapsedNoticeText: { flex: 1, minWidth: 0 },
  dimmedGroup: { opacity: 0.7 },
  pressedRow: { opacity: 0.7 },
  templatesSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  templatesSectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templatesSectionTitle: { ...typography.sectionTitle, flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  addBtnText: { fontSize: typography.label.fontSize, fontWeight: '600' },
  folderSectionHeaderWrap: {
    position: 'relative',
  },
  folderDropdown: {
    position: 'absolute',
    top: '100%',
    right: 12,
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
  folderDropdownItemText: { fontSize: typography.body.fontSize },
  emptySectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptySectionText: { fontSize: typography.body.fontSize, paddingVertical: 12, paddingHorizontal: 4 },
  emptySectionTextInRow: { paddingVertical: 0, paddingHorizontal: 0 },
  emptySectionLink: { fontSize: typography.bodyMedium.fontSize, fontWeight: '600' },
  templateMenuContent: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  templateMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  templateMenuItemText: { fontSize: typography.button.fontSize, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalScroll: { flexShrink: 1 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: typography.button.fontSize,
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
    alignItems: 'center',
  },
  modalBtnInRow: { flex: 1, minWidth: 0 },
  modalBtnPrimary: { borderWidth: 0 },
  modalBtnText: {
    fontSize: typography.button.fontSize,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  moveFolderList: { marginBottom: 8 },
  moveFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  moveFolderRowText: { fontSize: typography.button.fontSize },
  moveModalCreateFolderBlock: { marginBottom: 12 },
  moveModalCreateFolderActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
