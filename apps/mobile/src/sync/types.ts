import type { PullCursor } from './pullWatermark';
export type SyncEntityType =
  | 'session'
  | 'template'
  | 'template_folder'
  | 'custom_exercise'
  | 'recovery'
  | 'exercise_previous'
  | 'exercise_note'
  | 'app_settings';

export interface OutboxEntry {
  entityType: SyncEntityType;
  entityId: string;
  op: 'upsert' | 'delete';
  payload?: unknown;
  updatedAt: string;
}

export interface SyncMeta {
  /**
   * The account this transport (outbox + watermark) belongs to. Null in metas written before it
   * was tracked; the next signed-in sync adopts the current user.
   */
  userId: string | null;
  /** Device time of the last successful pull — for the sync status line only. */
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  lastSyncedAt: string | null;
  /**
   * Set when the transport switched to a different account. The next sync pulls everything, then
   * uploads the local rows that account doesn't have yet (the guest's data on sign-in).
   */
  pendingLocalUpload?: boolean;
  /**
   * Server-clock pull position (`server_updated_at`, see pullWatermark.ts). Missing in metas from
   * before MUS-91, which makes the next pull a full one.
   */
  pullCursor?: PullCursor;
}

export interface RemoteSyncRecord {
  user_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  payload: unknown | null;
  updated_at: string;
  /** Stamped by the database on every write; absent before the MUS-91 migration. */
  server_updated_at?: string;
  deleted_at: string | null;
}
