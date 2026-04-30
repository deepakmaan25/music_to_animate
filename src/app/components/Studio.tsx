import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, Upload, Download, ArrowLeft, RotateCw, FileVideo, Check, Loader2, AlertCircle, Share2
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import type { usePersistentProjects } from '../hooks/usePersistentProjects';

type EngineId = 'bars' | 'radial' | 'particles';
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
  name: string;
  preset: string;
  aspect: string;
  status: 'recording' | 'finalizing' | 'done' | 'error';
  progress: number;
  url?: string;
  blob?: Blob;
  size?: number;
};

const ENGINES: { id: EngineId; name: string; description: string }[] = [
  { id: 'bars', name: 'Spectrum Bars', description: 'Classic frequency bars across the canvas.' },
  { id: 'radial', name: 'Radial Spectrum', description: 'Bars radiating from the center.' },
  { id: 'particles', name: 'Particle Storm', description: 'Particles driven by bass energy.' }
];

const PALETTES: { name: string; colors: [string, string, string] }[] = [
  { name: 'Sunset', colors: ['#8b5cf6', '#ec4899', '#f59e0b'] },
  { name: 'Ocean', colors: ['#06b6d4', '#3b82f6', '#8b5cf6'] },
  { name: 'Forest', colors: ['#10b981', '#84cc16', '#fbbf24'] },
  { name: 'Mono', colors: ['#ffffff', '#9ca3af', '#4b5563'] }
];

const PRESETS = [
  { id: 'fast', name: 'Social Fast', w: 720, h: 1280, fps: 30, label: '720p · 30fps' },
  { id: 'std', name: 'Creator Standard', w: 1080, h: 1920, fps: 30, label: '1080p · 30fps' },
  { id: 'pro', name: 'Pro Master', w: 2160, h: 3840, fps: 60, label: '4K · 60fps' }
];

const ASPECTS: { id: '9:16' | '1:1' | '16:9'; label: string; sub: string }[] = [
  { id: '9:16', label: '9:16', sub: 'TikTok / Reels' },
  { id: '1:1', label: '1:1', sub: 'Instagram' },
  { id: '16:9', label: '16:9', sub: 'YouTube' }
];

type Persist = ReturnType<typeof usePersistentProjects>;

type StudioProps = {
  initialFile: File | null;
  initialEngine?: EngineId;
  projectId?: string | null;
  persist?: Persist;
  onBack: () => void;
};

