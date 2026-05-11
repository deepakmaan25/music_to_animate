/**
 * src/app/lib/db.ts
 *
 * Database CRUD layer — thin wrappers around Supabase queries.
 * All functions are safe to call even when the user is unauthenticated;
 * they will simply fail gracefully and return null / empty arrays.
 *
 * Table schemas are in schema.sql at the project root.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DBProject = {
  id: string;
  user_id: string;
  title: string;
  engine_id: string;
  style_config: Record<string, unknown>;
  motion_config: Record<string, unknown>;
  audio_meta: { name: string; duration: number; sampleRate?: number };
  created_at: string;
  updated_at: string;
};

export type DBTrack = {
  project_id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
  created_at: string;
};

export type DBExport = {
  id: string;
  user_id: string;
  project_id: string;
  export_type: string;
  aspect_ratio?: string;
  resolution?: string;
  quality_preset?: string;
  duration_secs?: number;
  storage_path?: string;
  size_bytes?: number;
  status: string;
  error_message?: string;
  created_at: string;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

/** Create or fully update a project row. Safe to call on every autosave. */
export async function upsertProject(
  project: Omit<DBProject, 'created_at' | 'updated_at'>
): Promise<DBProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .upsert(
      { ...project, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[db] upsertProject:', error.message);
    return null;
  }
  return data as DBProject;
}

/** Fetch all projects belonging to the authenticated user, newest first. */
export async function fetchUserProjects(userId: string): Promise<DBProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[db] fetchUserProjects:', error.message);
    return [];
  }
  return (data ?? []) as DBProject[];
}

/** Hard-delete a project (cascades to tracks + exports via FK). */
export async function deleteDBProject(projectId: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('[db] deleteDBProject:', error.message);
    return false;
  }
  return true;
}

// ─── Tracks ───────────────────────────────────────────────────────────────────

/**
 * Insert or replace the audio track for a project.
 * Uses project_id as the primary key — one track per project.
 */
export async function upsertTrack(
  track: Omit<DBTrack, 'created_at'>
): Promise<DBTrack | null> {
  const { data, error } = await supabase
    .from('project_tracks')
    .upsert(track, { onConflict: 'project_id' })
    .select()
    .single();

  if (error) {
    console.error('[db] upsertTrack:', error.message);
    return null;
  }
  return data as DBTrack;
}

/** Fetch the audio track record for a project (null if not yet uploaded). */
export async function fetchProjectTrack(projectId: string): Promise<DBTrack | null> {
  const { data, error } = await supabase
    .from('project_tracks')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.error('[db] fetchProjectTrack:', error.message);
    return null;
  }
  return data as DBTrack | null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Insert or update an export record. */
export async function upsertExportRecord(
  exp: Omit<DBExport, 'created_at'>
): Promise<DBExport | null> {
  const { data, error } = await supabase
    .from('exports')
    .upsert(exp, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[db] upsertExportRecord:', error.message);
    return null;
  }
  return data as DBExport;
}

/** Update selected fields on an export row (e.g. status, storage_path). */
export async function patchExportRecord(
  exportId: string,
  patch: Partial<Omit<DBExport, 'id' | 'user_id' | 'project_id' | 'created_at'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('exports')
    .update(patch)
    .eq('id', exportId);

  if (error) {
    console.error('[db] patchExportRecord:', error.message);
    return false;
  }
  return true;
}

/** Fetch all exports for a project, newest first. */
export async function fetchProjectExports(projectId: string): Promise<DBExport[]> {
  const { data, error } = await supabase
    .from('exports')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[db] fetchProjectExports:', error.message);
    return [];
  }
  return (data ?? []) as DBExport[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a DBProject row to the StoredProject shape used by usePersistentProjects.
 * Call this when importing remote projects into the local store.
 */
export function dbProjectToStored(p: DBProject) {
  return {
    id: p.id,
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    audioMeta: (p.audio_meta as { name: string; duration: number; sampleRate?: number }) ?? {
      name: 'Unknown',
      duration: 0,
    },
    engineId: p.engine_id,
    style: (p.style_config as { palette: number }) ?? { palette: 0 },
    motion: (p.motion_config as {
      beatSensitivity: number;
      particleDensity: number;
      smoothing: number;
    }) ?? { beatSensitivity: 0.7, particleDensity: 0.6, smoothing: 0.8 },
    exports: {} as Record<string, never>,
  };
}
