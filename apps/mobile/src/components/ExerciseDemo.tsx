import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Exercise } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, touch } from '@/theme/tokens';
import { cachedDemoUri } from '@/utils/demoCache';
import { exerciseDemoVideoUrl } from '@/utils/exerciseDemo';

/**
 * The exercise's animated demo, looping inline: muted, mixed with whatever audio is already playing,
 * no controls. The clip is downloaded once and played from the phone (`cachedDemoUri`). With Reduce
 * Motion on it stays paused behind a play button. Exercises without a demo, or whose clip can't be
 * fetched, show `fallback` (the body figures) instead.
 * Spec: docs/features/exercise-demos.md#app-player
 */
export function ExerciseDemo({
  exercise,
  size,
  fallback,
}: {
  exercise: Pick<Exercise, 'id' | 'isPublished' | 'name'>;
  size: number;
  fallback: ReactNode;
}) {
  const { isDark } = useTheme();
  const videoUrl = exerciseDemoVideoUrl(exercise, isDark ? 'dark' : 'light');
  if (!videoUrl) return <>{fallback}</>;
  // Keyed so a theme switch (or a different exercise) starts over.
  return <CachedDemo key={videoUrl} videoUrl={videoUrl} name={exercise.name} size={size} fallback={fallback} />;
}

function CachedDemo({ videoUrl, name, size, fallback }: { videoUrl: string; name: string; size: number; fallback: ReactNode }) {
  const { colors } = useTheme();
  const [state, setState] = useState<{ uri: string } | 'loading' | 'failed'>('loading');
  useEffect(() => {
    let live = true;
    cachedDemoUri(videoUrl).then(
      (uri) => live && setState({ uri }),
      () => live && setState('failed')
    );
    return () => {
      live = false;
    };
  }, [videoUrl]);

  if (state === 'failed') return <>{fallback}</>;
  if (state === 'loading') {
    return (
      <View style={[styles.box, { width: size, height: size, backgroundColor: colors.surface }]} testID="exercise-demo-loading">
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }
  return <DemoPlayer uri={state.uri} name={name} size={size} onError={() => setState('failed')} />;
}

function DemoPlayer({ uri, name, size, onError }: { uri: string; name: string; size: number; onError: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
  });
  useEffect(() => {
    if (reduceMotion === false) player.play();
    else if (reduceMotion) player.pause();
  }, [player, reduceMotion]);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEffect(() => {
    if (status === 'error') onError();
  }, [status, onError]);

  return (
    <View
      style={[styles.box, { width: size, height: size, backgroundColor: colors.surface }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Animated demo of ${name}`}
      testID="exercise-demo"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {reduceMotion === true && !isPlaying ? (
        <Pressable
          onPress={() => player.play()}
          accessibilityRole="button"
          accessibilityLabel={`Play the ${name} demo`}
          testID="exercise-demo-play"
          style={[styles.play, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="play" size={22} color={colors.primaryOn} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The OS Reduce Motion setting, read once for the app and kept current; null until the first read
 * lands, so nothing autoplays before then.
 */
let reduceMotionSetting: boolean | null = null;
const reduceMotionListeners = new Set<() => void>();
function setReduceMotion(on: boolean) {
  reduceMotionSetting = on;
  for (const listener of reduceMotionListeners) listener();
}
void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

function useReduceMotion(): boolean | null {
  return useSyncExternalStore(
    (listener) => {
      reduceMotionListeners.add(listener);
      return () => reduceMotionListeners.delete(listener);
    },
    () => reduceMotionSetting
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  play: {
    width: touch.min + 12,
    height: touch.min + 12,
    borderRadius: (touch.min + 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
