import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'mag-projects-v1';

export type StoredExport = {
  id: string;
  createdAt: number;
  type: 'webm' | 'mp4';
  status: 'recording' | 'transcoding' | 'rendering' | 'ready' | 'error';
  aspectRatio: string;
  resolution: string;
  duration: number;
  qualityPreset: string;
  remoteUrl?: string;
  errorMessage?: string;
  sizeBytes?: number;
};

export type StoredProject = {
  id: string;
  createdAt: number;
  updatedAt: number;
  audioMeta: {
    name: string;
    duration: number;
    sampleRate?: number;
  };
  engineId: string;
  style: { palette: number };
  motion: { beatSensitivity: number; particleDensity: number; smoothing: number };
  exports: Record<string, StoredExport>;
};

type Store = {
  projects: Record<string, StoredProject>;
  lastOpenedProjectId: string | null;
};

const empty: Store = { projects: {}, lastOpenedProjectId: null };

function readStore(): Store {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { projects: parsed.projects ?? {}, lastOpenedProjectId: parsed.lastOpenedProjectId ?? null };
  } catch {
    return empty;
  }
}

export function usePersistentProjects() {
  const [store, setStore] = useState<Store>(readStore);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write
  useEffect(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } catch {
        // quota exceeded — exports are metadata-only so this should be small
      }
    }, 200);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [store]);

  const createProject = useCallback((audioMeta: StoredProject['audioMeta'], engineId: string): StoredProject => {
    const id = `prj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const project: StoredProject = {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      audioMeta,
      engineId,
      style: { palette: 0 },
      motion: { beatSensitivity: 0.7, particleDensity: 0.6, smoothing: 0.8 },
      exports: {}
    };
    setStore((s) => ({ projects: { ...s.projects, [id]: project }, lastOpenedProjectId: id }));
    return project;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<StoredProject>) => {
    setStore((s) => {
      const cur = s.projects[id];
      if (!cur) return s;
      return {
        ...s,
        projects: { ...s.projects, [id]: { ...cur, ...patch, updatedAt: Date.now() } }
      };
    });
  }, []);

  const addExport = useCallback((projectId: string, exp: StoredExport) => {
    setStore((s) => {
      const cur = s.projects[projectId];
      if (!cur) return s;
      return {
        ...s,
        projects: {
          ...s.projects,
          [projectId]: { ...cur, exports: { ...cur.exports, [exp.id]: exp }, updatedAt: Date.now() }
        }
      };
    });
  }, []);

  const updateExport = useCallback((projectId: string, exportId: string, patch: Partial<StoredExport>) => {
    setStore((s) => {
      const cur = s.projects[projectId];
      if (!cur) return s;
      const ex = cur.exports[exportId];
      if (!ex) return s;
      return {
        ...s,
        projects: {
          ...s.projects,
          [projectId]: {
            ...cur,
            exports: { ...cur.exports, [exportId]: { ...ex, ...patch } },
            updatedAt: Date.now()
          }
        }
      };
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setStore((s) => {
      const next = { ...s.projects };
      delete next[id];
      return {
        projects: next,
        lastOpenedProjectId: s.lastOpenedProjectId === id ? null : s.lastOpenedProjectId
      };
    });
  }, []);

  const setLastOpened = useCallback((id: string | null) => {
    setStore((s) => ({ ...s, lastOpenedProjectId: id }));
  }, []);

  return {
    projects: store.projects,
    lastOpenedProjectId: store.lastOpenedProjectId,
    createProject,
    updateProject,
    addExport,
    updateExport,
    deleteProject,
    setLastOpened
  };
}
