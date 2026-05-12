import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, Sparkles, Wand2, Play, Download, Music, Palette, Layers, Zap,
  Heart, Music2, Clock, ArrowRight, Sun, Moon, Trash2, LogOut, Cloud, CloudOff
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
import { MyProjects } from './components/MyProjects';


type EngineId = 'bars' | 'radial' | 'depth' | 'orbital' | 'terrain' | 'tunnel' | 'neon_spheres' | 'fractal' | 'solar';
type StudioEngine = 'bars' | 'radial' | 'depth' | 'orbital' | 'terrain' | 'tunnel' | 'neon_spheres' | 'fractal' | 'solar';

const ENGINES: {
  id: string;
  studio: StudioEngine;
  name: string;
  icon: React.ReactNode;
  description: string;
  moods: string[];
  genres: string[];
  gradient: string;
}[] = [
  {
    id: 'radial_spectrum', studio: 'radial',
    name: 'Radial Spectrum', icon: <Layers className="size-5" />,
    description: 'Circular frequency visualization with dynamic color shifts.',
    moods: ['High-Energy', 'Futuristic'], genres: ['EDM', 'Electronic'],
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
  },
  {
    id: 'depth_field', studio: 'depth',
    name: 'Depth Field', icon: <Sparkles className="size-5" />,
    description: 'Cinematic starfield that surges and sparkles on every beat.',
    moods: ['Dreamy', 'Chill'], genres: ['Ambient', 'Lo-fi'],
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
  },
  {
    id: 'geometric_pulse', studio: 'bars',
    name: 'Geometric Pulse', icon: <Zap className="size-5" />,
    description: 'Bold shapes morphing with bass and rhythm.',
    moods: ['Aggressive', 'High-Energy'], genres: ['Hip-Hop', 'Trap'],
    gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)'
  },
  {
    id: 'neon_tunnel', studio: 'tunnel',
    name: 'Neon Tunnel', icon: <Wand2 className="size-5" />,
    description: 'Glowing hexagonal tunnel that pulses and zooms with bass.',
    moods: ['Futuristic', 'High-Energy'], genres: ['EDM', 'Synthwave'],
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)'
  },
  {
    id: 'audio_terrain', studio: 'terrain',
    name: 'Audio Terrain', icon: <Music2 className="size-5" />,
    description: 'Cinematic wireframe landscape that rises and ripples with your track.',
    moods: ['Cinematic', 'Instrumental'], genres: ['Post-Rock', 'Ambient'],
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'
  },
  {
    id: 'orbital_rings', studio: 'orbital',
    name: 'Orbital Rings', icon: <Layers className="size-5" />,
    description: 'Concentric glowing rings that tilt and pulse around a neon core.',
    moods: ['Dreamy', 'Futuristic'], genres: ['Electronic', 'Ambient'],
    gradient: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)'
  },
  {
    id: 'neon_spheres', studio: 'neon_spheres',
    name: 'Neon Spheres', icon: <Sparkles className="size-5" />,
    description: 'Glowing neon spheres that wobble and scale with each frequency band.',
    moods: ['Dreamy', 'Vocal-Heavy'], genres: ['Pop', 'Indie'],
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)'
  },
  {
    id: 'fractal_kaleido', studio: 'fractal',
    name: 'Kaleidoscope', icon: <Palette className="size-5" />,
    description: 'Trippy mirrored fractal patterns synchronized with music energy.',
    moods: ['Trippy', 'Instrumental'], genres: ['Experimental', 'Psytrance'],
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)'
  },
  {
    id: 'solar_system', studio: 'solar',
    name: 'Solar System', icon: <Zap className="size-5" />,
    description: 'Central sun with orbiting planets; flares erupt on every bass hit.',
    moods: ['Cinematic', 'Futuristic'], genres: ['Sci-Fi', 'Electronic'],
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
  },
];

