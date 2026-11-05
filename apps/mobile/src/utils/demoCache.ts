import { Directory, File, Paths } from 'expo-file-system';
import { demoCacheFileName, demoCacheIsFresh } from '@/utils/exerciseDemo';

/** Downloads in flight, so two players asking for the same clip share one request. */
const inflight = new Map<string, Promise<string>>();

/**
 * A local file URI for the demo clip at `videoUrl`, downloading it into the app's cache folder the
 * first time (and again once it's stale). A stale copy is still played when the refresh fails, e.g.
 * offline. Rejects only when there is no copy and the download fails.
 * Spec: docs/features/exercise-demos.md#app-player
 */
export function cachedDemoUri(videoUrl: string): Promise<string> {
  const pending = inflight.get(videoUrl);
  if (pending) return pending;
  const task = load(videoUrl).finally(() => inflight.delete(videoUrl));
  inflight.set(videoUrl, task);
  return task;
}

async function load(videoUrl: string): Promise<string> {
  const dir = new Directory(Paths.cache, 'exercise-demos');
  const file = new File(dir, demoCacheFileName(videoUrl));
  const info = file.info();
  if (info.exists && demoCacheIsFresh(info.modificationTime, Date.now())) return file.uri;
  try {
    dir.create({ idempotent: true, intermediates: true });
    // Lands in a temporary location and is moved into place only on a 2xx response.
    const saved = await File.downloadFileAsync(videoUrl, file, { idempotent: true });
    return saved.uri;
  } catch (error) {
    if (info.exists) return file.uri;
    throw error;
  }
}
