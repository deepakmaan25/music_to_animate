import { supabase } from './supabase';

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

export async function upsertProject(
  project: Omit<DBProject, 'created_at' | 'updated_at'>
): Promise<boolean> {
  console.log('[db] upsertProject called', { id: project.id, user_id: project.user_id });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  console.log('[db] auth.getUser() result:', user?.id ?? 'NULL', authErr?.message ?? 'no error');

  const { error } = await supabase
    .from('projects')
    .upsert(
      { ...project, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('[db] upsertProject FAILED:', error.message, '| code:', error.code, '| details:', error.details);
    return false;
  }
  console.log('[db] upsertProject SUCCESS:', project.id);
  return true;
}

export async function upsertTrack(
  track: Omit<DBTrack, 'created_at'>
): Promise<boolean> {
  console.log('[db] upsertTrack called', { project_id: track.project_id });

  const { error } = await supabase
    .from('project_tracks')
    .upsert(track, { onConflict: 'project_id' });

  if (error) {
    console.error('[db] upsertTrack FAILED:', error.message, '| code:', error.code);
    return false;
  }
  console.log('[db] upsertTrack SUCCESS');
  return true;
}

export async function upsertExportRecord(
  exp: Omit<DBExport, 'created_at'>
): Promise<boolean> {
  console.log('[db] upsertExportRecord called', { id: exp.id, project_id: exp.project_id });

  const { error } = await supabase
    .from('exports')
    .upsert(exp, { onConflict: 'id' });

  if (error) {
    console.error('[db] upsertExportRecord FAILED:', error.message, '| code:', error.code);
    return false;
  }
  console.log('[db] upsertExportRecord SUCCESS');
  return true;
}

export async function patchExportRecord(
  exportId: string,
  patch: Partial<Omit<DBExport, 'id' | 'user_id' | 'project_id' | 'created_at'>>
): Promise<boolean> {
  const { error } = await supabase.from('exports').update(patch).eq('id', exportId);
  if (error) { console.error('[db] patchExportRecord FAILED:', error.message); return false; }
  return true;
}

export async function fetchUserProjects(userId: string): Promise<DBProject[]> {
  console.log('[db] fetchUserProjects for userId:', userId);

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[db] fetchUserProjects FAILED:', error.message, '| code:', error.code);
    return [];
  }
  console.log('[db] fetchUserProjects returned', data?.length ?? 0, 'rows');
  return (data ?? []) as DBProject[];
}

export async function deleteDBProject(projectId: string): Promise<boolean> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) { console.error('[db] deleteDBProject FAILED:', error.message); return false; }
  return true;
}

export function dbProjectToStored(p: DBProject) {
  return {
    id: p.id,
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    audioMeta: (p.audio_meta as { name: string; duration: number; sampleRate?: number }) ?? { name: 'Unknown', duration: 0 },
    engineId: p.engine_id,
    style: (p.style_config as { palette: number }) ?? { palette: 0 },
    motion: (p.motion_config as { beatSensitivity: number; particleDensity: number; smoothing: number }) ?? { beatSensitivity: 0.7, particleDensity: 0.6, smoothing: 0.8 },
    exports: {} as Record<string, never>,
  };
}
