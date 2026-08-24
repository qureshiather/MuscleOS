import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type WorkoutSoundKind = 'restTick' | 'restEnd' | 'setComplete' | 'workoutComplete';

const SOURCES: Record<WorkoutSoundKind, number> = {
  restTick: require('../../assets/sounds/rest-tick.wav'),
  restEnd: require('../../assets/sounds/rest-end.wav'),
  setComplete: require('../../assets/sounds/set-complete.wav'),
  workoutComplete: require('../../assets/sounds/workout-complete.wav'),
};

let audioModeReady = false;
const loaded: Partial<Record<WorkoutSoundKind, AudioPlayer>> = {};

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'mixWithOthers',
    interruptionModeAndroid: 'duckOthers',
  });
  audioModeReady = true;
}

function getPlayer(kind: WorkoutSoundKind): AudioPlayer {
  let player = loaded[kind];
  if (!player) {
    player = createAudioPlayer(SOURCES[kind]);
    loaded[kind] = player;
  }
  return player;
}

/** Short UI sounds during an active workout (rest timer, set done, finish). */
export async function playWorkoutSound(kind: WorkoutSoundKind): Promise<void> {
  try {
    await ensureAudioMode();
    const player = getPlayer(kind);
    await player.seekTo(0);
    player.play();
  } catch {
    // Ignore missing audio session / unload races
  }
}
