import { useEffect, useMemo, useRef, useState, } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Upload, Download, ArrowLeft, RotateCw, FileVideo, Check,
        Loader2, AlertCircle, Share2, Monitor, Smartphone, CloudOff, Cloud, X, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AuthModal } from './AuthModal';
import type { usePersistentProjects } from '../hooks/usePersistentProjects';
import { useAuth } from '../hooks/useAuth';
import { useSupabaseSync } from '../hooks/useSupabaseSync';
import { fetchProjectTrack, fetchProjectExports, deleteDBExport } from '../lib/db';
import { getAudioSignedUrl, getExportSignedUrl } from '../lib/storage';
import {
  analyzeTrack,
  getSectionAtTime,
  getSectionProgress,
  sampleEnergyCurve,
  type TrackAnalysis,
  type TrackSection,
} from '../lib/audioAnalysis';
import { recommendEngines, type EngineRecommendation } from '../lib/engineRecommendations';

// ─── Platform helpers ────────────────────────────────────────────────────────
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
function getExportMode(): 'webm' | 'mp4' | 'server' {
  if (typeof MediaRecorder === 'undefined') return 'server';
  if (isIOSDevice() && isSafariBrowser()) {
    if (MediaRecorder.isTypeSupported('video/mp4')) return 'mp4';
    return 'server';
  }
  return 'webm';
}

// ─── Types ───────────────────────────────────────────────────────────────────
type EngineId =
  | 'bars' | 'radial'
  | 'orbital' | 'depth' | 'terrain' | 'tunnel'
  | 'neon_spheres' | 'fractal' | 'solar';
type Status = 'idle' | 'decoding' | 'ready' | 'error';

type Project = {
  id: string;
  fileName: string;
  duration: number;
  audioBuffer: AudioBuffer;
  engine: EngineId;
};

type ExportJob = {
  id: number;
  storageId?: string;    // original DB/export ID (string) for delete + cloud download
  storagePath?: string;  // Supabase storage path for re-downloading from cloud
  name: string;
  preset: string;
  aspect: string;
  status: 'recording' | 'finalizing' | 'done' | 'error';
  progress: number;
  url?: string;
  blob?: Blob;
  size?: number;
  errorMsg?: string;
};

type Star   = { x: number; y: number; z: number; hue: number };
type Spark  = { angle: number; r: number; speed: number; life: number; ring: number };
type Sphere = { x: number; y: number; vx: number; vy: number; phase: number; size: number; hue: number };
type Planet = { angle: number; speed: number; dist: number; size: number; color: number };

// ─── Constants ───────────────────────────────────────────────────────────────
const ENGINES: { id: EngineId; name: string; description: string; group: '2D' | '3D' }[] = [
  { id: 'bars',        name: 'Spectrum Bars',        description: 'Classic frequency bars across the canvas.',              group: '2D' },
  { id: 'radial',      name: 'Radial Spectrum',       description: 'Bars radiating from the center.',                       group: '2D' },
  { id: 'orbital',     name: 'Orbital Rings',         description: 'Concentric rings tilt and pulse around a glowing core.', group: '3D' },
  { id: 'depth',       name: 'Depth Field Particles', description: 'Cinematic starfield that surges on every beat.',        group: '3D' },
  { id: 'terrain',     name: 'Audio Terrain',         description: 'Wireframe landscape that reacts to every frequency.',  group: '3D' },
  { id: 'tunnel',      name: 'Neon Tunnel',           description: 'Glowing tunnel pulsing with bass and highs.',          group: '3D' },
  { id: 'neon_spheres',name: 'Neon Spheres',          description: 'Glowing spheres wobbling and scaling with audio.',     group: '3D' },
  { id: 'fractal',     name: 'Fractal Kaleidoscope',  description: 'Mirrored tiling pattern; rotation tied to energy.',    group: '3D' },
  { id: 'solar',       name: 'Solar System',          description: 'Central sun with orbiting bodies; flares on bass.',    group: '3D' },
];

const PALETTES: { name: string; colors: [string, string, string] }[] = [
  { name: 'Sunset', colors: ['#8b5cf6', '#ec4899', '#f59e0b'] },
  { name: 'Ocean',  colors: ['#06b6d4', '#3b82f6', '#8b5cf6'] },
  { name: 'Forest', colors: ['#10b981', '#84cc16', '#fbbf24'] },
  { name: 'Mono',   colors: ['#ffffff', '#9ca3af', '#4b5563'] },
];

const PRESETS = [
  { id: 'fast', name: 'Social Fast',       w: 720,  h: 1280, fps: 30, label: '720p · 30fps'  },
  { id: 'std',  name: 'Creator Standard',  w: 1080, h: 1920, fps: 30, label: '1080p · 30fps' },
  { id: 'pro',  name: 'Pro Master',        w: 2160, h: 3840, fps: 60, label: '4K · 60fps'    },
];

const ASPECTS: { id: '9:16' | '1:1' | '16:9'; label: string; sub: string }[] = [
  { id: '9:16', label: '9:16', sub: 'TikTok / Reels' },
  { id: '1:1',  label: '1:1',  sub: 'Instagram'      },
  { id: '16:9', label: '16:9', sub: 'YouTube'         },
];