const MOOD_FILTERS = ['All', 'High-Energy', 'Chill', 'Dreamy', 'Futuristic', 'Trippy', 'Cinematic', 'Instrumental'];

/**
 * Top-level router wrapper — no hooks here, just a path check.
 * Keeps hook call order stable regardless of which branch renders.
 */
export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }
  return <LandingApp />;
}

/** All landing-page + studio logic lives here so hooks always run in the same order. */
function LandingApp() {
  const { theme, toggle: toggleTheme } = useTheme();
  const persist = usePersistentProjects();
  const { user, session, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [myProjectsOpen, setMyProjectsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // On login, push local projects to server + pull remote ones
   // Track which project IDs are confirmed synced to Supabase
  const [cloudProjectIds, setCloudProjectIds] = useState<Set<string>>(new Set());
 
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
 
    (async () => {
      setSyncStatus('syncing');
      try {
        // Pull the user's projects from Supabase DB
        const dbProjects = await fetchUserProjects(user.id);
 
        if (!cancelled) {
          const ids = new Set<string>();
          for (const p of dbProjects) {
            // Merge into local store (importProject skips if id already exists)
            persist.importProject(dbProjectToStored(p));
            ids.add(p.id);
          }
          setCloudProjectIds(ids);
          setSyncStatus('synced');
        }
      } catch (e) {
        console.error('[sync] project fetch failed:', e);
        if (!cancelled) setSyncStatus('error');
      }
    })();
 
    return () => { cancelled = true; };
    // NOTE: we only sync on login (user.id change), not on every session token refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  

   const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  const [view, setView] = useState<'landing' | 'studio'>('landing');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(persist.lastOpenedProjectId);
  const [studioEngine, setStudioEngine] = useState<StudioEngine>('bars');
  const [activeMood, setActiveMood] = useState('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = (engine?: StudioEngine) => {
    if (engine) setStudioEngine(engine);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setActiveProjectId(null);
      setView('studio');
    }
    e.target.value = '';
  };

  const openExisting = (id: string) => {
    setActiveProjectId(id);
    setPendingFile(null);
    persist.setLastOpened(id);
    setView('studio');
  };

    const handleDeleteProject = useCallback(
    async (id: string) => {
      persist.deleteProject(id);
      setCloudProjectIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      if (user?.id) {
        await deleteDBProject(id);
      }
    },
    [persist, user?.id]
  );

  const filteredEngines = useMemo(() => {
    if (activeMood === 'All') return ENGINES;
    return ENGINES.filter((e) => e.moods.includes(activeMood));
  }, [activeMood]);

  const projectList = Object.values(persist.projects).sort((a, b) => b.updatedAt - a.updatedAt);

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
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ background: 'var(--hero-bg-gradient)', color: 'var(--text-strong)' }}
    >
      <input
  ref={fileInputRef}
  type="file"
  // On iOS we drop `accept` entirely because Safari often greys out valid audio files.
  // On other platforms we still filter to common audio types/extensions.
  accept={isIOS ? undefined : 'audio/*,audio/mpeg,.mp3,.m4a,.wav,.flac,.ogg'}
  hidden
  onChange={onFileSelected}
