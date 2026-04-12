import { Audio } from 'expo-av';

export type WorkoutSoundKind = 'restTick' | 'restEnd' | 'setComplete' | 'workoutComplete';

const SOURCES: Record<WorkoutSoundKind, number> = {
  restTick: require('../../assets/sounds/rest-tick.wav'),
  restEnd: require('../../assets/sounds/rest-end.wav'),
  setComplete: require('../../assets/sounds/set-complete.wav'),
  workoutComplete: require('../../assets/sounds/workout-complete.wav'),
};

let audioModeReady = false;
const loaded: Partial<Record<WorkoutSoundKind, Audio.Sound>> = {};

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  audioModeReady = true;
}

async function getSound(kind: WorkoutSoundKind): Promise<Audio.Sound> {
  await ensureAudioMode();
  let sound = loaded[kind];
  if (!sound) {
    const created = await Audio.Sound.createAsync(SOURCES[kind], { shouldPlay: false });
    loaded[kind] = created.sound;
    sound = created.sound;
  }
  return sound;
}

/** Short UI sounds during an active workout (rest timer, set done, finish). */
export async function playWorkoutSound(kind: WorkoutSoundKind): Promise<void> {
  try {
    const sound = await getSound(kind);
    await sound.replayAsync();
  } catch {
    // Ignore missing audio session / unload races
  }
}
