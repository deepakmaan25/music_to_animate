/**
 * src/app/lib/storage.ts
 *
 * Supabase Storage helpers for audio files and video exports.
 *
 * Bucket layout:
 *   audio-tracks/  {userId}/{projectId}/audio/{filename}
 *   exports/       {userId}/{projectId}/exports/{exportId}.{ext}
 *
 * The first path segment is always the user_id — this aligns with the
 * RLS policy that restricts read/write to the authenticated user.
 */

import { supabase } from './supabase';

const AUDIO_BUCKET = 'audio-tracks';
const EXPORTS_BUCKET = 'exports';

// ─── Path builders ────────────────────────────────────────────────────────────

/** Sanitise filename for safe storage paths. */
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export function audioStoragePath(userId: string, projectId: string, filename: string): string {
  return `${userId}/${projectId}/audio/${safeFilename(filename)}`;
}

export function exportStoragePath(
  userId: string,
  projectId: string,
  exportId: string,
  ext: 'webm' | 'mp4'
): string {
  return `${userId}/${projectId}/exports/${exportId}.${ext}`;
}

// ─── Audio ────────────────────────────────────────────────────────────────────

/**
 * Upload an audio File to the audio-tracks bucket.
 * Returns the storage path on success, null on failure.
 * Uses upsert so repeated uploads (e.g. re-saving same project) don't error.
 */
export async function uploadAudioFile(
  userId: string,
  projectId: string,
  file: File
): Promise<string | null> {
  const path = audioStoragePath(userId, projectId, file.name);

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || 'audio/mpeg',
      cacheControl: '3600',
    });

  if (error) {
    console.error('[storage] uploadAudioFile:', error.message);
    return null;
  }
  return path;
}

/**
 * Get a short-lived signed URL for in-browser audio playback.
 * Default: 1 hour. Extend for longer sessions if needed.
 */
export async function getAudioSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error('[storage] getAudioSignedUrl:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Delete audio file when a project is deleted.
 * Non-fatal — log and continue even if this fails.
 */
export async function deleteAudioFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]);
  if (error) console.warn('[storage] deleteAudioFile:', error.message);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Upload a completed export blob to the exports bucket.
 * Returns the storage path on success, null on failure.
 *
 * This is called in the background after the MediaRecorder finishes.
 * Large files can take a while — do NOT await this in the download flow.
 */
export async function uploadExportBlob(
  userId: string,
  projectId: string,
  exportId: string,
  blob: Blob,
  ext: 'webm' | 'mp4'
): Promise<string | null> {
  const path = exportStoragePath(userId, projectId, exportId, ext);

  const { error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: '86400',
    });

  if (error) {
    console.error('[storage] uploadExportBlob:', error.message);
    return null;
  }
  return path;
}

/**
 * Get a signed download URL for a stored export.
 * Default: 24 hours.
 */
export async function getExportSignedUrl(
  storagePath: string,
  expiresInSeconds = 86400
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error('[storage] getExportSignedUrl:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
