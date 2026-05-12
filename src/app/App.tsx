/**
 * App.tsx — COMPLETE REPLACEMENT
 * 
 * Changes from previous version:
 * 1. Signed-in landing shows inline My Projects section (not modal) with pagination
 * 2. Engine cards are compact horizontal scroll for signed-in users, full grid for signed-out
 * 3. Projects strip only shows when user is signed in
 * 4. Sign out shows brief loading feedback
 * 5. Each engine card preview shows style-specific animation
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, Sparkles, Wand2, Play, Download, Music, Palette, Layers, Zap,
  Heart, Music2, Clock, ArrowRight, Sun, Moon, Trash2, LogOut, Cloud,
  ChevronLeft, ChevronRight, FolderOpen, ExternalLink, FileVideo, Loader2
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Studio } from './components/Studio';
import { AuthModal } from './components/AuthModal';
import { AuthCallback } from './components/AuthCallback';
import { useTheme } from './hooks/useTheme';
import { usePersistentProjects, type StoredProject } from './hooks/usePersistentProjects';
import { useAuth } from './hooks/useAuth';
import { fetchUserProjects, deleteDBProject, dbProjectToStored } from './lib/db';

type StudioEngine = 'bars' | 'radial' | 'depth' | 'orbital' | 'terrain' | 'tunnel' | 'neon_spheres' | 'fractal' | 'solar';

const ENGINES: {
  id: string;
  studio: StudioEngine;
  name: string;
  icon: React.ReactNode;
  description: string;
  moods: string[];
  gradient: string;
  // CSS animation style identifier for the mini preview
  previewStyle: 'bars' | 'radial' | 'tunnel' | 'terrain' | 'particles' | 'rings' | 'spheres' | 'fractal' | 'solar';
}[] = [
  {
    id: 'radial_spectrum', studio: 'radial', previewStyle: 'radial',
    name: 'Radial Spectrum', icon: <Layers className="size-4" />,
    description: 'Circular frequency visualization with dynamic color shifts.',
    moods: ['High-Energy', 'Futuristic'],
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
  },
  {
    id: 'depth_field', studio: 'depth', previewStyle: 'particles',
    name: 'Depth Field', icon: <Sparkles className="size-4" />,
    description: 'Cinematic starfield that surges on every beat.',
    moods: ['Dreamy', 'Chill'],
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
  },
  {
    id: 'geometric_pulse', studio: 'bars', previewStyle: 'bars',
    name: 'Geometric Pulse', icon: <Zap className="size-4" />,
    description: 'Bold spectrum bars morphing with bass and rhythm.',
    moods: ['Aggressive', 'High-Energy'],
    gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)'
  },
  {
    id: 'neon_tunnel', studio: 'tunnel', previewStyle: 'tunnel',
    name: 'Neon Tunnel', icon: <Wand2 className="size-4" />,
    description: 'Glowing hexagonal tunnel pulsing with bass.',
    moods: ['Futuristic', 'High-Energy'],
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)'
  },
  {
    id: 'audio_terrain', studio: 'terrain', previewStyle: 'terrain',
    name: 'Audio Terrain', icon: <Music2 className="size-4" />,
    description: 'Wireframe landscape that rises with your track.',
    moods: ['Cinematic', 'Instrumental'],
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'
  },
  {
    id: 'orbital_rings', studio: 'orbital', previewStyle: 'rings',
    name: 'Orbital Rings', icon: <Layers className="size-4" />,
    description: 'Concentric rings tilt and pulse around a neon core.',
    moods: ['Dreamy', 'Futuristic'],
    gradient: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)'
  },
  {
    id: 'neon_spheres', studio: 'neon_spheres', previewStyle: 'spheres',
    name: 'Neon Spheres', icon: <Sparkles className="size-4" />,
    description: 'Glowing spheres wobbling with each frequency band.',
    moods: ['Dreamy', 'Vocal-Heavy'],
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)'
  },
  {
    id: 'fractal_kaleido', studio: 'fractal', previewStyle: 'fractal',
    name: 'Kaleidoscope', icon: <Palette className="size-4" />,
    description: 'Mirrored fractal patterns synced to music energy.',
    moods: ['Trippy', 'Instrumental'],
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)'
  },
  {
    id: 'solar_system', studio: 'solar', previewStyle: 'solar',
    name: 'Solar System', icon: <Zap className="size-4" />,
    description: 'Central sun with orbiting planets; flares on bass.',
    moods: ['Cinematic', 'Futuristic'],
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
  },
];

const PROJECTS_PER_PAGE = 6;

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }
  return <LandingApp />;
}

function LandingApp() {
  const { theme, toggle: toggleTheme } = useTheme();
  const persist = usePersistentProjects();
  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [cloudProjectIds, setCloudProjectIds] = useState<Set<string>>(new Set());
  const [projectPage, setProjectPage] = useState(0);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  // Sync projects on login
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setProjectPage(0);

    (async () => {
      setSyncStatus('syncing');
      try {
        const dbProjects = await fetchUserProjects(user.id);
        if (!cancelled) {
          const ids = new Set<string>();
          for (const p of dbProjects) {
            persist.importProject(dbProjectToStored(p));
            ids.add(p.id);
          }
          setCloudProjectIds(ids);
          setSyncStatus('synced');
        }
      } catch (e) {
        if (!cancelled) setSyncStatus('error');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [view, setView] = useState<'landing' | 'studio'>('landing');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(persist.lastOpenedProjectId);
  const [studioEngine, setStudioEngine] = useState<StudioEngine>('bars');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = (engine?: StudioEngine) => {
    if (engine) setStudioEngine(engine);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPendingFile(file); setActiveProjectId(null); setView('studio'); }
    e.target.value = '';
  };

  const openExisting = (id: string) => {
    setActiveProjectId(id); setPendingFile(null);
    persist.setLastOpened(id); setView('studio');
  };

  const handleDeleteProject = useCallback(async (id: string) => {
    persist.deleteProject(id);
    setCloudProjectIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    if (user?.id) await deleteDBProject(id);
  }, [persist, user?.id]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setCloudProjectIds(new Set());
    setSyncStatus('idle');
    setProjectPage(0);
    setSigningOut(false);
  };

  // Only show projects for signed-in users
  const projectList = useMemo(() => {
    if (!user?.id) return [];
    return Object.values(persist.projects).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [persist.projects, user?.id]);

  const totalPages = Math.ceil(projectList.length / PROJECTS_PER_PAGE);
  const pagedProjects = projectList.slice(
    projectPage * PROJECTS_PER_PAGE,
    (projectPage + 1) * PROJECTS_PER_PAGE
  );

  if (view === 'studio') {
    return (
      <Studio
        initialFile={pendingFile}
        initialEngine={studioEngine}
        projectId={activeProjectId}
        persist={persist}
        onBack={() => setView('landing')}
      />
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen transition-colors duration-300"
      style={{ background: 'var(--hero-bg-gradient)', color: 'var(--text-strong)' }}>

      <input
        ref={fileInputRef}
        type="file"
        accept={isIOS ? undefined : 'audio/*,audio/mpeg,.mp3,.m4a,.wav,.flac,.ogg'}
        hidden
        onChange={onFileSelected}
      />

      {/* Grid backdrop */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)'
      }} />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl border-b transition-colors"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--surface-glass-border)' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md shrink-0"
              style={{ background: 'var(--hero-cta-gradient)', boxShadow: 'var(--accent-glow)' }} />
            <span className="font-semibold tracking-tight">Visualizer</span>
            <span className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded uppercase tracking-wider"
              style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)' }}>
              Beta
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <button
                  onClick={() => document.getElementById('my-projects')?.scrollIntoView({ behavior: 'smooth' })}
                  className="size-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                  style={{ background: 'var(--hero-cta-gradient)' }}
                  title={user.email ?? 'My Projects'}
                >
                  {(user.email || '?').slice(0, 1).toUpperCase()}
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs disabled:opacity-60 transition-opacity"
                  style={{
                    background: 'var(--surface-elevated)',
                    borderColor: 'var(--surface-glass-border)',
                    color: 'var(--text-muted)',
                  }}
                  aria-label="Sign out"
                >
                  {signingOut
                    ? <><Loader2 className="size-3.5 animate-spin" /><span className="hidden sm:inline">Signing out…</span></>
                    : <><LogOut className="size-3.5" /><span className="hidden sm:inline">Sign out</span></>
                  }
                </button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setAuthOpen(true)}
                className="h-8 text-sm px-3" style={{ color: 'var(--text-strong)' }}>
                Sign in
              </Button>
            )}
            <Button onClick={() => openPicker()}
              className="h-8 text-sm text-white px-3"
              style={{ background: 'var(--hero-cta-gradient)' }}>
              <Upload className="size-3.5 mr-1" />
              <span className="hidden sm:inline">New project</span>
              <span className="sm:hidden">New</span>
            </Button>
            <button onClick={toggleTheme} aria-label="Toggle dark mode"
              className="size-8 rounded-full border flex items-center justify-center shrink-0"
              style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)', color: 'var(--text-strong)' }}>
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 size-[600px] rounded-full blur-[100px] opacity-40 pointer-events-none"
            style={{ background: 'var(--hero-cta-gradient)' }} />

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }} className="relative text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-8 rounded-full text-xs border backdrop-blur-sm"
              style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}>
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI-powered audio visualization
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.04em] mb-6 leading-[0.95]"
              style={{ color: 'var(--text-strong)' }}>
              Your sound,<br />
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'var(--hero-cta-gradient)' }}>
                visualized.
              </span>
            </h1>

            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
              style={{ color: 'var(--text-muted)' }}>
              Upload any track. Get a beat-perfect, studio-grade visual in seconds.
              No timeline. No keyframes. Just music.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button size="lg" onClick={() => openPicker()}
                className="text-white px-8 h-14 text-base rounded-xl shadow-lg group transition-all hover:scale-[1.02]"
                style={{ background: 'var(--hero-cta-gradient)', boxShadow: 'var(--accent-glow)' }}>
                <Upload className="size-5 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                Upload your track
                <ArrowRight className="size-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              {!user && (
                <button onClick={() => setAuthOpen(true)}
                  className="px-6 h-14 text-base rounded-xl border transition-colors"
                  style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)', color: 'var(--text-strong)' }}>
                  Sign in to save projects
                </button>
              )}
            </div>
            <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
              Drop MP3, WAV, or FLAC · up to 100 MB · runs in your browser
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── MY PROJECTS (signed-in only, inline) ──────────────────────── */}
      {user && (
        <section id="my-projects" className="relative px-6 pb-16">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] font-medium mb-1"
                  style={{ color: 'var(--text-muted)' }}>
                  {syncStatus === 'syncing' ? 'Syncing…' : 'Your projects'}
                </div>
                <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-strong)' }}>
                  {projectList.length === 0 ? 'No projects yet' : `${projectList.length} saved project${projectList.length !== 1 ? 's' : ''}`}
                </h2>
              </div>
              <Button onClick={() => openPicker()}
                className="text-white" style={{ background: 'var(--hero-cta-gradient)' }}>
                <Upload className="size-4 mr-2" /> New project
              </Button>
            </div>

            {/* Empty state */}
            {projectList.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 rounded-2xl border"
                style={{ borderColor: 'var(--surface-glass-border)', background: 'var(--surface-elevated)' }}>
                <FolderOpen className="size-10 opacity-30 mb-3" />
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  Upload your first track to get started
                </p>
                <Button onClick={() => openPicker()}
                  className="text-white" style={{ background: 'var(--hero-cta-gradient)' }}>
                  <Upload className="size-4 mr-2" /> Upload a track
                </Button>
              </motion.div>
            )}

            {/* Project grid */}
            {pagedProjects.length > 0 && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={projectPage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {pagedProjects.map((p) => (
                    <InlineProjectCard
                      key={p.id}
                      project={p}
                      isSynced={cloudProjectIds.has(p.id)}
                      onOpen={() => openExisting(p.id)}
                      onDelete={() => handleDeleteProject(p.id)}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setProjectPage((p) => Math.max(0, p - 1))}
                  disabled={projectPage === 0}
                  className="size-9 rounded-lg border flex items-center justify-center disabled:opacity-40 transition-opacity"
                  style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)', color: 'var(--text-strong)' }}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Page {projectPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setProjectPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={projectPage === totalPages - 1}
                  className="size-9 rounded-lg border flex items-center justify-center disabled:opacity-40 transition-opacity"
                  style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)', color: 'var(--text-strong)' }}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="relative py-20 px-6" style={{ background: 'var(--section-bg)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionHeader eyebrow="How it works" title="Three steps to magic." />
          <div className="grid md:grid-cols-3 gap-4 mt-12">
            {[
              { step: '01', title: 'Upload your audio', copy: 'Drop any MP3, WAV, or FLAC. We auto-detect tempo, energy, and emotional peaks.', eta: '≈ 10 sec', icon: <Upload className="size-5" /> },
              { step: '02', title: 'Choose your vibe', copy: 'Pick an engine that matches your mood, then dial in colors, motion, and intensity.', eta: '≈ 20 sec', icon: <Palette className="size-5" /> },
              { step: '03', title: 'Export & share', copy: 'Render in 9:16, 1:1, or 16:9 — optimized for TikTok, Reels, and YouTube.', eta: '≈ 30–60 sec', icon: <Download className="size-5" /> },
            ].map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="h-full p-6 rounded-2xl border transition-all hover:translate-y-[-2px]"
                  style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="size-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--surface-glass)', color: 'var(--text-strong)' }}>
                      {item.icon}
                    </div>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 tracking-tight" style={{ color: 'var(--text-strong)' }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>{item.copy}</p>
                  <div className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
                    style={{ background: 'var(--surface-glass)', color: 'var(--text-muted)' }}>
                    <Clock className="size-3" /> {item.eta}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VISUAL ENGINES ────────────────────────────────────────────── */}
      <section id="engines" className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader eyebrow="Visual engines" title="9 distinct styles. Pick your vibe." />

          {/* Compact engine grid — 3 columns on desktop, 2 on tablet, 1 on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-10">
            {ENGINES.map((engine, i) => (
              <motion.div key={engine.id}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.03 }}>
                <CompactEngineCard engine={engine} onUse={() => openPicker(engine.studio)} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl border overflow-hidden p-12 text-center"
            style={{ background: 'var(--hero-cta-gradient)', borderColor: 'var(--surface-glass-border)', boxShadow: 'var(--accent-glow)' }}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
                Ready to bring your sound to life?
              </h2>
              <p className="text-white/85 mb-8 max-w-xl mx-auto">
                Every project keeps your settings, sections, and export history in one place.
              </p>
              <Button size="lg" onClick={() => openPicker()}
                className="bg-white text-gray-900 hover:bg-white/90 px-8 h-12 rounded-xl">
                <Sparkles className="size-4 mr-2" />
                Start a project — free
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <footer className="relative py-10 px-6 border-t"
        style={{ borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded" style={{ background: 'var(--hero-cta-gradient)' }} />
            <span>© 2026 Visualizer</span>
          </div>
          <div className="flex gap-6">
            <span>Privacy</span><span>Terms</span><span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Inline project card (for signed-in landing section) ─────────────────────

function InlineProjectCard({
  project, isSynced, onOpen, onDelete
}: { project: StoredProject; isSynced: boolean; onOpen: () => void; onDelete: () => void }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const exportCount = Object.keys(project.exports).length;
  const engine = ENGINES.find((e) => e.studio === project.engineId) ?? ENGINES[0];

  return (
    <div
      className="group relative p-4 rounded-xl border cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-lg"
      style={{ background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)' }}
      onClick={onOpen}
    >
      {/* Color bar at top matching engine gradient */}
      <div className="h-1 rounded-full mb-4 w-full" style={{ background: engine.gradient }} />

      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: engine.gradient }}>
          <Music className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
            {project.audioMeta.name.replace(/\.[^.]+$/, '')}
            {isSynced && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(16,185,129)' }}>
                <Cloud className="size-2.5" /> synced
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Clock className="size-3" /> {fmt(project.audioMeta.duration)}
            </span>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <FileVideo className="size-3" /> {exportCount} export{exportCount !== 1 ? 's' : ''}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {engine.name}
            </span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t"
        style={{ borderColor: 'var(--surface-glass-border)' }}>
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="flex-1 text-white text-xs h-8"
          style={{ background: 'var(--hero-cta-gradient)' }}>
          <ExternalLink className="size-3 mr-1" /> Open
        </Button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="size-8 rounded-md border flex items-center justify-center hover:bg-red-500/10 transition-colors"
          style={{ borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}
          title="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Compact engine card with style-specific animation preview ────────────────

function CompactEngineCard({ engine, onUse }: { engine: typeof ENGINES[number]; onUse: () => void }) {
  return (
    <div
      className="group flex items-center gap-4 p-4 rounded-xl border transition-all hover:translate-y-[-2px] cursor-pointer"
      style={{ background: 'var(--engine-card-bg)', borderColor: 'var(--engine-card-border)' }}
      onClick={onUse}
    >
      {/* Mini animated preview */}
      <div className="size-14 rounded-xl shrink-0 overflow-hidden relative"
        style={{ background: engine.gradient }}>
        <EnginePreview style={engine.previewStyle} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ color: 'var(--text-muted)' }}>{engine.icon}</span>
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text-strong)' }}>
            {engine.name}
          </span>
        </div>
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {engine.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {engine.moods.map((m) => (
            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)' }}>
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Use button — visible on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onUse(); }}
          className="text-white text-xs"
          style={{ background: 'var(--hero-cta-gradient)' }}>
          Use
        </Button>
      </div>
    </div>
  );
}

