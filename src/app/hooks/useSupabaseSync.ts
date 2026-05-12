import { useCallback, useEffect, useRef } from 'react';
import { upsertProject, upsertTrack, upsertExportRecord, patchExportRecord } from '../lib/db';
import { uploadAudioFile, uploadExportBlob } from '../lib/storage';

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
  blob?: Blob;
  sizeBytes?: number;
};

export function useSupabaseSync(userId: string | undefined) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const saveConfig = useCallback(
    (projectId: string, config: SyncableConfig) => {

      if (!userId) {
        return;
      }
      if (!projectId) {
        return;
      }

      const existing = timersRef.current.get(projectId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        timersRef.current.delete(projectId);
        const title = config.audioMeta.name.replace(/\.[^.]+$/, '') || 'Untitled';
        const ok = await upsertProject({
          id: projectId,
          user_id: userId,
          title,
          engine_id: config.engineId,
          style_config: config.style as Record<string, unknown>,
          motion_config: config.motion as Record<string, unknown>,
          audio_meta: config.audioMeta,
        });
      }, 1500);

      timersRef.current.set(projectId, timer);
    },
    [userId]
  );

const uploadAudio = useCallback(
  async (
    projectId: string,
    file: File,
    audioMeta: { name: string; duration: number; sampleRate?: number },
    engineId: string
  ): Promise<string | null> => {
    // Get the user live at call time — avoids race where hook captured
    // userId=undefined before the auth session was restored on page load
    const { supabase } = await import('../lib/supabase');
    const { data: { user: liveUser } } = await supabase.auth.getUser();
    const resolvedUserId = liveUser?.id ?? userId;

    if (!resolvedUserId) {
      console.warn('[sync] uploadAudio SKIPPED — not signed in');
      return null;
    }
    if (!projectId) {
      console.warn('[sync] uploadAudio SKIPPED — projectId is missing');
      return null;
    }
    

      const title = audioMeta.name.replace(/\.[^.]+$/, '') || 'Untitled';

      const projectOk = await upsertProject({
        id: projectId,
        user_id: resolvedUserId,
        title,
        engine_id: engineId,
        style_config: {},
        motion_config: {},
        audio_meta: audioMeta,
      });

      if (!projectOk) {
        console.error('[sync] uploadAudio — project upsert failed, aborting track upload');
        return null;
      }

      const storagePath = await uploadAudioFile(resolvedUserId, projectId, file);
      if (!storagePath) {
        console.error('[sync] uploadAudio — storage upload failed');
        return null;
      }

      await upsertTrack({
        project_id: projectId,
        user_id: resolvedUserId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type || 'audio/mpeg',
        file_size: file.size,
        duration: audioMeta.duration,
      });

      return storagePath;
    },
    [userId]
  );

  const saveExport = useCallback(
    async (projectId: string, params: ExportSyncParams): Promise<void> => {
  
      if (!userId || !projectId) {
        return;
      }

      const { exportId, exportType, aspectRatio, resolution, qualityPreset, durationSecs, blob, sizeBytes } = params;

      await upsertExportRecord({
        id: exportId,
        user_id: userId,
        project_id: projectId,
        export_type: exportType,
        aspect_ratio: aspectRatio,
        resolution,
        quality_preset: qualityPreset,
        duration_secs: durationSecs,
        storage_path: undefined,
        size_bytes: sizeBytes,
        status: 'ready',
      });

      if (blob) {
        uploadExportBlob(userId, projectId, exportId, blob, exportType as 'webm' | 'mp4')
          .then((storagePath) => {
            if (storagePath) {
              patchExportRecord(exportId, { storage_path: storagePath });
            }
          })
          .catch((err) => console.error('[sync] export blob upload failed:', err));
      }
    },
    [userId]
  );

  return { saveConfig, uploadAudio, saveExport };
}
