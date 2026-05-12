/**
 * src/app/components/MyProjects.tsx
 * 
 * Full "My Projects" view shown as a modal overlay on the landing page.
 * Shows all Supabase-synced projects with metadata, export counts, and actions.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Music, Trash2, ExternalLink, Clock, FileVideo,
  Cloud, CloudOff, Loader2, FolderOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { fetchUserProjects, fetchProjectExports, deleteDBProject, type DBProject } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import {
  X, Music, Trash2, ExternalLink, Clock, FileVideo,
  Cloud, CloudOff, Loader2, FolderOpen, Play, Share2  // ← add Play and Share2
} from 'lucide-react';
import type { DBExport } from '../lib/db';

type ProjectWithMeta = DBProject & {
  exportCount: number;
  exports: DBExport[];
};

type MyProjectsProps = {
  open: boolean;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteLocal: (projectId: string) => void;
};

export function MyProjects({ open, onClose, onOpenProject, onDeleteLocal }: MyProjectsProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load projects when modal opens
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const dbProjects = await fetchUserProjects(user.id);

        // Fetch export counts in parallel
        const withCounts = await Promise.all(
  dbProjects.map(async (p) => {
    const exports = await fetchProjectExports(p.id);
    return { ...p, exportCount: exports.length, exports };
  })
);

        if (!cancelled) setProjects(withCounts);
      } catch (err) {
        console.error('[MyProjects] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, user?.id]);

  const handleDelete = async (projectId: string) => {
    setDeletingId(projectId);
    try {
      await deleteDBProject(projectId);
      onDeleteLocal(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('[MyProjects] delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-2xl border overflow-hidden"
            style={{
              background: 'var(--surface-elevated)',
              borderColor: 'var(--surface-glass-border)',
              color: 'var(--text-strong)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--surface-glass-border)' }}
            >
              <div>
                <h2 className="text-lg font-semibold tracking-tight">My Projects</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {projects.length} project{projects.length !== 1 ? 's' : ''} synced to your account
                </p>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-md flex items-center justify-center hover:bg-black/10 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-sm">Loading your projects…</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                  <FolderOpen className="size-10 opacity-40" />
                  <p className="text-sm">No projects yet. Upload a track to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="group flex items-center gap-4 p-4 rounded-xl border transition-all hover:translate-y-[-1px] cursor-pointer"
                      style={{
                        background: 'var(--surface-glass)',
                        borderColor: 'var(--surface-glass-border)',
                      }}
                      onClick={() => { onOpenProject(p.id); onClose(); }}
                    >
                      {/* Icon */}
                      <div
                        className="size-11 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ background: 'var(--hero-cta-gradient)' }}
                      >
                        <Music className="size-5" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-2">
                          {p.audio_meta?.name ?? 'Untitled'}
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(16,185,129)' }}
                          >
                            <Cloud className="size-2.5" /> synced
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Clock className="size-3" />
                            {fmt(p.audio_meta?.duration ?? 0)}
                          </span>
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <FileVideo className="size-3" />
                            {p.exportCount} export{p.exportCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {p.engine_id}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Updated {fmtDate(p.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
  <Button
    size="sm"
    onClick={(e) => { e.stopPropagation(); onOpenProject(p.id); onClose(); }}
    className="text-white text-xs"
    style={{ background: 'var(--hero-cta-gradient)' }}
  >
    <ExternalLink className="size-3 mr-1" /> Open
  </Button>
  <button
    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
    disabled={deletingId === p.id}
    className="size-8 rounded-md flex items-center justify-center hover:bg-red-500/10 disabled:opacity-40 border"
    style={{
      borderColor: 'var(--surface-glass-border)',
      color: 'var(--text-muted)',
    }}
    title="Delete project"
  >
    {deletingId === p.id
      ? <Loader2 className="size-3.5 animate-spin" />
      : <Trash2 className="size-3.5" />
    }
  </button>
</div>
 {/* Export list — toggleable */}
              {p.exportCount > 0 && (
                <div className="w-full mt-2 pt-2 border-t" style={{ borderColor: 'var(--surface-glass-border)' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === p.id ? null : p.id);
                    }}
                    className="text-xs flex items-center gap-1 mb-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <FileVideo className="size-3" />
                    {expandedId === p.id ? 'Hide' : 'Show'} {p.exportCount} export{p.exportCount !== 1 ? 's' : ''}
                  </button>

                  {expandedId === p.id && (
                    <div className="space-y-1.5">
                      {p.exports.map((exp) => {
                        const label = [exp.aspect_ratio, exp.resolution, exp.quality_preset]
                          .filter(Boolean).join(' · ');
                        const date = new Date(exp.created_at).toLocaleDateString(
                          undefined, { month: 'short', day: 'numeric' }
                        );
                        return (
                          <div
                            key={exp.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                            style={{ background: 'var(--surface-elevated)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-strong)' }}>
                                {exp.export_type?.toUpperCase()} · {label}
                              </div>
                              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {date}{exp.size_bytes ? ` · ${(exp.size_bytes / (1024 * 1024)).toFixed(1)} MB` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {exp.storage_path ? (
                                <>
                                  {/* Play in new tab */}
                                  <PlayExportButton storagePath={exp.storage_path} />
                                </>
                              ) : (
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  processing...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
                      
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  /**
 * Fetches a signed URL for the export and opens it in a new tab.
 * Also copies the URL to clipboard on second action.
 */
function PlayExportButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    setLoading(true);
    try {
      const { getExportSignedUrl } = await import('../lib/storage');
      const url = await getExportSignedUrl(storagePath, 3600);
      if (url) {
        window.open(url, '_blank', 'noopener');
      }
    } catch (err) {
      console.error('Failed to get export URL:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    setLoading(true);
    try {
      const { getExportSignedUrl } = await import('../lib/storage');
      const url = await getExportSignedUrl(storagePath, 86400);
      if (url) await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error('Failed to copy export URL:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePlay}
        disabled={loading}
        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors hover:bg-white/5 disabled:opacity-40"
        style={{ borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}
        title="Play in new tab"
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
        Play
      </button>
      <button
        onClick={handleCopy}
        disabled={loading}
        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors hover:bg-white/5 disabled:opacity-40"
        style={{ borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}
        title="Copy link"
      >
        <Share2 className="size-3" />
        Copy
      </button>
    </div>
  );
}

  
}