// ─── Engine preview animations (pure CSS, no audio needed) ───────────────────

function EnginePreview({ style }: { style: string }) {
  const bars = [0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.35];

  if (style === 'bars') {
    return (
      <div className="absolute inset-0 flex items-end justify-center gap-[2px] px-2 pb-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm bg-white/70"
            style={{
              height: `${h * 80}%`,
              animation: `pulse ${0.6 + i * 0.1}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.08}s`,
            }} />
        ))}
        <style>{`@keyframes pulse { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>
      </div>
    );
  }

  if (style === 'radial') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {[18, 13, 8].map((r, i) => (
          <div key={i} className="absolute rounded-full border border-white/50"
            style={{
              width: r * 2.5, height: r * 2.5,
              animation: `radialPulse ${1 + i * 0.3}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.2}s`,
            }} />
        ))}
        <div className="size-3 rounded-full bg-white/80" />
        <style>{`@keyframes radialPulse { from { transform: scale(0.85); opacity: 0.5; } to { transform: scale(1.1); opacity: 1; } }`}</style>
      </div>
    );
  }

  if (style === 'tunnel') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {[24, 18, 12, 7].map((r, i) => (
          <div key={i} className="absolute rounded-full border border-white/60"
            style={{
              width: r * 2, height: r * 2,
              animation: `tunnelZoom 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.35}s`,
            }} />
        ))}
        <style>{`@keyframes tunnelZoom { 0%,100% { transform: scale(1); opacity:0.8; } 50% { transform: scale(1.15); opacity:0.4; } }`}</style>
      </div>
    );
  }

  if (style === 'terrain') {
    return (
      <div className="absolute inset-0 flex items-end">
        <svg viewBox="0 0 56 28" className="w-full" fill="none">
          <polyline points="0,22 7,16 14,20 21,10 28,14 35,8 42,12 49,6 56,10"
            stroke="white" strokeOpacity="0.7" strokeWidth="1.5"
            style={{ animation: 'terrainShift 2s ease-in-out infinite alternate' }} />
          <polyline points="0,26 7,22 14,24 21,18 28,22 35,16 42,20 49,14 56,18"
            stroke="white" strokeOpacity="0.4" strokeWidth="1" />
          <style>{`@keyframes terrainShift { from { transform: translateY(0); } to { transform: translateY(-3px); } }`}</style>
        </svg>
      </div>
    );
  }

  if (style === 'particles') {
    return (
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              left: `${15 + (i * 9) % 70}%`,
              top: `${20 + (i * 13) % 60}%`,
              opacity: 0.4 + (i % 4) * 0.15,
              animation: `float ${1.5 + i * 0.2}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.15}s`,
            }} />
        ))}
        <style>{`@keyframes float { from { transform: translateY(0) translateX(0); } to { transform: translateY(-5px) translateX(3px); } }`}</style>
      </div>
    );
  }

  if (style === 'rings') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {[22, 15, 8].map((r, i) => (
          <div key={i} className="absolute rounded-full border border-white/60"
            style={{
              width: r * 2, height: r * 2,
              transform: `rotate(${i * 20}deg) scaleY(0.5)`,
              animation: `ringTilt ${2 + i * 0.5}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.3}s`,
            }} />
        ))}
        <div className="size-2.5 rounded-full bg-white/90" />
        <style>{`@keyframes ringTilt { from { transform: rotate(0deg) scaleY(0.45); } to { transform: rotate(15deg) scaleY(0.6); } }`}</style>
      </div>
    );
  }

  if (style === 'spheres') {
    return (
      <div className="absolute inset-0">
        {[
          { x: 25, y: 40, s: 10, d: '0s' },
          { x: 55, y: 30, s: 8,  d: '0.3s' },
          { x: 75, y: 55, s: 7,  d: '0.6s' },
        ].map((sp, i) => (
          <div key={i} className="absolute rounded-full bg-white/70"
            style={{
              width: sp.s, height: sp.s,
              left: `${sp.x}%`, top: `${sp.y}%`,
              boxShadow: '0 0 8px 2px rgba(255,255,255,0.5)',
              animation: `sphereBounce 1.5s ease-in-out infinite alternate`,
              animationDelay: sp.d,
            }} />
        ))}
        <style>{`@keyframes sphereBounce { from { transform: translateY(0) scale(1); } to { transform: translateY(-6px) scale(1.2); } }`}</style>
      </div>
    );
  }

  if (style === 'fractal') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 45, 90, 135].map((angle, i) => (
          <div key={i} className="absolute"
            style={{
              width: 2, height: 20,
              background: 'rgba(255,255,255,0.7)',
              transformOrigin: 'bottom center',
              transform: `rotate(${angle}deg)`,
              top: '50%', left: '50%',
              marginLeft: -1, marginTop: -20,
              animation: `fractalSpin 3s linear infinite`,
              animationDelay: `${i * 0.1}s`,
            }} />
        ))}
        <div className="size-2 rounded-full bg-white/80 relative z-10" />
        <style>{`@keyframes fractalSpin { from { transform: rotate(var(--r, 0deg)); } to { transform: rotate(calc(var(--r, 0deg) + 360deg)); } }`}</style>
      </div>
    );
  }

  if (style === 'solar') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="size-5 rounded-full bg-white/80"
          style={{ boxShadow: '0 0 12px 4px rgba(255,200,50,0.6)', animation: 'sunPulse 1.5s ease-in-out infinite alternate' }} />
        {[16, 22].map((r, i) => (
          <div key={i} className="absolute rounded-full border border-white/30"
            style={{ width: r * 2, height: r * 2 }}>
            <div className="absolute size-2.5 rounded-full bg-white/70"
              style={{
                top: '50%', left: '100%',
                marginTop: -5, marginLeft: -5,
                animation: `orbit ${1.5 + i}s linear infinite`,
              }} />
          </div>
        ))}
        <style>{`
          @keyframes sunPulse { from { box-shadow: 0 0 8px 3px rgba(255,200,50,0.5); } to { box-shadow: 0 0 16px 6px rgba(255,200,50,0.8); } }
          @keyframes orbit { from { transform: rotate(0deg) translateX(0); } to { transform: rotate(360deg) translateX(0); } }
        `}</style>
      </div>
    );
  }

  return null;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-[0.18em] font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text-strong)' }}>
        {title}
      </h2>
    </div>
  );
}