/>

      {/* Subtle grid backdrop */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)'
        }}
      />

      {/* Nav */}
      <nav
        className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl border-b transition-colors"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--surface-glass-border)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="size-7 rounded-md"
              style={{ background: 'var(--hero-cta-gradient)', boxShadow: 'var(--accent-glow)' }}
            />
            <span className="font-semibold tracking-tight">Visualizer</span>
            <span
              className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded uppercase tracking-wider"
              style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)' }}
            >
              Beta
            </span>
          </div>

          <div className="flex items-center gap-1.5">
  {user ? (
    <div className="flex items-center gap-1">
      {/* Avatar — always visible, opens My Projects */}
      <button
        onClick={() => setMyProjectsOpen(true)}
        className="size-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
        style={{ background: 'var(--hero-cta-gradient)' }}
        title="My Projects"
      >
        {(user.email || '?').slice(0, 1).toUpperCase()}
      </button>
      {/* Sign out — always visible on all sizes */}
      <button
        onClick={signOut}
        className="size-8 rounded-md border flex items-center justify-center shrink-0"
        style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--surface-glass-border)',
          color: 'var(--text-muted)',
        }}
        aria-label="Sign out"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  ) : (
    <Button
      variant="ghost"
      onClick={() => setAuthOpen(true)}
      className="h-8 text-sm px-3"
      style={{ color: 'var(--text-strong)' }}
    >
      Sign in
    </Button>
  )}
  <Button
    onClick={() => openPicker()}
    className="h-8 text-sm text-white px-3"
    style={{ background: 'var(--hero-cta-gradient)' }}
  >
    <Upload className="size-3.5 mr-1.5" />
    <span className="hidden sm:inline">New project</span>
    <span className="sm:hidden">New</span>
  </Button>
  <button
    onClick={toggleTheme}
    aria-label="Toggle dark mode"
    className="size-8 rounded-full border flex items-center justify-center shrink-0"
    style={{
      background: 'var(--surface-elevated)',
      borderColor: 'var(--surface-glass-border)',
      color: 'var(--text-strong)'
    }}
  >
    {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
  </button>
</div>
 
                {/* Mobile: just avatar + sign out */}
                <div className="flex sm:hidden items-center gap-1">
                  <button
                    onClick={() => setMyProjectsOpen(true)}
                    className="size-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: 'var(--hero-cta-gradient)' }}
                    title="My Projects"
                  >
                    {(user.email || '?').slice(0, 1).toUpperCase()}
                  </button>
                  <button
                    onClick={signOut}
                    className="size-8 rounded-md flex items-center justify-center border"
                    style={{
                      background: 'var(--surface-elevated)',
                      borderColor: 'var(--surface-glass-border)',
                      color: 'var(--text-muted)',
                    }}
                    aria-label="Sign out"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setAuthOpen(true)}
                className="h-9 hidden sm:inline-flex"
                style={{ color: 'var(--text-strong)' }}
              >
                Sign in
              </Button>
            )}
            
            <Button
              onClick={() => openPicker()}
              className="h-9 text-white"
              style={{ background: 'var(--hero-cta-gradient)' }}
            >
              <Upload className="size-4 mr-2" /> New project
            </Button>
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="size-9 rounded-full border flex items-center justify-center transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: 'var(--surface-elevated)',
                borderColor: 'var(--surface-glass-border)',
                color: 'var(--text-strong)'
              }}
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto relative">
          {/* glow orb */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 size-[600px] rounded-full blur-[100px] opacity-40 pointer-events-none"
            style={{ background: 'var(--hero-cta-gradient)' }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative text-center"
          >
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-8 rounded-full text-xs border backdrop-blur-sm"
              style={{
                background: 'var(--surface-elevated)',
                borderColor: 'var(--surface-glass-border)',
                color: 'var(--text-muted)'
              }}
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI-powered audio visualization
            </div>

            <h1
              className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.04em] mb-6 leading-[0.95]"
              style={{ color: 'var(--text-strong)' }}
            >
              Your sound,
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'var(--hero-cta-gradient)' }}
              >
                visualized.
              </span>
            </h1>

            <p
              className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              Upload any track. Get a beat-perfect, studio-grade visual in seconds.
              No timeline. No keyframes. Just music.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button
                size="lg"
                onClick={() => openPicker()}
                className="text-white px-8 h-14 text-base rounded-xl shadow-lg group transition-all hover:scale-[1.02]"
                style={{ background: 'var(--hero-cta-gradient)', boxShadow: 'var(--accent-glow)' }}
              >
                <Upload className="size-5 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                Upload your track
                <ArrowRight className="size-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <button
                onClick={() => document.getElementById('engines')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 h-14 text-base rounded-xl border transition-colors"
                style={{
                  background: 'var(--surface-elevated)',
                  borderColor: 'var(--surface-glass-border)',
                  color: 'var(--text-strong)'
                }}
              >
                Browse engines
              </button>
            </div>

            <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
              Drop MP3, WAV, or FLAC · up to 100 MB · runs in your browser
            </p>
          </motion.div>

          {/* Recent projects strip */}
          {projectList.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mt-16"
            >

                 <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
                  Your projects
                </div>
                <button
                  onClick={() => setMyProjectsOpen(true)}
                  className="text-xs hover:underline transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  View all ({projectList.length})
                </button>
              </div>              
              
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
               {projectList.slice(0, 6).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    isSynced={cloudProjectIds.has(p.id)}
                    onOpen={() => openExisting(p.id)}
                    onDelete={() => handleDeleteProject(p.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* THREE STEPS */}
      <section className="relative py-24 px-6" style={{ background: 'var(--section-bg)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionHeader eyebrow="How it works" title="Three steps to magic." />

          <div className="grid md:grid-cols-3 gap-4 mt-12">
            {[
              {
                step: '01', title: 'Upload your audio',
                copy: 'Drop any MP3, WAV, or FLAC. We auto-detect tempo, energy, and emotional peaks.',
                eta: '≈ 10 sec', icon: <Upload className="size-5" />
              },
              {
                step: '02', title: 'Choose your vibe',
                copy: 'Pick an engine that matches your track\u2019s mood, then dial in colors, motion, and intensity.',
                eta: '≈ 20 sec', icon: <Palette className="size-5" />
              },
              {
                step: '03', title: 'Export & share',
                copy: 'Render in 9:16, 1:1, or 16:9 — optimized for TikTok, Reels, and YouTube.',
                eta: '≈ 30–60 sec', icon: <Download className="size-5" />
              }
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              >
                <div
                  className="h-full p-6 rounded-2xl border transition-all hover:translate-y-[-2px]"
                  style={{
                    background: 'var(--surface-elevated)',
                    borderColor: 'var(--surface-glass-border)'
                  }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="size-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--surface-glass)', color: 'var(--text-strong)' }}
                    >
                      {item.icon}
                    </div>
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 tracking-tight" style={{ color: 'var(--text-strong)' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                    {item.copy}
                  </p>
                  <div
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
                    style={{ background: 'var(--surface-glass)', color: 'var(--text-muted)' }}
                  >
                    <Clock className="size-3" /> {item.eta}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* VISUAL ENGINES */}
      <section id="engines" className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader eyebrow="Visual engines" title="A library of looks. Tuned for your track." />

          <div className="flex flex-wrap gap-2 justify-center mt-10 mb-10">
            {MOOD_FILTERS.map((m) => {
              const active = activeMood === m;
              return (
                <button
                  key={m}
                  onClick={() => setActiveMood(m)}
                  className="px-4 h-9 rounded-full text-sm border transition-all"
                  style={
                    active
                      ? {
                          background: 'var(--text-strong)',
                          color: 'var(--background)',
                          borderColor: 'var(--text-strong)'
                        }
                      : {
                          background: 'var(--surface-elevated)',
                          color: 'var(--text-strong)',
                          borderColor: 'var(--surface-glass-border)'
                        }
                  }
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredEngines.map((engine, i) => (
                <motion.div
                  key={engine.id}
                  layout
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -4 }}
                >
                  <EngineCard engine={engine} onUse={() => openPicker(engine.studio)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl border overflow-hidden p-12 text-center"
            style={{
              background: 'var(--hero-cta-gradient)',
              borderColor: 'var(--surface-glass-border)',
              boxShadow: 'var(--accent-glow)'
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
                Ready to bring your sound to life?
              </h2>
              <p className="text-white/85 mb-8 max-w-xl mx-auto">
                Every project keeps your settings, sections, and export history in one place.
              </p>
              <Button
                size="lg"
                onClick={() => openPicker()}
                className="bg-white text-gray-900 hover:bg-white/90 px-8 h-12 rounded-xl"
              >
                <Sparkles className="size-4 mr-2" />
                Start a project — free
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
       <MyProjects
        open={myProjectsOpen}
        onClose={() => setMyProjectsOpen(false)}
        onOpenProject={(id) => {
          openExisting(id);
          setMyProjectsOpen(false);
        }}
        onDeleteLocal={(id) => handleDeleteProject(id)}
      />

      <footer
        className="relative py-10 px-6 border-t"
        style={{ borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded" style={{ background: 'var(--hero-cta-gradient)' }} />
            <span>© 2026 Visualizer</span>
          </div>
          <div className="flex gap-6">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

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

function EngineCard({ engine, onUse }: { engine: typeof ENGINES[number]; onUse: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <Card
      className="overflow-hidden border h-full flex flex-col transition-all"
      style={{
        background: 'var(--engine-card-bg)',
        borderColor: 'var(--engine-card-border)'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="h-40 relative overflow-hidden" style={{ background: engine.gradient }}>
        <div className="absolute inset-0 flex items-end justify-center gap-[3px] px-6 pb-4">
          {[...Array(28)].map((_, j) => (
            <motion.div
              key={j}
              className="w-1 rounded-full bg-white/80"
              animate={{
                height: hover
                  ? [`${10 + Math.random() * 50}px`, `${20 + Math.random() * 80}px`, `${10 + Math.random() * 50}px`]
                  : `${10 + (j % 5) * 6}px`
              }}
              transition={{ duration: 0.5 + (j % 5) * 0.05, repeat: Infinity }}
            />
          ))}
        </div>
        <div className="absolute top-3 left-3 size-9 rounded-lg bg-black/30 backdrop-blur-md flex items-center justify-center text-white">
          {engine.icon}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold tracking-tight mb-1" style={{ color: 'var(--text-strong)' }}>
            {engine.name}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {engine.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {engine.moods.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)' }}
            >
              <Heart className="size-2.5" /> {m}
            </span>
          ))}
          {engine.genres.map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border"
              style={{ borderColor: 'var(--surface-glass-border)', color: 'var(--text-muted)' }}
            >
              <Music2 className="size-2.5" /> {g}
            </span>
          ))}
        </div>
        <div className="mt-auto flex gap-2 pt-1">
          <Button
            onClick={onUse}
            className="flex-1 text-white"
            style={{ background: 'var(--hero-cta-gradient)' }}
          >
            Use with my track
          </Button>
          <button
            className="size-10 rounded-lg border flex items-center justify-center transition-colors"
            style={{
              background: 'var(--surface-elevated)',
              borderColor: 'var(--surface-glass-border)',
              color: 'var(--text-strong)'
            }}
          >
            <Play className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function ProjectCard({
  project,
  isSynced,
  onOpen,
  onDelete,
}: {
  project: StoredProject;
  isSynced: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const exportCount = Object.keys(project.exports).length;
 
  return (
    <div
      className="group p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:translate-y-[-2px]"
      style={{
        background: 'var(--surface-elevated)',
        borderColor: 'var(--surface-glass-border)',
      }}
      onClick={onOpen}
    >
      <div
        className="size-10 rounded-lg flex items-center justify-center text-white shrink-0"
        style={{ background: 'var(--hero-cta-gradient)' }}
      >
        <Music className="size-4" />
      </div>
 
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
          {project.audioMeta.name}
          {/* Cloud sync badge */}
          {isSynced && (
            <span
              title="Saved to your account"
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(16,185,129)' }}
            >
              <Cloud className="size-2.5" />
              synced
            </span>
          )}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {fmt(project.audioMeta.duration)} · {exportCount} export{exportCount === 1 ? '' : 's'}
        </div>
      </div>
 
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 size-8 rounded-md flex items-center justify-center transition-opacity"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Delete project"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
