/**
 * src/app/hooks/useSupabaseSync.ts
 *
 * Handles all Supabase persistence operations for the Studio:
 *   - Debounced project config autosave (1.5 s after last change)
 *   - Background audio file upload on track load
 *   - Export record creation + background blob upload
 *
 * All operations are fire-and-forget from the UI perspective.
 * If the user is signed out, every function is a silent no-op.
 */

import { useCallback, useEffect, useRef } from 'react';
import { upsertProject, upsertTrack, upsertExportRecord, patchExportRecord } from '../lib/db';
import { uploadAudioFile, uploadExportBlob } from '../lib/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncableConfig = {
  engineId: string;
  style: { palette: number };
  motion: { beatSensitivity: number; particleDensity: number; smoothing: number };
  audioMeta: { name: string; duration: number; sampleRate?: number };
};

export type ExportSyncParams = {
  exportId: string;
  exportType: 'webm' | 'mp4';
  aspectRatio: string;
  resolution: string;
  qualityPreset: string;
  durationSecs: number;
  blob?: Blob;          // if provided, uploaded to Storage in background
  sizeBytes?: number;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param userId  Current authenticated user's id. Pass undefined when signed out.
 *
 * All returned functions accept an explicit `projectId` so they stay stable
 * regardless of which project is currently open.
 */
export function useSupabaseSync(userId: string | undefined) {
  // Map of projectId → pending debounce timer
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up all pending timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  // ── Debounced config save ──────────────────────────────────────────────────

  /**
   * Call on every param change (engine, palette, sliders…).
   * Coalesces rapid consecutive calls into a single DB write after 1.5 s of silence.
   */
  const saveConfig = useCallback(
    (projectId: string, config: SyncableConfig) => {
      if (!userId || !projectId) return;

      // Cancel any pending write for this project
      const existing = timersRef.current.get(projectId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        timersRef.current.delete(projectId);
        const title = config.audioMeta.name.replace(/\.[^.]+$/, '') || 'Untitled';
        await upsertProject({
          id: projectId,
          user_id: userId,
          title,
          engine_id: config.engineId,
          style_config: config.style as Record<string, unknown>,
          motion_config: config.motion as Record<string, unknown>,
          audio_meta: config.audioMeta,
        });
        console.debug('[sync] config saved', projectId);
      }, 1500);

      timersRef.current.set(projectId, timer);
    },
    [userId]
  );

  // ── Audio upload ───────────────────────────────────────────────────────────

  /**
   * Upload the audio file to Supabase Storage and create/upsert the project
   * and track rows. Called once when a new file is decoded in Studio.
   *
   * Returns the storage path on success, null on failure or when signed out.
   * This is intentionally async — await it or fire-and-forget.
   */
  const uploadAudio = useCallback(
    async (
      projectId: string,
      file: File,
      audioMeta: { name: string; duration: number; sampleRate?: number },
      engineId: string
    ): Promise<string | null> => {
      if (!userId || !projectId) return null;

      // 1. Ensure project row exists before the FK'd track row
      const title = audioMeta.name.replace(/\.[^.]+$/, '') || 'Untitled';
      const projectOk = await upsertProject({
        id: projectId,
        user_id: userId,
        title,
        engine_id: engineId,
        style_config: {},
        motion_config: {},
        audio_meta: audioMeta,
      });
      if (!projectOk) return null;

      // 2. Upload file to Storage
      const storagePath = await uploadAudioFile(userId, projectId, file);
      if (!storagePath) return null;

      // 3. Upsert track row (project_id is PK — safe to call repeatedly)
      await upsertTrack({
        project_id: projectId,
        user_id: userId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type || 'audio/mpeg',
        file_size: file.size,
        duration: audioMeta.duration,
      });

      console.debug('[sync] audio uploaded', storagePath);
      return storagePath;
    },
    [userId]
  );

  // ── Export save ────────────────────────────────────────────────────────────

  /**
   * Create an export record in the DB and (optionally) upload the blob to Storage.
   * The blob upload is background — it does NOT need to complete before the
   * browser's local download is offered to the user.
   */
  const saveExport = useCallback(
    async (projectId: string, params: ExportSyncParams): Promise<void> => {
      if (!userId || !projectId) return;

      const {
        exportId,
        exportType,
        aspectRatio,
        resolution,
        qualityPreset,
        durationSecs,
        blob,
        sizeBytes,
      } = params;

      // Insert record immediately with status 'ready'
      await upsertExportRecord({
        id: exportId,
        user_id: userId,
        project_id: projectId,
        export_type: exportType,
        aspect_ratio: aspectRatio,
        resolution,
        quality_preset: qualityPreset,
        duration_secs: durationSecs,
        storage_path: undefined,  // filled in below if upload succeeds
        size_bytes: sizeBytes,
        status: 'ready',
      });

      // Upload blob in the background (don't block)
      if (blob) {
        uploadExportBlob(userId, projectId, exportId, blob, exportType as 'webm' | 'mp4')
          .then((storagePath) => {
            if (storagePath) {
              // Patch the record with the final storage path
              patchExportRecord(exportId, { storage_path: storagePath });
              console.debug('[sync] export blob uploaded', storagePath);
            }
          })
          .catch((err) => console.warn('[sync] export blob upload failed:', err));
      }
    },
    [userId]
  );

  return { saveConfig, uploadAudio, saveExport };
}