export function Studio({ initialFile, initialEngine = 'bars', projectId, persist, onBack }: StudioProps) {
  const stored = projectId && persist ? persist.projects[projectId] : null;

  const [status, setStatus] = useState<Status>(stored ? 'idle' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [persistedId, setPersistedId] = useState<string | null>(projectId ?? null);
  const [engine, setEngine] = useState<EngineId>((stored?.engineId as EngineId) ?? initialEngine);
  const [palette, setPalette] = useState(stored?.style.palette ?? 0);
  const [beatSensitivity, setBeatSensitivity] = useState(stored?.motion.beatSensitivity ?? 0.7);
  const [particleDensity, setParticleDensity] = useState(stored?.motion.particleDensity ?? 0.6);
  const [smoothing, setSmoothing] = useState(stored?.motion.smoothing ?? 0.8);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [aspect, setAspect] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [presetId, setPresetId] = useState('std');
  const [clipDuration, setClipDuration] = useState<'full' | 15 | 30 | 60>('full');

  const [exports, setExports] = useState<ExportJob[]>([]);

  // Audio refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; hue: number }[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Load file when provided
  useEffect(() => {
    if (initialFile) loadFile(initialFile);
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update analyser smoothing
  useEffect(() => {
    if (analyserRef.current) analyserRef.current.smoothingTimeConstant = smoothing;
  }, [smoothing]);

  // Persist setting changes
  useEffect(() => {
    if (!persist || !persistedId) return;
    persist.updateProject(persistedId, {
      engineId: engine,
      style: { palette },
      motion: { beatSensitivity, particleDensity, smoothing }
    });
  }, [engine, palette, beatSensitivity, particleDensity, smoothing, persistedId, persist]);

  const stopAudio = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  };

  async function loadFile(file: File) {
    setStatus('decoding');
    setError(null);
    try {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a)$/i.test(file.name)) {
        throw new Error('Unsupported file type. Try MP3, WAV, or FLAC.');
      }
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File too large (max 100 MB).');
      }
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
      const newProj: Project = {
        id: `prj_${Date.now()}`,
        fileName: file.name,
        duration: audioBuffer.duration,
        audioBuffer,
        engine: initialEngine
      };
      setProject(newProj);
      setStatus('ready');

      // Persist new project metadata
      if (persist && !persistedId) {
        const created = persist.createProject(
          { name: file.name, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate },
          engine
        );
        setPersistedId(created.id);
      } else if (persist && persistedId) {
        persist.updateProject(persistedId, {
          audioMeta: { name: file.name, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate }
        });
      }
    } catch (e: any) {
      setStatus('error');
      setError(e.message || 'Failed to decode audio.');
    }
  }

  const play = async () => {
    if (!project || !audioCtxRef.current || !analyserRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = project.audioBuffer;
    src.connect(analyserRef.current);
    src.onended = () => {
      if (sourceRef.current === src) {
        setPlaying(false);
        offsetRef.current = 0;
      }
    };
    src.start(0, offsetRef.current);
    startedAtRef.current = ctx.currentTime - offsetRef.current;
    sourceRef.current = src;
    setPlaying(true);
    runVisualizationLoop();
  };

  const pause = () => {
    if (!sourceRef.current || !audioCtxRef.current) return;
    offsetRef.current = audioCtxRef.current.currentTime - startedAtRef.current;
    try { sourceRef.current.stop(); } catch {}
    sourceRef.current.disconnect();
    sourceRef.current = null;
    setPlaying(false);
  };

  const seek = (t: number) => {
    const wasPlaying = playing;
    if (wasPlaying) pause();
    offsetRef.current = Math.max(0, Math.min(t, project?.duration ?? 0));
    setCurrentTime(offsetRef.current);
    if (wasPlaying) play();
    else drawFrame();
  };

  // Visualization loop
  const runVisualizationLoop = () => {
    const tick = () => {
      drawFrame();
      if (audioCtxRef.current && playing) {
        setCurrentTime(audioCtxRef.current.currentTime - startedAtRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  // Keep drawing even when paused (one frame to refresh on param change)
  useEffect(() => {
    drawFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, palette, beatSensitivity, particleDensity, project, aspect]);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const analyser = analyserRef.current;
    const w = canvas.width;
    const h = canvas.height;
    const colors = PALETTES[palette].colors;

    // background
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, 'rgba(10,10,15,1)');
    bg.addColorStop(1, 'rgba(20,20,30,1)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (!analyser) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a track to begin', w / 2, h / 2);
      return;
    }

    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);
    const time = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(time);

    const sens = 0.5 + beatSensitivity * 1.5;

    if (engine === 'bars') {
      const bars = 80;
      const step = Math.floor(freq.length / bars);
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = (freq[i * step] / 255) * sens;
        const bh = v * h * 0.6;
        const grad = ctx.createLinearGradient(0, h - bh, 0, h);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(0.5, colors[1]);
        grad.addColorStop(1, colors[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(i * barW + 2, h - bh, barW - 4, bh);
      }
    } else if (engine === 'radial') {
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.15;
      const bars = 96;
      const step = Math.floor(freq.length / bars);
      // Inner pulsing core
      const bass = freq.slice(0, 8).reduce((a, b) => a + b, 0) / 8 / 255;
      const coreR = baseR + bass * baseR * sens;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreGrad.addColorStop(0, colors[0]);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
      // Bars
      for (let i = 0; i < bars; i++) {
        const v = (freq[i * step] / 255) * sens;
        const len = baseR + v * Math.min(w, h) * 0.35;
        const angle = (i / bars) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * len;
        const y2 = cy + Math.sin(angle) * len;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, colors[1]);
        grad.addColorStop(1, colors[2]);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    } else if (engine === 'particles') {
      // fade trail
      ctx.fillStyle = 'rgba(10,10,15,0.18)';
      ctx.fillRect(0, 0, w, h);
      const bass = freq.slice(0, 16).reduce((a, b) => a + b, 0) / 16 / 255;
      const spawn = Math.floor((bass * sens) * (4 + particleDensity * 10));
      for (let i = 0; i < spawn; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + bass * 6 * sens;
        particlesRef.current.push({
          x: w / 2,
          y: h / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          hue: Math.random()
        });
      }
      const max = 400 + Math.floor(particleDensity * 600);
      if (particlesRef.current.length > max) {
        particlesRef.current.splice(0, particlesRef.current.length - max);
      }
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life *= 0.985;
        const c = colors[Math.floor(p.hue * colors.length)] || colors[0];
        ctx.fillStyle = c;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + bass * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0.05);
    }

    // overlay label
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Preview · Adaptive quality', 14, 22);
  };

  // Resize canvas to aspect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const baseW = 960;
    const ratio = aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 16 / 9;
    canvas.width = aspect === '9:16' ? 540 : baseW;
    canvas.height = Math.round(canvas.width / ratio);
    drawFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // File picker
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopAudio();
      setPlaying(false);
      offsetRef.current = 0;
      loadFile(file);
    }
  };

  // Export via MediaRecorder
  const startExport = async () => {
    if (!project || !canvasRef.current || !audioCtxRef.current || !analyserRef.current) return;
    const preset = PRESETS.find((p) => p.id === presetId)!;
    const dur =
      clipDuration === 'full'
        ? Math.min(project.duration, 180)
        : (clipDuration as number);

    const job: ExportJob = {
      id: Date.now(),
      name: `${project.fileName.replace(/\.[^.]+$/, '')}_${aspect.replace(':', 'x')}_${preset.id}`,
      preset: preset.name,
      aspect,
      status: 'recording',
      progress: 0
    };
    setExports((x) => [...x, job]);

    if (persist && persistedId) {
      persist.addExport(persistedId, {
        id: String(job.id),
        createdAt: Date.now(),
        type: 'webm',
        status: 'recording',
        aspectRatio: aspect,
        resolution: `${preset.w}x${preset.h}`,
        duration: dur,
        qualityPreset: preset.name
      });
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    // restart playback at 0 routed through analyser + dest stream
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
    }
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = project.audioBuffer;
    src.connect(analyserRef.current);
    analyserRef.current.connect(dest);
    sourceRef.current = src;
    src.start(0, 0);
    startedAtRef.current = ctx.currentTime;
    offsetRef.current = 0;
    setPlaying(true);
    runVisualizationLoop();

    const canvasStream = canvasRef.current.captureStream(preset.fps);
    const mixed = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: preset.id === 'pro' ? 16_000_000 : preset.id === 'std' ? 8_000_000 : 4_000_000 });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setExports((x) => x.map((j) => (j.id === job.id ? { ...j, status: 'done', progress: 100, url, blob, size: blob.size } : j)));
      if (persist && persistedId) {
        persist.updateExport(persistedId, String(job.id), { status: 'ready', sizeBytes: blob.size });
      }
    };
    recorder.start(200);

    const startedAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const pct = Math.min(100, (elapsed / dur) * 100);
      setExports((x) => x.map((j) => (j.id === job.id ? { ...j, progress: pct } : j)));
      if (elapsed >= dur) {
        setExports((x) => x.map((j) => (j.id === job.id ? { ...j, status: 'finalizing', progress: 100 } : j)));
        recorder.stop();
        try { src.stop(); } catch {}
        setPlaying(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  const pct = project ? (currentTime / project.duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black dark:from-black dark:via-gray-950 dark:to-black text-white">
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={onFileChange} />

      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="text-gray-200 hover:bg-white/10">
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>
          <div>
            <div className="text-sm font-semibold">
              {project?.fileName || 'New project'}
            </div>
            <div className="text-xs text-gray-400">
              {project ? `${fmt(project.duration)} · ${ENGINES.find((e) => e.id === engine)!.name}` : 'No track loaded'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onPickFile} className="border-white/20 text-white hover:bg-white/10">
            <Upload className="size-4 mr-2" /> Replace track
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 p-6">
        {/* Preview */}
        <div className="space-y-4">
          <Card className="bg-black border-white/10 overflow-hidden relative">
            {/* Status overlays */}
            <AnimatePresence>
              {status === 'decoding' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center gap-3"
                >
                  <Loader2 className="size-8 animate-spin text-purple-400" />
                  <div className="text-sm">Analyzing audio…</div>
                </motion.div>
              )}
              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-black/85 flex flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  <AlertCircle className="size-8 text-red-400" />
                  <div className="font-semibold">Couldn't read this file</div>
                  <div className="text-sm text-gray-400 max-w-md">{error}</div>
                  <Button onClick={onPickFile} className="bg-white text-gray-900 hover:bg-gray-100">
                    <RotateCw className="size-4 mr-2" /> Try another file
                  </Button>
                </motion.div>
              )}
              {status === 'idle' && !project && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  <Upload className="size-8 text-gray-300" />
                  <div className="font-semibold">No track loaded</div>
                  <Button onClick={onPickFile} className="bg-white text-gray-900 hover:bg-gray-100">
                    Upload Your Track
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <canvas ref={canvasRef} className="w-full h-auto block" style={{ aspectRatio: aspect.replace(':', '/') }} />
          </Card>

          {/* Transport */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                size="icon"
                disabled={!project}
                onClick={() => (playing ? pause() : play())}
                className="rounded-full size-10 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-40"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <div className="text-xs text-gray-300 tabular-nums min-w-[80px]">
                {fmt(currentTime)} / {fmt(project?.duration ?? 0)}
              </div>
              <div
                className="flex-1 relative h-8 cursor-pointer"
                onClick={(e) => {
                  if (!project) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seek(ratio * project.duration);
                }}
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 size-3 -ml-1.5 rounded-full bg-white shadow"
                  style={{ left: `${pct}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Exports list */}
          {exports.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Exports</h3>
              <div className="space-y-2">
                {exports.map((j) => (
                  <Card key={j.id} className="bg-white/5 border-white/10 p-3 flex items-center gap-3 flex-wrap">
                    <div className="size-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <FileVideo className="size-4" />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-sm font-semibold">{j.name}.webm</div>
                      <div className="text-xs text-gray-400">{j.preset} · {j.aspect}{j.size ? ` · ${(j.size / (1024 * 1024)).toFixed(1)} MB` : ''}</div>
                      {j.status !== 'done' && (
                        <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all" style={{ width: `${j.progress}%` }} />
                        </div>
                      )}
                    </div>
                    {j.status === 'done' && j.url ? (
                      <div className="flex gap-2">
                        <a href={j.url} download={`${j.name}.webm`}>
                          <Button size="sm" className="bg-white text-gray-900 hover:bg-gray-100">
                            <Download className="size-4 mr-1" /> Download
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-white hover:bg-white/10"
                          onClick={() => navigator.clipboard?.writeText(j.url!)}
                        >
                          <Share2 className="size-4 mr-1" /> Copy link
                        </Button>
                      </div>
                    ) : (
                      <Badge className="bg-amber-500/20 border-amber-400/30 text-amber-200 capitalize">{j.status}</Badge>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <Card className="bg-white/5 border-white/10 p-4 h-fit lg:sticky lg:top-6">
          <Tabs defaultValue="style">
            <TabsList className="grid grid-cols-4 w-full bg-white/5">
              <TabsTrigger value="style">Style</TabsTrigger>
              <TabsTrigger value="motion">Motion</TabsTrigger>
              <TabsTrigger value="color">Color</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="style" className="pt-4 space-y-3">
              <div className="text-xs uppercase tracking-wider text-gray-400">Engine</div>
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEngine(e.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    engine === e.id ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold text-sm">{e.name}</div>
                  <div className={`text-xs ${engine === e.id ? 'text-gray-600' : 'text-gray-400'}`}>{e.description}</div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="motion" className="pt-4 space-y-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Beat sensitivity</div>
                <input
                  type="range" min={0} max={1} step={0.01} value={beatSensitivity}
                  onChange={(e) => setBeatSensitivity(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">{Math.round(beatSensitivity * 100)}%</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Particle density</div>
                <input
                  type="range" min={0} max={1} step={0.01} value={particleDensity}
                  onChange={(e) => setParticleDensity(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">{Math.round(particleDensity * 100)}%</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Smoothing</div>
                <input
                  type="range" min={0} max={0.95} step={0.01} value={smoothing}
                  onChange={(e) => setSmoothing(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">{Math.round(smoothing * 100)}%</div>
              </div>
            </TabsContent>

            <TabsContent value="color" className="pt-4 space-y-3">
              <div className="text-xs uppercase tracking-wider text-gray-400">Palette</div>
              {PALETTES.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPalette(i)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                    palette === i ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex gap-1">
                    {p.colors.map((c) => (
                      <span key={c} className="size-6 rounded" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-sm">{p.name}</span>
                  {palette === i && <Check className="size-4 ml-auto text-emerald-400" />}
                </button>
              ))}
            </TabsContent>

            <TabsContent value="export" className="pt-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Aspect</div>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAspect(a.id)}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        aspect === a.id ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-semibold">{a.label}</div>
                      <div className="opacity-70">{a.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Duration</div>
                <div className="flex gap-2 flex-wrap">
                  {(['full', 15, 30, 60] as const).map((d) => (
                    <button
                      key={String(d)}
                      onClick={() => setClipDuration(d)}
                      className={`px-3 py-1.5 rounded-lg border text-xs ${
                        clipDuration === d ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'
                      }`}
                    >
                      {d === 'full' ? 'Full' : `${d}s`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Quality</div>
                <div className="space-y-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPresetId(p.id)}
                      className={`w-full text-left p-2 rounded-lg border text-xs ${
                        presetId === p.id ? 'bg-white/15 border-white/40 ring-1 ring-white/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-gray-400">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                disabled={!project || status !== 'ready'}
                onClick={startExport}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                <FileVideo className="size-4 mr-2" /> Start export
              </Button>
              <p className="text-xs text-gray-400">
                Records the live canvas + audio in real time using your browser. Output: WebM.
              </p>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
