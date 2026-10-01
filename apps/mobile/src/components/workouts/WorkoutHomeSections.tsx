import { useState, type ReactNode } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Slug } from 'react-native-body-highlighter';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useDeviceMetrics } from '@/theme/layout';
import type { WorkoutTemplate, WorkoutSession } from '@muscleos/types';
import type { FigureGender } from '@/utils/bodyCrop';
import type { RegionState } from '@/utils/muscleDiagramRegions';
import { MuscleZoomArt, ZoomFade } from '@/components/workouts/MuscleZoomArt';

export type TemplateArt = {
  regions: Partial<Record<Slug, RegionState>>;
  focus: Slug[];
};
export type TemplateRegions = (template: WorkoutTemplate) => TemplateArt;

const SUGGESTED_CARD_HEIGHT = 132;
const RECENT_CARD_HEIGHT = 112;
/** The figure overhangs the card so it reads as cropped, not framed. */
const ART_WIDTH = 0.9;
const ART_HEIGHT = 1.28;
const ART_RIGHT_BLEED = 0.06;

type ZoomCardProps = {
  template: WorkoutTemplate;
  art: TemplateArt;
  gender: FigureGender;
  height: number;
  width?: number;
  subtitle: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
};

/** Template card with the trained muscles as zoomed body art behind the name. */
function ZoomCard({ template, art, gender, height, width, subtitle, accessibilityLabel, onPress }: ZoomCardProps) {
  const { colors, isDark } = useTheme();
  const [measured, setMeasured] = useState(width ?? 0);
  const cardWidth = width ?? measured;
  const artW = cardWidth * ART_WIDTH;
  const artH = height * ART_HEIGHT;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onLayout={width ? undefined : (e) => setMeasured(Math.round(e.nativeEvent.layout.width))}
      style={({ pressed }) => [
        styles.zoomCard,
        { height, backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        width ? { width } : styles.zoomCardFlex,
        !isDark && styles.cardLight,
      ]}
      onPress={onPress}
    >
      {cardWidth > 0 ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.art, { right: -cardWidth * ART_RIGHT_BLEED, top: (height - artH) / 2 }]}
          >
            <MuscleZoomArt regions={art.regions} focus={art.focus} gender={gender} width={artW} height={artH} />
          </View>
          <ZoomFade width={cardWidth} height={height} color={colors.surface} />
        </>
      ) : null}
      <View style={styles.label}>
        <Text style={[styles.zoomTitle, { color: colors.text }]} numberOfLines={2}>
          {template.name}
        </Text>
        {subtitle}
      </View>
    </Pressable>
  );
}

type RecentWorkoutsRowProps = {
  items: { session: WorkoutSession; template: WorkoutTemplate }[];
  onPress: (template: WorkoutTemplate) => void;
  formatRelative: (iso: string) => string;
  getRegions: TemplateRegions;
  gender: FigureGender;
};

export function RecentWorkoutsRow({ items, onPress, formatRelative, getRegions, gender }: RecentWorkoutsRowProps) {
  const { colors } = useTheme();
  const { isNarrow } = useDeviceMetrics();
  const cardWidth = isNarrow ? 140 : 160;

  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {items.map(({ session, template }) => {
        const completedAgo = session.completedAt ? formatRelative(session.completedAt) : null;
        return (
          <ZoomCard
            key={session.id}
            template={template}
            art={getRegions(template)}
            gender={gender}
            width={cardWidth}
            height={RECENT_CARD_HEIGHT}
            accessibilityLabel={`${template.name}${completedAgo ? `, ${completedAgo}` : ''}`}
            onPress={() => onPress(template)}
            subtitle={
              completedAgo ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{completedAgo}</Text>
              ) : null
            }
          />
        );
      })}
    </ScrollView>
  );
}

type SuggestedWorkoutsGridProps = {
  items: { template: WorkoutTemplate }[];
  onPress: (template: WorkoutTemplate) => void;
  getRegions: TemplateRegions;
  gender: FigureGender;
};

export function SuggestedWorkoutsGrid({ items, onPress, getRegions, gender }: SuggestedWorkoutsGridProps) {
  const { colors } = useTheme();

  if (items.length === 0) return null;

  return (
    <View style={styles.grid}>
      {items.map(({ template }) => (
        <ZoomCard
          key={template.id}
          template={template}
          art={getRegions(template)}
          gender={gender}
          height={SUGGESTED_CARD_HEIGHT}
          accessibilityLabel={`${template.name}, ${template.exerciseIds.length} exercises`}
          onPress={() => onPress(template)}
          subtitle={
            <View style={styles.count}>
              <Ionicons name="barbell-outline" size={12} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>{template.exerciseIds.length}</Text>
            </View>
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  zoomCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  zoomCardFlex: { flex: 1 },
  art: { position: 'absolute' },
  label: { padding: spacing.md - 1, paddingBottom: spacing.sm + 1, gap: 1 },
  zoomTitle: { ...typography.sectionTitle, fontSize: 16, letterSpacing: -0.2 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