// ─── Utilities ───────────────────────────────────────────────────────────────
function avg(arr: Uint8Array, start: number, end: number) {
  const e = Math.min(end, arr.length);
  let s = 0;
  for (let i = start; i < e; i++) s += arr[i];
  return (s / Math.max(1, e - start)) / 255;
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(v, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

type Persist = ReturnType<typeof usePersistentProjects>;

type StudioProps = {
  initialFile: File | null;
  initialEngine?: EngineId;
  projectId?: string | null;
  persist?: Persist;
  onBack: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────
export function Studio({ initialFile, initialEngine = 'bars', projectId, persist, onBack }: StudioProps) {
  const stored = projectId && persist ? persist.projects[projectId] : null;

  // ── State ─────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [persistedId, setPersistedId] = useState<string | null>(projectId ?? null);

  const [engine, setEngine]                   = useState<EngineId>((stored?.engineId as EngineId) ?? initialEngine);
  const [palette, setPalette]                 = useState(stored?.style.palette ?? 0);
  const [beatSensitivity, setBeatSensitivity] = useState(stored?.motion.beatSensitivity ?? 0.7);
  const [particleDensity, setParticleDensity] = useState(stored?.motion.particleDensity ?? 0.6);
  const [smoothing, setSmoothing]             = useState(stored?.motion.smoothing ?? 0.8);
  const [perfMode, setPerfMode]               = useState(false);
  const [baseSpeed, setBaseSpeed]             = useState(0.35);
  const [beatResponse, setBeatResponse]       = useState(0.7);

  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [aspect, setAspect]           = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [presetId, setPresetId]       = useState('std');
  const [clipDuration, setClipDuration] = useState<'full' | 15 | 30 | 60>('full');
  const [exports, setExports]         = useState<ExportJob[]>([]);
  const [uploadingToCloud, setUploadingToCloud] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const [trackAnalysis, setTrackAnalysis] = useState<TrackAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<EngineRecommendation[]>([]);

  // ── Live-param refs (RAF closure safety) ──────────────────────────────────
  const engineRef          = useRef<EngineId>(engine);
  const paletteRef         = useRef(palette);
  const beatSensRef        = useRef(beatSensitivity);
  const particleDensRef    = useRef(particleDensity);
  const perfModeRef        = useRef(perfMode);
  const baseSpeedRef       = useRef(baseSpeed);
  const beatResponseRef    = useRef(beatResponse);
  const playingRef         = useRef(false);

  // ── Audio refs ─────────────────────────────────────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const gainRef      = useRef<GainNode | null>(null);
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef    = useRef(0);
  const rafRef       = useRef<number | null>(null);

  // ── Visual engine state refs ───────────────────────────────────────────────
  const starsRef   = useRef<Star[]>([]);
  const sparksRef  = useRef<Spark[]>([]);
  const spheresRef = useRef<Sphere[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const tunnelTRef = useRef(0);
  const cameraTRef = useRef(0);
  const solarTRef  = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pendingUploadRef = useRef<{ file: File; audioMeta: { name: string; duration: number; sampleRate?: number }; engineId: string } | null>(null);  // ADD THIS

  // Phase 9 refs — written once after decode, read every RAF frame
  const sectionsRef       = useRef<TrackSection[]>([]);
  const energyCurveRef    = useRef<Float32Array>(new Float32Array(0));
  const energyCurveResRef = useRef(0.1);


   const { user } = useAuth();
  const supabaseSync = useSupabaseSync(user?.id);
  const { sessionExpired, clearExpiredFlag } = supabaseSync;
  
  // ── Export mode (platform-aware, computed once) ────────────────────────────
  const exportMode = useMemo(() => getExportMode(), []);

  // ── Sync state → refs (MUST be defined before drawFrame effect) ───────────
  useEffect(() => { engineRef.current       = engine;          }, [engine]);
  useEffect(() => { paletteRef.current      = palette;         }, [palette]);
  useEffect(() => { beatSensRef.current     = beatSensitivity; }, [beatSensitivity]);
  useEffect(() => { particleDensRef.current = particleDensity; }, [particleDensity]);
  useEffect(() => { perfModeRef.current     = perfMode;        }, [perfMode]);
  useEffect(() => { baseSpeedRef.current    = baseSpeed;       }, [baseSpeed]);
  useEffect(() => { beatResponseRef.current = beatResponse;    }, [beatResponse]);

  // ── Load file on mount ─────────────────────────────────────────────────────
    useEffect(() => {
    if (initialFile) {
      // New file uploaded from landing page — load directly
      loadFile(initialFile);
    } else if (projectId && !initialFile) {
      // Reopening a saved project — try to reload audio from Supabase Storage
      reloadProjectAudio(projectId);
    }
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update analyser smoothing ──────────────────────────────────────────────
  useEffect(() => {
    if (analyserRef.current) analyserRef.current.smoothingTimeConstant = smoothing;
  }, [smoothing]);

  // ── Persist setting changes ────────────────────────────────────────────────
  useEffect(() => {
    if (!persist || !persistedId) return;
    persist.updateProject(persistedId, {
      engineId: engine,
      style: { palette },
      motion: { beatSensitivity, particleDensity, smoothing },
    });
  }, [engine, palette, beatSensitivity, particleDensity, smoothing, persistedId, persist]);

// Fire pending audio upload the moment user signs in / session restores
  useEffect(() => {
    if (!user?.id || !persistedId || !pendingUploadRef.current) return;

    const pending = pendingUploadRef.current;
    pendingUploadRef.current = null;

    supabaseSync
      .uploadAudio(persistedId, pending.file, pending.audioMeta, pending.engineId)
      .catch((err) => console.error('[studio] pending upload ERROR:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, persistedId]);

  // Show sign-in nudge ~2.5s after audio is ready for anonymous users
  useEffect(() => {
    if (status === 'ready' && !user) {
      const t = setTimeout(() => setShowSignInNudge(true), 2500);
      return () => clearTimeout(t);
    }
    if (user) setShowSignInNudge(false);
  }, [status, user]);

  // Supabase autosave — debounced 1.5 s, runs in parallel with local persist
  useEffect(() => {
    if (!persistedId || !project) return;
    supabaseSync.saveConfig(persistedId, {
      engineId: engine,
      style: { palette },
      motion: { beatSensitivity, particleDensity, smoothing },
      audioMeta: { name: project.fileName, duration: project.duration },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, palette, beatSensitivity, particleDensity, smoothing, persistedId, project?.fileName, supabaseSync]);
  

  // ── Redraw static frame when params change ─────────────────────────────────
  // (runs AFTER sync effects above, so refs are already up-to-date)
  useEffect(() => {
    drawFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, palette, beatSensitivity, particleDensity, project, aspect, perfMode, baseSpeed, beatResponse]);

  // ─────────────────────────────────────────────────────────────────────────
  // drawFrame — reads ALL live values from refs so RAF loop never goes stale
  // ─────────────────────────────────────────────────────────────────────────
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const eng     = engineRef.current;
    const pal     = paletteRef.current;
    const sens    = 0.5 + beatSensRef.current * 1.5;
    const perf    = perfModeRef.current;
    const bSpeed  = baseSpeedRef.current;
    const bResp   = beatResponseRef.current;
    const colors  = PALETTES[pal].colors;
    const w = canvas.width, h = canvas.height;

    // Background
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, 'rgba(10,10,15,1)');
    bg.addColorStop(1, 'rgba(20,20,30,1)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const analyser = analyserRef.current;
    if (!analyser) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a track to begin', w / 2, h / 2);
      return;
    }

    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);

    // ── Phase 9: section + energy context ─────────────────────────────────
    const playbackSec = audioCtxRef.current
      ? Math.max(0, audioCtxRef.current.currentTime - startedAtRef.current + offsetRef.current)
      : 0;
    const activeSection = getSectionAtTime(sectionsRef.current, playbackSec);
    const sectionProgress = activeSection ? getSectionProgress(activeSection, playbackSec) : 0;
    const currentEnergy = sampleEnergyCurve(energyCurveRef.current, playbackSec, energyCurveResRef.current);
    // energyMult: smoothly scales between 0.6 (low energy) and 1.4 (high energy)
    const energyMult = 0.6 + currentEnergy * 0.8;
    // sectionIntensity: 0=breakdown/intro, 0.5=verse, 1=drop/chorus
    const sectionIntensity = activeSection
      ? (['drop', 'chorus'].includes(activeSection.label) ? 1.0
        : ['verse'].includes(activeSection.label) ? 0.55
        : ['intro', 'outro'].includes(activeSection.label) ? 0.35
        : 0.25) // breakdown
      : 0.5;
    // ─────────────────────────────────────────────────────────────────────

    // ── Spectrum Bars ─────────────────────────────────────────────────────
    if (eng === 'bars') {
      const bars = 80;
      const step = Math.floor(freq.length / bars);
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = (freq[i * step] / 255) * sens * energyMult;
        const bh = v * h * 0.6 * (0.5 + sectionIntensity * 0.5);
        const grad = ctx.createLinearGradient(0, h - bh, 0, h);
        grad.addColorStop(0, colors[0]); grad.addColorStop(0.5, colors[1]); grad.addColorStop(1, colors[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(i * barW + 2, h - bh, barW - 4, bh);
      }

    // ── Radial Spectrum ───────────────────────────────────────────────────
    } else if (eng === 'radial') {
      const cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.15;
      const bars = 96;
      const step = Math.floor(freq.length / bars);
      const bass = freq.slice(0, 8).reduce((a, b) => a + b, 0) / 8 / 255;
      const coreR = baseR + bass * baseR * sens;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreGrad.addColorStop(0, colors[0]); coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < bars; i++) {
        const v = (freq[i * step] / 255) * sens * energyMult;
        const len = baseR + v * Math.min(w, h) * 0.35 * (0.4 + sectionIntensity * 0.6);
        const angle = (i / bars) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * baseR, y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * len,   y2 = cy + Math.sin(angle) * len;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, colors[1]); grad.addColorStop(1, colors[2]);
        ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

    // ── Orbital Rings ─────────────────────────────────────────────────────
    } else if (eng === 'orbital') {
      ctx.fillStyle = 'rgba(8,8,15,0.35)';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const bass = avg(freq, 0, 16), mids = avg(freq, 16, 80), highs = avg(freq, 80, 200);
      cameraTRef.current += (0.004 + bass * 0.01 * sens) * energyMult;
      const tilt = 0.4 + Math.sin(cameraTRef.current * 0.6) * 0.2;
      const coreR = Math.min(w, h) * 0.07 * (1 + bass * sens * 0.6);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
      coreGrad.addColorStop(0, colors[0]); coreGrad.addColorStop(0.4, colors[1]); coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad; ctx.beginPath(); ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2); ctx.fill();
      const ringCount = perf ? 3 : 6;
      for (let r = 0; r < ringCount; r++) {
        const baseR = Math.min(w, h) * (0.12 + r * 0.07) * (1 + bass * sens * 0.15) * (0.7 + sectionIntensity * 0.3);
        const thickness = (1.5 + mids * 6 * sens + r * 0.4) * energyMult;
        const rot = cameraTRef.current * (0.3 + r * 0.1) + r;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(1, Math.max(0.15, tilt - r * 0.03));
        ctx.strokeStyle = colors[r % colors.length];
        ctx.globalAlpha = 0.55 + mids * 0.5;
        ctx.lineWidth = thickness;
        ctx.beginPath(); ctx.arc(0, 0, baseR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        if (highs > 0.55 && Math.random() < 0.3) {
          sparksRef.current.push({ angle: Math.random() * Math.PI * 2, r: baseR, speed: 0.04 + highs * 0.05, life: 1, ring: r });
        }
      }
      ctx.globalAlpha = 1;
      for (const s of sparksRef.current) {
        s.angle += s.speed; s.life *= 0.96;
        const baseR = Math.min(w, h) * (0.12 + s.ring * 0.07);
        const x = cx + Math.cos(s.angle) * baseR;
        const y = cy + Math.sin(s.angle) * baseR * Math.max(0.15, tilt - s.ring * 0.03);
        ctx.fillStyle = colors[2]; ctx.globalAlpha = s.life;
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      sparksRef.current = sparksRef.current.filter((s) => s.life > 0.08);

    // ── Depth Field Particles (tuned: slow base + musical beat bursts) ───
    } else if (eng === 'depth') {
      const trail = 0.12 + (1 - bResp) * 0.12;
      ctx.fillStyle = `rgba(2,2,8,${trail})`;
      ctx.fillRect(0, 0, w, h);
      const bass = avg(freq, 0, 16), mids = avg(freq, 16, 80), highs = avg(freq, 80, 200);
      // Section-aware particle count: fewer in breakdown, more in drop/chorus
      const densityScale = 0.4 + sectionIntensity * 0.6;
      const targetCount = Math.floor((perf ? 600 : 1800) * densityScale);
      while (starsRef.current.length < targetCount) {
        starsRef.current.push({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random(), hue: Math.random() });
      }
      starsRef.current.length = Math.min(starsRef.current.length, targetCount + 200);
      // Slow immersive base + sharp beat burst
      const baseSpd = 0.0008 + bSpeed * 0.004;
      const beatBurst = bass > 0.45 ? bass * bResp * 0.055 * sens : 0;
      const speed = (baseSpd + beatBurst) * energyMult;
      const cx = w / 2, cy = h / 2;
      const focal = Math.min(w, h) * 0.6;
      for (const s of starsRef.current) {
        s.z -= speed;
        if (s.z <= 0.01) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 0.9 + Math.random() * 0.1; s.hue = Math.random(); }
        const sx = cx + (s.x / s.z) * focal;
        const sy = cy + (s.y / s.z) * focal;
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
        const depth = 1 - s.z;
        const spawnBonus = bass > 0.5 ? 1 + bass * bResp * 1.5 : 1;
        const size = Math.max(0.4, depth * (1.8 + mids * 5 * sens) * spawnBonus);
        const alpha = Math.min(1, depth * 1.6) * (0.45 + highs * 0.55);
        ctx.fillStyle = colors[Math.floor(s.hue * colors.length)] || colors[0];
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Shockwave ring on strong bass
      if (bass > 0.6 && bResp > 0.2) {
        ctx.strokeStyle = colors[1]; ctx.lineWidth = 1 + bass;
        ctx.globalAlpha = 0.25 * bass * bResp;
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * (0.12 + bass * 0.32), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

    // ── Audio Terrain (upgraded: fog, cinematic camera, better heights) ──
    } else if (eng === 'terrain') {
      ctx.fillStyle = 'rgba(3,3,12,1)';
      ctx.fillRect(0, 0, w, h);
      const bass = avg(freq, 0, 16), mids = avg(freq, 16, 80), highs = avg(freq, 80, 200);
      cameraTRef.current += 0.016 + bass * 0.022 * sens;
      const cols = perf ? 18 : 34, rows = perf ? 12 : 24;
      const horizon = h * 0.4;
      // Sky gradient with atmospheric glow
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, `rgba(${hexToRgb(colors[0])}, ${0.18 + highs * 0.4})`);
      sky.addColorStop(0.6, `rgba(${hexToRgb(colors[1])}, ${0.04 + bass * 0.12})`);
      sky.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
      // Terrain mesh
      for (let r = 0; r < rows; r++) {
        const t = r / rows;
        const yPersp = horizon + (h - horizon) * Math.pow(t, 1.55);
        const scale  = Math.pow(t, 1.3);
        const fogFactor = Math.max(0, 1 - t * 2.2);
        const alpha = (0.1 + scale * 0.8) * (1 - fogFactor * 0.75);
        ctx.strokeStyle = `rgba(${hexToRgb(colors[r % colors.length])}, ${alpha})`;
        ctx.lineWidth = 0.5 + scale * 1.8;
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const idx = Math.floor((c / cols) * (freq.length / 2));
          const fv  = (freq[idx] / 255) * sens;
          // Bass = big hills, mids = ripple waves, highs = shimmer
          const bassH    = bass * 130 * scale * sens * (0.4 + fv * 0.6);
          const midRipple = Math.sin((c + cameraTRef.current * 5 + r * 0.7) * 0.6) * mids * 45 * scale * sens;
          const shimmer   = Math.sin((c * 4 + cameraTRef.current * 18) * 1.2) * highs * 6 * scale;
          const height    = fv * 55 * scale + bassH + midRipple + shimmer;
          const x = (c / cols) * w, y = yPersp - height;
          if (c === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Atmospheric fog near horizon
      const fog = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 55);
      fog.addColorStop(0, 'rgba(3,3,12,0)');
      fog.addColorStop(0.4, `rgba(${hexToRgb(colors[0])}, ${0.06 + bass * 0.08})`);
      fog.addColorStop(1, 'rgba(3,3,12,0.35)');
      ctx.fillStyle = fog; ctx.fillRect(0, horizon - 30, w, 85);

    // ── Neon Tunnel (upgraded: glow, bass zoom, mids brightness) ─────────
    } else if (eng === 'tunnel') {
      ctx.fillStyle = 'rgba(0,0,6,0.32)';
      ctx.fillRect(0, 0, w, h);
      const bass = avg(freq, 0, 16), mids = avg(freq, 16, 80), highs = avg(freq, 80, 200);
      tunnelTRef.current += (0.01 + bass * 0.07 * sens) * energyMult;
      const cx = w / 2, cy = h / 2;
      const segments = perf ? 12 : 24;
      const roll = Math.sin(tunnelTRef.current * 0.25) * 0.06;
      const scalePulse = 1 + bass * 0.35 * sens * sectionIntensity;
      for (let i = segments - 1; i >= 0; i--) {
        const z      = ((i + tunnelTRef.current) % segments) / segments;
        const scale  = (1 - z) * scalePulse;
        const r      = Math.min(w, h) * 0.5 * scale;
        const alpha  = Math.pow(1 - z, 1.3);
        if (r < 2) continue;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(roll * (1 - z));
        const c = colors[i % colors.length];
        const bright = 0.3 + mids * 0.9 * sens; // mids drive brightness
        ctx.globalAlpha = Math.min(1, alpha * bright);
        ctx.shadowColor = c;
        ctx.shadowBlur  = 10 + mids * 25 * sens;
        ctx.strokeStyle = c;
        ctx.lineWidth   = 1.2 + bass * 5 * sens;
        ctx.beginPath();
        const sides = 6;
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * Math.PI * 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Rim sparks on highs — soft-limited (max 1 per ring per frame)
        if (highs > 0.4 && alpha > 0.25 && Math.random() < highs * 0.14) {
          const sa = Math.random() * Math.PI * 2;
          ctx.globalAlpha = Math.min(0.75, alpha * highs);
          ctx.fillStyle   = colors[0];
          ctx.shadowBlur  = 8;
          ctx.beginPath();
          ctx.arc(Math.cos(sa) * r, Math.sin(sa) * r, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;

    // ── Neon Spheres (new) ────────────────────────────────────────────────
    } else if (eng === 'neon_spheres') {
      ctx.fillStyle = 'rgba(2,2,10,0.28)';
      ctx.fillRect(0, 0, w, h);
      const bass = avg(freq, 0, 16), highs = avg(freq, 80, 200);
      solarTRef.current += 0.018;
      const N = 6;
      if (spheresRef.current.length < N) {
        spheresRef.current = Array.from({ length: N }, (_, i) => ({
          x: 0.15 + (i / (N - 1)) * 0.7,
          y: 0.25 + Math.random() * 0.5,
          vx: (Math.random() - 0.5) * 0.0015,
          vy: (Math.random() - 0.5) * 0.0015,
          phase: (i / N) * Math.PI * 2,
          size: 0.045 + Math.random() * 0.045,
          hue: i / N,
        }));
      }
      const bandStep = Math.floor(freq.length / N);
      for (let i = 0; i < N; i++) {
        const sp  = spheresRef.current[i];
        const be  = avg(freq, i * bandStep, (i + 1) * bandStep);
        sp.x += sp.vx + Math.sin(solarTRef.current * 0.6 + sp.phase) * 0.0004;
        sp.y += sp.vy + Math.cos(solarTRef.current * 0.45 + sp.phase * 1.3) * 0.0004;
        sp.x  = Math.max(0.07, Math.min(0.93, sp.x));
        sp.y  = Math.max(0.07, Math.min(0.93, sp.y));
        if (sp.x <= 0.07 || sp.x >= 0.93) sp.vx *= -1;
        if (sp.y <= 0.07 || sp.y >= 0.93) sp.vy *= -1;
        const sx = sp.x * w, sy = sp.y * h;
        const minDim = Math.min(w, h);
        const r = sp.size * minDim * (1 + be * sens * 1.8) * (1 + bass * 0.25);
        const color = colors[i % colors.length];
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = 20 + be * 55 * sens;
        const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r * 1.8);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.15, color);
        g.addColorStop(0.5, `rgba(${hexToRgb(color)}, 0.5)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.75 + be * 0.25;
        ctx.fillStyle   = g;
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2); ctx.fill();
        if (highs > 0.35 && Math.random() < highs * 0.4) {
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha = highs * 0.7;
          ctx.beginPath(); ctx.arc(sx - r * 0.3, sy - r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // ── Fractal Kaleidoscope (new) ────────────────────────────────────────
    } else if (eng === 'fractal') {
      ctx.fillStyle = 'rgba(2,2,10,0.22)';
      ctx.fillRect(0, 0, w, h);
      const bass = avg(freq, 0, 16), mids = avg(freq, 16, 80), highs = avg(freq, 80, 200);
      const energy = bass * 0.5 + mids * 0.35 + highs * 0.15;
      solarTRef.current += (0.008 + energy * 0.04 * sens) * energyMult;
      const cx = w / 2, cy = h / 2;
      const zoom = Math.min(1.22, 1 + bass * sens * 0.35 * sectionIntensity);
      const segs = 8;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      for (let seg = 0; seg < segs; seg++) {
        ctx.save();
        ctx.rotate((seg / segs) * Math.PI * 2 + solarTRef.current * 0.18);
        if (seg % 2 === 1) ctx.scale(-1, 1);
        const bars = 28;
        const step = Math.floor(freq.length / bars);
        const c = colors[seg % colors.length];
        ctx.strokeStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur  = 4 + highs * 14;
        ctx.lineWidth   = 1 + bass * 3 * sens;
        ctx.globalAlpha = 0.6 + mids * 0.4;
        ctx.beginPath();
        let first = true;
        for (let b = 0; b < bars; b++) {
          const v = (freq[b * step] / 255) * sens;
          const angle = (b / bars) * Math.PI * 0.45 - 0.225;
          const r2    = Math.min(w, h) * 0.04 + v * Math.min(w, h) * 0.3 * (1 + mids * 0.6);
          const r1    = Math.min(w, h) * 0.04;
          if (first) { ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1); first = false; }
          ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
        }
        ctx.stroke();
        // Inner accent arc
        ctx.globalAlpha = 0.2 + bass * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) * 0.04 * (1 + bass * 0.5), -0.225, 0.225);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // ── Solar System (new) ────────────────────────────────────────────────
    } else if (eng === 'solar') {
      ctx.fillStyle = 'rgba(1,1,8,0.28)';
      ctx.fillRect(0, 0, w, h);
      const bass = avg(freq, 0, 16), mids = avg(freq, 16, 80), highs = avg(freq, 80, 200);
      solarTRef.current += (0.006 + bass * 0.012 * sens) * energyMult;
      const cx = w / 2, cy = h / 2;
      const minDim = Math.min(w, h);
      if (planetsRef.current.length < 5) {
        planetsRef.current = [
          { angle: 0,   speed: 0.013, dist: 0.11, size: 0.014, color: 0 },
          { angle: 1.2, speed: 0.008, dist: 0.18, size: 0.020, color: 1 },
          { angle: 2.8, speed: 0.005, dist: 0.26, size: 0.017, color: 2 },
          { angle: 0.5, speed: 0.003, dist: 0.34, size: 0.026, color: 0 },
          { angle: 3.9, speed: 0.002, dist: 0.42, size: 0.019, color: 1 },
        ];
      }
      // Sun
      const sunR = minDim * 0.055 * (1 + bass * sens * 0.55);
      ctx.save();
      ctx.shadowColor = colors[0]; ctx.shadowBlur = 50 + bass * 80 * sens;
      const sunG = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 3.5);
      sunG.addColorStop(0, '#ffffff');
      sunG.addColorStop(0.15, colors[0]);
      sunG.addColorStop(0.55, `rgba(${hexToRgb(colors[1])}, 0.35)`);
      sunG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunG;
      ctx.beginPath(); ctx.arc(cx, cy, sunR * 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Solar flares on strong bass
      if (bass > 0.55) {
        for (let f = 0; f < 4; f++) {
          const a = (f / 4) * Math.PI * 2 + solarTRef.current;
          const fl = sunR * (1.8 + Math.random() * 2.5) * bass;
          ctx.strokeStyle = `rgba(${hexToRgb(colors[0])}, ${0.25 * bass})`;
          ctx.lineWidth   = 0.8 + Math.random() * 1.5;
          ctx.globalAlpha = bass * 0.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * sunR, cy + Math.sin(a) * sunR);
          ctx.quadraticCurveTo(
            cx + Math.cos(a + 0.3) * fl * 0.6, cy + Math.sin(a + 0.3) * fl * 0.6,
            cx + Math.cos(a) * fl, cy + Math.sin(a) * fl
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // Orbit rings + planets
      for (let i = 0; i < planetsRef.current.length; i++) {
        const p = planetsRef.current[i];
        const bv = avg(freq, Math.floor(i * (freq.length / 5)), Math.floor((i + 1) * (freq.length / 5)));
        p.angle += p.speed * (1 + bv * sens * 1.5);
        const orbitR = p.dist * minDim;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, orbitR, 0, Math.PI * 2); ctx.stroke();
        const px = cx + Math.cos(p.angle) * orbitR;
        const py = cy + Math.sin(p.angle) * orbitR;
        const pSize  = p.size * minDim * (1 + bv * sens * 0.9);
        const pColor = colors[p.color % colors.length];
        ctx.save();
        ctx.shadowColor = pColor; ctx.shadowBlur = 8 + bv * 18;
        const pG = ctx.createRadialGradient(px, py, 0, px, py, pSize * 2.2);
        pG.addColorStop(0, '#ffffff'); pG.addColorStop(0.25, pColor);
        pG.addColorStop(0.65, `rgba(${hexToRgb(pColor)}, 0.5)`); pG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pG; ctx.globalAlpha = 0.8 + bv * 0.2;
        ctx.beginPath(); ctx.arc(px, py, pSize * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Asteroid belt on mids
      if (mids > 0.25) {
        const beltR = minDim * 0.3;
        const count = Math.floor(mids * 15 * sens);
        for (let a = 0; a < count; a++) {
          const angle = Math.random() * Math.PI * 2;
          const r = beltR + (Math.random() - 0.5) * minDim * 0.025;
          ctx.fillStyle = `rgba(160,160,200,${mids * 0.45})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // Overlay label
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Preview · Adaptive quality', 12, 20);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Resize canvas to selected aspect ratio
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const baseW = 960;
    const ratio = aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 16 / 9;
    canvas.width  = aspect === '9:16' ? 540 : baseW;
    canvas.height = Math.round(canvas.width / ratio);
    drawFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // ─────────────────────────────────────────────────────────────────────────
  // Playback
  // ─────────────────────────────────────────────────────────────────────────
  const stopAudio = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  };

  async function loadFile(file: File, opts: { skipUpload?: boolean } = {}) {
    setStatus('decoding'); setError(null);
    try {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a)$/i.test(file.name)) {
        throw new Error('Unsupported file type. Try MP3, WAV, or FLAC.');
      }
      if (file.size > 100 * 1024 * 1024) throw new Error('File too large (max 100 MB).');
      const arrayBuffer = await file.arrayBuffer();
      const ctx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (audioBuffer.duration < 1) throw new Error('Audio is too short.');
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = smoothing;
      analyserRef.current = analyser;
      const gain = ctx.createGain();
      gainRef.current = gain;
      analyser.connect(gain).connect(ctx.destination);
      const newProj: Project = { id: `prj_${Date.now()}`, fileName: file.name, duration: audioBuffer.duration, audioBuffer, engine: initialEngine };
      setProject(newProj); setStatus('ready');

      // ── Phase 9: offline analysis (non-blocking, runs after render) ────────
      setTimeout(() => {
        try {
          const analysis = analyzeTrack(audioBuffer);
          sectionsRef.current       = analysis.sections;
          energyCurveRef.current    = analysis.energyCurve;
          energyCurveResRef.current = analysis.energyCurveResolution;
          setTrackAnalysis(analysis);
          setRecommendations(recommendEngines(analysis.mood, analysis.bpm, 3));
        } catch (err) {
          console.warn('[studio] offline analysis failed (non-fatal):', err);
        }
      }, 0);
      // ──────────────────────────────────────────────────────────────────────

       const audioMeta = { name: file.name, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate };
 
      if (persist && !persistedId) {
        const created = persist.createProject(audioMeta, engine);
        setPersistedId(created.id);
 
        if (!opts.skipUpload) {
          if (user?.id) {
            setUploadingToCloud(true);
            supabaseSync
              .uploadAudio(created.id, file, audioMeta, engine)
              .then(() => { setUploadingToCloud(false); })
              .catch((err) => { console.error('[studio] uploadAudio ERROR:', err); setUploadingToCloud(false); });
          } else {
            console.log('[studio] user not ready yet — storing pending upload for project:', created.id);
            pendingUploadRef.current = { file, audioMeta, engineId: engine };
          }
        }
      } else if (persist && persistedId) {
        persist.updateProject(persistedId, { audioMeta });
 
        if (!opts.skipUpload) {
          if (user?.id) {
            setUploadingToCloud(true);
            supabaseSync
              .uploadAudio(persistedId, file, audioMeta, engine)
              .then(() => { setUploadingToCloud(false); })
              .catch((err) => { console.error('[studio] uploadAudio ERROR:', err); setUploadingToCloud(false); });
          } else {
            console.log('[studio] user not ready yet — storing pending upload for project:', persistedId);
            pendingUploadRef.current = { file, audioMeta, engineId: engine };
          }
        }
      }
} catch (e: any) {
      setStatus('error'); setError(e.message || 'Failed to decode audio.');
    }
  } 

   const reloadProjectAudio = async (projId: string) => {
    setStatus('decoding');
    try {
      // 1. Get track metadata from DB
      const track = await fetchProjectTrack(projId);
      if (!track?.storage_path) {
        // No audio stored yet — show idle state, user can re-upload
        setStatus('idle');
        return;
      }
 
      // 2. Get a signed URL from Supabase Storage
      const signedUrl = await getAudioSignedUrl(track.storage_path, 3600);
      if (!signedUrl) {
        setStatus('idle');
        return;
      }
 
      // 3. Fetch the audio blob
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error('Failed to fetch audio from storage');
      const blob = await response.blob();
 
      // 4. Reconstruct a File object and call loadFile (skip re-upload — already in Storage)
      const file = new File([blob], track.filename, { type: track.mime_type || 'audio/mpeg' });
      await loadFile(file, { skipUpload: true });
 
      // 5. Restore export history from DB
      const dbExports = await fetchProjectExports(projId);
if (dbExports.length > 0) {
        const restored: ExportJob[] = dbExports.map((e) => ({
          id: Number(e.id) || Date.now(),
          storageId: e.id,
          storagePath: e.storage_path,
          name: `${track.filename.replace(/\.[^.]+$/, '')}_${e.aspect_ratio?.replace(':', 'x') ?? ''}_${e.quality_preset ?? ''}`,
          preset: e.quality_preset ?? '',
          aspect: e.aspect_ratio ?? '9:16',
          status: 'done' as const,
          progress: 100,
          url: undefined,
          size: e.size_bytes ?? undefined,
        }));
        setExports(restored);
      }
 
    } catch (err) {
      console.error('[studio] reloadProjectAudio failed:', err);
      // Non-fatal — just show idle so user can re-upload
      setStatus('idle');
    }
  };
  
  
  const play = async () => {
    if (!project || !audioCtxRef.current || !analyserRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = project.audioBuffer;
    src.connect(analyserRef.current);
    src.onended = () => {
      if (sourceRef.current === src) { playingRef.current = false; setPlaying(false); offsetRef.current = 0; }
    };
    src.start(0, offsetRef.current);
    startedAtRef.current = ctx.currentTime - offsetRef.current;
    sourceRef.current = src;
    playingRef.current = true;
    setPlaying(true);
    runVisualizationLoop();
  };

  const pause = () => {
    if (!sourceRef.current || !audioCtxRef.current) return;
    offsetRef.current = audioCtxRef.current.currentTime - startedAtRef.current;
    try { sourceRef.current.stop(); } catch {}
    sourceRef.current.disconnect(); sourceRef.current = null;
    playingRef.current = false;
    setPlaying(false);
    // Draw one more frame so the canvas shows the paused state
    setTimeout(drawFrame, 16);
  };

  const seek = (t: number) => {
    const wasPlaying = playingRef.current;
    if (wasPlaying) pause();
    offsetRef.current = Math.max(0, Math.min(t, project?.duration ?? 0));
    setCurrentTime(offsetRef.current);
    if (wasPlaying) play(); else drawFrame();
  };

  const runVisualizationLoop = () => {
    const tick = () => {
      drawFrame();
      // Only update time display when truly playing (use ref, not stale state)
      if (audioCtxRef.current && playingRef.current) {
        setCurrentTime(audioCtxRef.current.currentTime - startedAtRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // File picker
  // ─────────────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFile   = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { stopAudio(); setPlaying(false); playingRef.current = false; offsetRef.current = 0; loadFile(file); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Export — platform-aware
  // ─────────────────────────────────────────────────────────────────────────
  const startExport = async () => {
    if (!project || !canvasRef.current || !audioCtxRef.current || !analyserRef.current) return;
    const preset = PRESETS.find((p) => p.id === presetId)!;
    const dur = clipDuration === 'full' ? Math.min(project.duration, 180) : (clipDuration as number);

    const job: ExportJob = {
      id: Date.now(),
      name: `${project.fileName.replace(/\.[^.]+$/, '')}_${aspect.replace(':', 'x')}_${preset.id}`,
      preset: preset.name, aspect, status: 'recording', progress: 0,
    };
    setExports((x) => [...x, job]);

    if (persist && persistedId) {
      persist.addExport(persistedId, {
        id: String(job.id), createdAt: Date.now(),
        type: exportMode === 'mp4' ? 'mp4' : 'webm',
        status: 'recording', aspectRatio: aspect,
        resolution: `${preset.w}x${preset.h}`, duration: dur, qualityPreset: preset.name,
      });
    }

    // iOS/Safari with no MediaRecorder support → show helpful message
    if (exportMode === 'server') {
      setExports((x) => x.map((j) => j.id === job.id
        ? { ...j, status: 'error', progress: 0, errorMsg: 'Direct recording is not supported on this browser. Please open on desktop Chrome/Firefox or Android Chrome.' }
        : j));
      if (persist && persistedId) persist.updateExport(persistedId, String(job.id), { status: 'error', errorMessage: 'Browser not supported' });
      return;
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} sourceRef.current.disconnect(); }

    const dest = ctx.createMediaStreamDestination();
    const src  = ctx.createBufferSource();
    src.buffer = project.audioBuffer;
    src.connect(analyserRef.current);
    analyserRef.current.connect(dest);
    sourceRef.current = src;
    src.start(0, 0);
    startedAtRef.current = ctx.currentTime;
    offsetRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
    runVisualizationLoop();

    const canvasStream = canvasRef.current.captureStream(preset.fps);
    const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

    // Choose mimeType: MP4 on iOS Safari if supported, WebM elsewhere
    const mimeType = exportMode === 'mp4'
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(mixed, {
        mimeType,
        videoBitsPerSecond: preset.id === 'pro' ? 16_000_000 : preset.id === 'std' ? 8_000_000 : 4_000_000,
      });
    } catch (err) {
      console.error('MediaRecorder init failed:', err);
      setExports((x) => x.map((j) => j.id === job.id
        ? { ...j, status: 'error', progress: 0, errorMsg: 'Recording failed to start. Try a different browser.' }
        : j));
      return;
    }

    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      setExports((x) => x.map((j) => j.id === job.id
        ? { ...j, status: 'error', progress: j.progress, errorMsg: 'Recording error. Try exporting on desktop.' }
        : j));
      try { src.stop(); } catch {}
      playingRef.current = false; setPlaying(false);
    };
       recorder.onstop = () => {
      const ext  = exportMode === 'mp4' ? 'mp4' : 'webm';
      const type = exportMode === 'mp4' ? 'video/mp4' : 'video/webm';
      const blob = new Blob(chunks, { type });
      const url  = URL.createObjectURL(blob);
 
      setExports((x) =>
        x.map((j) =>
          j.id === job.id ? { ...j, status: 'done', progress: 100, url, blob, size: blob.size } : j
        )
      );
 
      // Local persist (existing)
      if (persist && persistedId) {
        persist.updateExport(persistedId, String(job.id), { status: 'ready', sizeBytes: blob.size });
      }
 
      // Supabase persist (new) — fire-and-forget, does NOT block the download
      if (persistedId) {
        const preset = PRESETS.find((p) => p.id === presetId);
        supabaseSync
          .saveExport(persistedId, {
            exportId: String(job.id),
            exportType: ext as 'webm' | 'mp4',
            aspectRatio: aspect,
            resolution: preset ? `${preset.w}x${preset.h}` : '',
            qualityPreset: preset?.name ?? presetId,
            durationSecs: clipDuration === 'full' ? Math.min(project?.duration ?? 0, 180) : (clipDuration as number),
            blob,          // will be uploaded to Storage in background
            sizeBytes: blob.size,
          })
          .catch((err) => console.warn('[studio] export save failed silently:', err));
      }
    };
    
    recorder.start(200);

    const startedAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const pct = Math.min(100, (elapsed / dur) * 100);
      setExports((x) => x.map((j) => j.id === job.id ? { ...j, progress: pct } : j));
      if (elapsed >= dur) {
        setExports((x) => x.map((j) => j.id === job.id ? { ...j, status: 'finalizing', progress: 100 } : j));
        recorder.stop();
        try { src.stop(); } catch {}
        playingRef.current = false; setPlaying(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };   

  // ─────────────────────────────────────────────────────────────────────────
  // Export management
  // ─────────────────────────────────────────────────────────────────────────
  const deleteExport = (jobId: number, storageId?: string) => {
    setExports((x) => x.filter((j) => j.id !== jobId));
    if (storageId) deleteDBExport(storageId).catch(() => {});
    if (persist && persistedId) persist.updateExport(persistedId, String(jobId), { status: 'error' });
  };

  const downloadCloudExport = async (job: ExportJob) => {
    if (!job.storagePath) return;
    setExports((x) => x.map((j) => j.id === job.id ? { ...j, status: 'recording' } : j)); // show loading
    const url = await getExportSignedUrl(job.storagePath, 3600);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      const ext = job.storagePath.endsWith('.mp4') ? 'mp4' : 'webm';
      a.download = `${job.name}.${ext}`;
      a.click();
    }
    setExports((x) => x.map((j) => j.id === job.id ? { ...j, status: 'done' } : j));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };
  const pct = project ? (currentTime / project.duration) * 100 : 0;

  const exportModeLabel = exportMode === 'webm'
    ? '⚡ Fast in-browser · WebM'
    : exportMode === 'mp4'
      ? '📱 Mobile recording · MP4'
      : '⚠️ Unsupported browser';

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

 return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-black via-gray-950 to-black text-white overflow-hidden">
 
      {/* ── Top bar (fixed height) ──────────────────────────────── */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" onClick={onBack} className="text-gray-200 hover:bg-white/10 shrink-0 h-8 px-2">
            <ArrowLeft className="size-4 mr-1.5" /> Back
          </Button>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate flex items-center gap-2">
              {project?.fileName || 'New project'}
              {user && (
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: uploadingToCloud ? 'rgba(251,191,36,0.12)' : 'rgba(16,185,129,0.12)',
                    color: uploadingToCloud ? 'rgb(251,191,36)' : 'rgb(16,185,129)',
                  }}>
                  {uploadingToCloud ? '⏫ uploading' : '☁ synced'}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {project ? `${fmt(project.duration)} · ${ENGINES.find((e) => e.id === engine)!.name}` : 'No track loaded'}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={onPickFile} className="border-white/20 text-white hover:bg-white/10 shrink-0 h-8 text-xs">
          <Upload className="size-3.5 mr-1.5" /> Replace track
        </Button>
      </div>
 
      {/* ── Main content (fills remaining viewport) ─────────────── */}
      {/* empty */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
 
        {/* Left: canvas + transport — fixed height on mobile, flex-1 on desktop */}
        <div className="flex flex-col shrink-0 lg:flex-1 p-3 lg:p-4 gap-2 lg:gap-3 overflow-hidden h-[260px] sm:h-[300px] lg:h-auto">
 
          {/* Canvas — grows to fill, constrained by aspect ratio */}
          <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden bg-black border border-white/10">
            <AnimatePresence>
              {status === 'decoding' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-7 animate-spin text-purple-400" />
                  <div className="text-sm">Analyzing audio…</div>
                </motion.div>
              )}
              {status === 'error' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-black/85 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertCircle className="size-7 text-red-400" />
                  <div className="font-semibold text-sm">Couldn't read this file</div>
                  <div className="text-xs text-gray-400 max-w-sm">{error}</div>
                  <Button onClick={onPickFile} size="sm" className="bg-white text-gray-900 hover:bg-gray-100">
                    <RotateCw className="size-3.5 mr-1.5" /> Try another file
                  </Button>
                </motion.div>
              )}
              {status === 'idle' && !project && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center gap-3 text-center">
                  <Upload className="size-7 text-gray-300" />
                  <div className="font-semibold text-sm">No track loaded</div>
                  <Button onClick={onPickFile} size="sm" className="bg-white text-gray-900 hover:bg-gray-100">
                    Upload a track
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Canvas fills parent, aspect ratio maintained by CSS */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
 
          {/* Sign-in nudge — shown once to anonymous users after audio loads */}
          {showSignInNudge && !user && (
            <div className="shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="flex-1 text-gray-300">
                Sign in to save this project and access it from any device.
              </span>
              <Button
                size="sm"
                className="h-7 text-xs bg-white text-gray-900 hover:bg-gray-100 shrink-0"
                onClick={() => setAuthModalOpen(true)}
              >
                Sign in
              </Button>
              <button
                className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                onClick={() => setShowSignInNudge(false)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Transport bar (fixed height) */}
          <div className="shrink-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Button size="icon" disabled={!project} onClick={() => (playing ? pause() : play())}
                className="rounded-full size-9 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-40 shrink-0">
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </Button>
              <div className="text-xs text-gray-300 tabular-nums shrink-0 min-w-[70px]">
                {fmt(currentTime)} / {fmt(project?.duration ?? 0)}
              </div>
              <div className="flex-1 relative h-7 cursor-pointer"
                onClick={(e) => {
                  if (!project) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  seek(((e.clientX - rect.left) / rect.width) * project.duration);
                }}>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full" />
                <div className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full" style={{ width: `${pct}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 size-3 -ml-1.5 rounded-full bg-white shadow" style={{ left: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>
 
        {/* Right: tabbed control panel (scrollable within itself) */}
        <div className="flex-1 min-h-0 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden lg:w-[360px] lg:flex-none">
          <Tabs defaultValue="style" className="flex flex-col h-full">
            <TabsList className="grid grid-cols-5 w-full bg-white/5 rounded-none border-b border-white/10 shrink-0 h-10">
              <TabsTrigger value="style" className="text-xs">Style</TabsTrigger>
              <TabsTrigger value="motion" className="text-xs">Motion</TabsTrigger>
              <TabsTrigger value="color" className="text-xs">Color</TabsTrigger>
              <TabsTrigger value="export" className="text-xs">Export</TabsTrigger>
              <TabsTrigger value="exports" className="text-xs">History</TabsTrigger>
            </TabsList>

            {/* Session expiry banner — shown when autosave silently failed */}
            {sessionExpired && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-400/20 text-xs text-amber-300">
                <AlertCircle className="size-3.5 shrink-0" />
                <span className="flex-1">Session expired — sign in to resume saving.</span>
                <Button
                  size="sm"
                  className="h-6 text-[11px] px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/30"
                  onClick={() => setAuthModalOpen(true)}
                >
                  Sign in
                </Button>
              </div>
            )}
 
            {/* Each tab content is scrollable */}
            <div className="flex-1 overflow-y-auto">
 
              {/* ── Style ───────────────────────────────────────── */}
              <TabsContent value="style" className="p-4 space-y-4 mt-0">

                {/* ── Recommendations (shown after analysis completes) ── */}
                {recommendations.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-purple-300 mb-2 flex items-center gap-1.5">
                      <span>✦</span> Recommended for this track
                      {trackAnalysis && (
                        <span className="ml-auto text-gray-500 normal-case tracking-normal">
                          {trackAnalysis.bpm} BPM · {trackAnalysis.mood}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {recommendations.map((rec) => {
                        const engineName = ENGINES.find(e => e.id === rec.engineId)?.name ?? rec.engineId;
                        return (
                          <button
                            key={rec.engineId}
                            title={rec.reason}
                            onClick={() => setEngine(rec.engineId)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                              engine === rec.engineId
                                ? 'bg-purple-500/30 border-purple-400/60 text-purple-100'
                                : 'bg-purple-500/10 border-purple-400/20 text-purple-300 hover:bg-purple-500/20'
                            }`}
                          >
                            {engineName}
                            <span className="text-[9px] opacity-60">★</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(['2D', '3D'] as const).map((group) => (
                  <div key={group} className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-2 px-1">
                      {group === '3D' ? '3D · Immersive' : 'Classic'}
                      {group === '3D' && <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/20 text-purple-200 border border-purple-400/30">NEW</span>}
                    </div>
                    {ENGINES.filter((e) => e.group === group).map((e) => (
                      <button key={e.id} onClick={() => setEngine(e.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-xs ${engine === e.id ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                        <div className="font-semibold">{e.name}</div>
                        <div className={`text-[11px] mt-0.5 ${engine === e.id ? 'text-gray-600' : 'text-gray-400'}`}>{e.description}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </TabsContent>
 
              {/* ── Motion ──────────────────────────────────────── */}
              <TabsContent value="motion" className="p-4 space-y-5 mt-0">
                <Slider label="Beat sensitivity" value={beatSensitivity} onChange={setBeatSensitivity} min={0} max={1} step={0.01} />
                <Slider label="Particle density" value={particleDensity} onChange={setParticleDensity} min={0} max={1} step={0.01} />
                <Slider label="Smoothing" value={smoothing} onChange={setSmoothing} min={0} max={0.95} step={0.01} />
                {engine === 'depth' && (
                  <div className="space-y-4 border-t border-white/10 pt-4">
                    <div className="text-[10px] uppercase tracking-wider text-purple-300">Depth Field</div>
                    <Slider label="Base travel speed" value={baseSpeed} onChange={setBaseSpeed} min={0} max={1} step={0.01} />
                    <Slider label="Beat responsiveness" value={beatResponse} onChange={setBeatResponse} min={0} max={1} step={0.01} />
                  </div>
                )}
                <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium">Performance mode</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Reduces detail for low-power devices.</div>
                  </div>
                  <input type="checkbox" checked={perfMode} onChange={(e) => setPerfMode(e.target.checked)} className="size-4 accent-purple-500" />
                </label>
              </TabsContent>
 
              {/* ── Color ───────────────────────────────────────── */}
              <TabsContent value="color" className="p-4 space-y-2 mt-0">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Palette</div>
                {PALETTES.map((p, i) => (
                  <button key={p.name} onClick={() => setPalette(i)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${palette === i ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="flex gap-1">
                      {p.colors.map((c) => <span key={c} className="size-5 rounded" style={{ background: c }} />)}
                    </div>
                    <span className="text-xs flex-1 text-left">{p.name}</span>
                    {palette === i && <Check className="size-3.5 text-emerald-400" />}
                  </button>
                ))}
              </TabsContent>
 
              {/* ── Export (settings) ───────────────────────────── */}
              <TabsContent value="export" className="p-4 space-y-4 mt-0">
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${exportMode === 'server' ? 'bg-amber-500/10 border-amber-400/30 text-amber-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                  {exportMode === 'webm' && <Monitor className="size-3 text-emerald-400 shrink-0" />}
                  {exportMode === 'mp4' && <Smartphone className="size-3 text-blue-400 shrink-0" />}
                  {exportMode === 'server' && <AlertCircle className="size-3 text-amber-400 shrink-0" />}
                  {exportModeLabel}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Aspect ratio</div>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECTS.map((a) => (
                      <button key={a.id} onClick={() => setAspect(a.id)}
                        className={`p-2 rounded-lg border text-left ${aspect === a.id ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'}`}>
                        <div className="font-semibold text-xs">{a.label}</div>
                        <div className="text-[10px] opacity-70">{a.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Clip duration</div>
                  <div className="flex gap-2 flex-wrap">
                    {(['full', 15, 30, 60] as const).map((d) => (
                      <button key={String(d)} onClick={() => setClipDuration(d)}
                        className={`px-3 py-1.5 rounded-lg border text-xs ${clipDuration === d ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'}`}>
                        {d === 'full' ? 'Full' : `${d}s`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Quality</div>
                  <div className="space-y-1.5">
                    {PRESETS.map((p) => (
                      <button key={p.id} onClick={() => setPresetId(p.id)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs ${presetId === p.id ? 'bg-white/15 border-white/40 ring-1 ring-white/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-gray-400 text-[11px]">{p.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Button disabled={!project || status !== 'ready' || exportMode === 'server'}
                  onClick={startExport}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50">
                  <FileVideo className="size-4 mr-2" /> Start export
                </Button>
                {exportMode === 'server' && (
                  <p className="text-xs text-amber-400/80">Use Chrome or Firefox on desktop for recording.</p>
                )}
              </TabsContent>
 
        {/* ── History tab ─────────────────────────────────── */}
              <TabsContent value="exports" className="p-4 mt-0">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Export history</div>
                {exports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileVideo className="size-8 text-gray-600 mb-3" />
                    <p className="text-xs text-gray-400">No exports yet</p>
                    <p className="text-[11px] text-gray-500 mt-1">Use the Export tab to render your first video</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {exports.map((j) => {
                      const ext = j.storagePath?.endsWith('.mp4') ? 'mp4'
                                : exportMode === 'mp4' ? 'mp4' : 'webm';
                      const isCloud = !j.url && !!j.storagePath;
                      return (
                        <div key={j.id} className="rounded-xl border bg-white/5 border-white/10 p-3">
                          <div className="flex items-start gap-2.5 mb-2">
                            <div className="size-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                              <FileVideo className="size-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{j.name}.{ext}</div>
                              <div className="text-[11px] text-gray-400">{j.preset} · {j.aspect}{j.size ? ` · ${(j.size / (1024 * 1024)).toFixed(1)} MB` : ''}</div>
                            </div>
                            {/* Delete button — always visible */}
                            {(j.status === 'done' || j.status === 'error') && (
                              <button
                                onClick={() => deleteExport(j.id, j.storageId)}
                                className="size-6 flex items-center justify-center rounded hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                                title="Delete export"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                            {j.status !== 'done' && j.status !== 'error' && (
                              <Badge className="bg-amber-500/20 border-amber-400/30 text-amber-200 capitalize text-[10px]">{j.status}</Badge>
                            )}
                          </div>
                          {j.status !== 'done' && j.status !== 'error' && (
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                              <div className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all" style={{ width: `${j.progress}%` }} />
                            </div>
                          )}
                          {j.status === 'error' && j.errorMsg && (
                            <div className="text-[11px] text-red-400 flex items-center gap-1 mb-2">
                              <CloudOff className="size-3 shrink-0" /> {j.errorMsg}
                            </div>
                          )}
                          {j.status === 'done' && (
                            <div className="flex gap-2">
                              {j.url ? (
                                /* Local blob available — direct download */
                                <>
                                  <a href={j.url} download={`${j.name}.${ext}`} className="flex-1">
                                    <Button size="sm" className="w-full bg-white text-gray-900 hover:bg-gray-100 h-7 text-xs">
                                      <Download className="size-3 mr-1" /> Download
                                    </Button>
                                  </a>
                                  <Button size="sm" variant="outline"
                                    className="border-white/20 text-white hover:bg-white/10 h-7 text-xs flex-1"
                                    onClick={() => navigator.clipboard?.writeText(j.url!)}>
                                    <Share2 className="size-3 mr-1" /> Copy link
                                  </Button>
                                </>
                              ) : isCloud ? (
                                /* Cloud-stored export — re-generate signed URL */
                                <Button size="sm"
                                  className="flex-1 bg-white/10 hover:bg-white/15 text-white h-7 text-xs border border-white/20"
                                  onClick={() => downloadCloudExport(j)}>
                                  <Cloud className="size-3 mr-1" /> Download from cloud
                                </Button>
                              ) : (
                                <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                  <CloudOff className="size-3" /> No file available
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

            </div>{/* closes flex-1 overflow-y-auto */}
          </Tabs>
        </div>
        </div>
      <AuthModal open={authModalOpen} onClose={() => { setAuthModalOpen(false); clearExpiredFlag(); }} />
    </div>
  );
}

      

// ─── Slider helper component ─────────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">{label}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
      <div className="text-xs text-gray-400 mt-1">{Math.round(value * 100)}%</div>
    </div>
  );
}
