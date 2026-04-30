import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, Sparkles, Wand2, Play, Pause, Download, Music, Palette, Layers, Zap,
  Link as LinkIcon, Heart, Music2, Clock, FileVideo, Check, RotateCw, Share2, FolderOpen
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Progress } from './components/ui/progress';
import { Input } from './components/ui/input';

type EngineId = 'spectrum' | 'particles' | 'geometric' | 'liquid' | 'kaleidoscope';

type Engine = {
  id: EngineId;
  name: string;
  icon: React.ReactNode;
  description: string;
  moods: string[];
  genres: string[];
  color: string;
  version: string;
};

const ENGINES: Engine[] = [
  {
    id: 'spectrum',
    name: 'Radial Spectrum',
    icon: <Layers className="size-5" />,
    description: 'Circular frequency visualization with dynamic color shifts.',
    moods: ['High-Energy', 'Futuristic'],
    genres: ['EDM', 'Electronic'],
    color: 'from-purple-500 to-pink-500',
    version: 'v2.1'
  },
  {
    id: 'particles',
    name: 'Particle Storm',
    icon: <Sparkles className="size-5" />,
    description: 'Thousands of particles dancing to every beat.',
    moods: ['Dreamy', 'Chill'],
    genres: ['Ambient', 'Lo-fi'],
    color: 'from-blue-500 to-cyan-500',
    version: 'v1.4'
  },
  {
    id: 'geometric',
    name: 'Geometric Pulse',
    icon: <Zap className="size-5" />,
    description: 'Bold shapes morphing with bass and rhythm.',
    moods: ['Aggressive', 'High-Energy'],
    genres: ['Hip-Hop', 'Trap'],
    color: 'from-orange-500 to-red-500',
    version: 'v3.0'
  },
  {
    id: 'liquid',
    name: 'Liquid Motion',
    icon: <Wand2 className="size-5" />,
    description: 'Fluid blobs reacting to frequency bands.',
    moods: ['Organic', 'Vocal-Heavy'],
    genres: ['Lo-fi', 'Indie'],
    color: 'from-green-500 to-emerald-500',
    version: 'v2.0'
  },
  {
    id: 'kaleidoscope',
    name: 'Kaleidoscope',
    icon: <Palette className="size-5" />,
    description: 'Trippy fractal patterns synchronized with music.',
    moods: ['Trippy', 'Instrumental'],
    genres: ['Experimental', 'Psytrance'],
    color: 'from-violet-500 to-fuchsia-500',
    version: 'v1.2'
  }
];

const MOOD_FILTERS = ['All', 'High-Energy', 'Chill', 'Vocal-Heavy', 'Instrumental', 'Trippy'];

const SECTION_MARKERS = [
  { name: 'Intro', at: 4 },
  { name: 'Verse', at: 18 },
  { name: 'Chorus', at: 32 },
  { name: 'Drop', at: 48 },
  { name: 'Break', at: 70 }
];

const QUALITY_PRESETS = [
  { id: 'fast', name: 'Social Fast', res: '720p', fps: 30, size: '~24 MB', time: '~45s', tone: 'from-emerald-500 to-teal-500' },
  { id: 'standard', name: 'Creator Standard', res: '1080p', fps: 30, size: '~58 MB', time: '~1m 30s', tone: 'from-blue-500 to-indigo-500' },
  { id: 'pro', name: 'Pro Master', res: '4K', fps: 60, size: '~310 MB', time: '~6m 20s', tone: 'from-fuchsia-500 to-pink-500' }
];

const ASPECTS = [
  { id: '9:16', label: '9:16', sub: 'Vertical · TikTok / Reels' },
  { id: '1:1', label: '1:1', sub: 'Square · Instagram' },
  { id: '16:9', label: '16:9', sub: 'Horizontal · YouTube' }
];

export default function App() {
  const [activeMood, setActiveMood] = useState('All');
  const [hoveredEngine, setHoveredEngine] = useState<EngineId | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<EngineId>('spectrum');
  const [aspect, setAspect] = useState('9:16');
  const [preset, setPreset] = useState('standard');
  const [duration, setDuration] = useState('full');

  const [playing, setPlaying] = useState(true);
  const [playhead, setPlayhead] = useState(22);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  const [renderQueue, setRenderQueue] = useState<{ id: number; name: string; preset: string; aspect: string; progress: number; done: boolean }[]>([
    { id: 1, name: 'midnight-drive_v1', preset: 'Creator Standard', aspect: '9:16', progress: 100, done: true },
    { id: 2, name: 'midnight-drive_v2', preset: 'Pro Master', aspect: '16:9', progress: 42, done: false }
  ]);

  // Playhead animation
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPlayhead((p) => (p >= 100 ? 0 : p + 0.4)), 120);
    return () => clearInterval(t);
  }, [playing]);

  // Render queue progress
  useEffect(() => {
    const t = setInterval(() => {
      setRenderQueue((q) =>
        q.map((j) => (j.done ? j : { ...j, progress: Math.min(100, j.progress + 2), done: j.progress + 2 >= 100 }))
      );
    }, 400);
    return () => clearInterval(t);
  }, []);

  // Non-blocking preview update
  useEffect(() => {
    if (!updating) return;
    const t = setInterval(() => {
      setUpdateProgress((p) => {
        if (p >= 100) {
          setUpdating(false);
          return 0;
        }
        return p + 7;
      });
    }, 90);
    return () => clearInterval(t);
  }, [updating]);

  const triggerUpdate = () => {
    setUpdateProgress(0);
    setUpdating(true);
  };

  const filteredEngines = useMemo(() => {
    if (activeMood === 'All') return ENGINES;
    return ENGINES.filter((e) => e.moods.includes(activeMood));
  }, [activeMood]);

  const currentEngine = ENGINES.find((e) => e.id === selectedEngine)!;
  const currentTime = `0:${Math.floor((playhead / 100) * 180).toString().padStart(2, '0')}`;
  const totalTime = '3:00';

  const queueRender = () => {
    const presetName = QUALITY_PRESETS.find((p) => p.id === preset)!.name;
    setRenderQueue((q) => [
      ...q,
      { id: Date.now(), name: `midnight-drive_v${q.length + 1}`, preset: presetName, aspect, progress: 0, done: false }
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-1 origin-left"
                style={{
                  height: `${Math.random() * 200 + 100}px`,
                  transform: `rotate(${i * 30}deg)`,
                  background: `linear-gradient(to top, transparent, ${
                    ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'][i % 5]
                  })`
                }}
                animate={{
                  height: [`${Math.random() * 200 + 100}px`, `${Math.random() * 300 + 150}px`, `${Math.random() * 200 + 100}px`],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{ duration: 2 + Math.random(), repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 max-w-6xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Badge className="mb-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-200 px-4 py-2">
              <Sparkles className="size-4 mr-2" />
              AI-Powered Visual Generation
            </Badge>

            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Your Sound,
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                Visualized
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto mb-8">
              Upload any track. Get a beat-perfect, studio-grade visual in seconds.
            </p>
          </motion.div>

          {/* Primary CTA + URL paste */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="max-w-3xl mx-auto space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg group focus-visible:ring-4 focus-visible:ring-pink-400/60 shadow-lg shadow-pink-600/20"
              >
                <Upload className="mr-2 size-5 group-hover:scale-110 transition-transform" />
                Upload Your Track
              </Button>
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Paste track URL (YouTube / SoundCloud)"
                  className="bg-white/95 text-gray-900 placeholder:text-gray-500 border-0 pl-9 h-full min-h-[60px]"
                />
              </div>
            </div>
            <p className="text-sm text-gray-400">
              or drop an audio file here · MP3, WAV, FLAC up to 50&nbsp;MB
            </p>
          </motion.div>

          {/* Qualitative proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="pt-12 flex flex-wrap gap-3 justify-center"
          >
            {[
              { label: 'Loved by indie musicians', g: 'from-pink-500 to-rose-500' },
              { label: 'Built for content creators', g: 'from-blue-500 to-indigo-500' },
              { label: 'Perfect for beat makers', g: 'from-amber-500 to-orange-500' }
            ].map((p) => (
              <Card key={p.label} className="bg-white/5 border-white/10 backdrop-blur-sm px-5 py-3 flex items-center gap-3">
                <span className={`size-2 rounded-full bg-gradient-to-r ${p.g}`} />
                <span className="text-sm text-gray-200">{p.label}</span>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* THREE STEPS */}
      <section className="relative py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Three Steps to Magic</span>
            </h2>
            <p className="text-lg text-gray-300">From raw audio to ready-to-post in roughly a minute.</p>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Upload Your Audio',
                benefit: 'Drop any MP3, WAV, or FLAC. We auto-detect tempo, energy, and emotional peaks to drive the visuals.',
                eta: '≈ 10 seconds',
                icon: <Upload className="size-8" />,
                color: 'from-purple-500 to-pink-500'
              },
              {
                step: '02',
                title: 'Choose Your Vibe',
                benefit: 'Get AI-recommended visual engines that match your track’s mood, then customize colors, motion, and intensity.',
                eta: '≈ 20 seconds',
                icon: <Palette className="size-8" />,
                color: 'from-blue-500 to-cyan-500'
              },
              {
                step: '03',
                title: 'Export & Share',
                benefit: 'Render in 9:16, 1:1, or 16:9 with quality presets up to 4K — optimized for TikTok, Reels, and YouTube.',
                eta: '≈ 30–60 seconds',
                icon: <Download className="size-8" />,
                color: 'from-green-500 to-emerald-500'
              }
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                <Card className="bg-gradient-to-r from-white/5 to-transparent border-white/10 backdrop-blur-sm p-8 hover:border-white/20 transition-colors">
                  <div className="flex items-start gap-6">
                    <div className={`flex-shrink-0 size-16 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
                        <span className="text-3xl font-bold text-gray-600">{item.step}</span>
                        <h3 className="text-2xl font-semibold">{item.title}</h3>
                        <Badge variant="outline" className="border-white/20 text-gray-300">
                          <Clock className="size-3 mr-1" /> {item.eta}
                        </Badge>
                      </div>
                      <p className="text-gray-100 text-lg leading-relaxed">{item.benefit}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* VISUAL ENGINES */}
      <section className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Visual Engines</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Each engine is a unique visual language. Filter by mood, then load it into your project or play a quick demo.
            </p>
          </motion.div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {MOOD_FILTERS.map((m) => (
              <button
                key={m}
                onClick={() => setActiveMood(m)}
                className={`px-4 py-2 rounded-full text-sm border transition-all ${
                  activeMood === m
                    ? 'bg-white text-gray-900 border-white shadow-lg shadow-white/10'
                    : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredEngines.map((engine, i) => {
                const isHover = hoveredEngine === engine.id;
                return (
                  <motion.div
                    key={engine.id}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -6 }}
                    onHoverStart={() => setHoveredEngine(engine.id)}
                    onHoverEnd={() => setHoveredEngine(null)}
                  >
                    <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-md overflow-hidden h-full flex flex-col">
                      {/* Hover micro-preview header */}
                      <div className={`h-36 bg-gradient-to-br ${engine.color} relative overflow-hidden`}>
                        <motion.div
                          className="absolute inset-0 bg-black/30"
                          animate={{ opacity: isHover ? [0.3, 0.55, 0.3] : 0.3 }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                        />
                        {/* mini animated bars on hover */}
                        <div className="absolute inset-0 flex items-end justify-center gap-1 px-6 pb-4">
                          {[...Array(24)].map((_, j) => (
                            <motion.div
                              key={j}
                              className="w-1 rounded-full bg-white/70"
                              animate={{
                                height: isHover
                                  ? [`${10 + Math.random() * 40}px`, `${20 + Math.random() * 70}px`, `${10 + Math.random() * 40}px`]
                                  : `${10 + (j % 5) * 6}px`
                              }}
                              transition={{ duration: 0.6 + (j % 5) * 0.05, repeat: Infinity }}
                            />
                          ))}
                        </div>
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <div className="size-8 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            {engine.icon}
                          </div>
                          <span className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded">{engine.version}</span>
                        </div>
                      </div>

                      <div className="p-6 space-y-4 flex-1 flex flex-col">
                        <div>
                          <h3 className="text-xl font-semibold mb-1">{engine.name}</h3>
                          <p className="text-sm text-gray-300">{engine.description}</p>
                        </div>

                        {/* Tag distinction: filled mood pills, outlined genre pills */}
                        <div className="flex flex-wrap gap-2">
                          {engine.moods.map((mood) => (
                            <span
                              key={mood}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/30 text-purple-100 border border-purple-400/30"
                            >
                              <Heart className="size-3" /> {mood}
                            </span>
                          ))}
                          {engine.genres.map((g) => (
                            <span
                              key={g}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-white/25 text-gray-200"
                            >
                              <Music2 className="size-3" /> {g}
                            </span>
                          ))}
                        </div>

                        <div className="mt-auto flex gap-2 pt-2">
                          <Button
                            onClick={() => {
                              setSelectedEngine(engine.id);
                              triggerUpdate();
                            }}
                            className="flex-1 bg-white text-gray-900 hover:bg-gray-100"
                          >
                            Use with My Track
                          </Button>
                          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                            <Play className="size-4 mr-1" /> Demo
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* LIVE PREVIEW + EDITOR */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">Live Preview</span>
            </h2>
            <p className="text-lg text-gray-300">Tune every beat, instantly.</p>
          </motion.div>

          <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl overflow-hidden">
            {/* Project header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`size-9 rounded-lg bg-gradient-to-br ${currentEngine.color} flex items-center justify-center`}>
                  {currentEngine.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold">midnight-drive.mp3</div>
                  <div className="text-xs text-gray-400">
                    3:00 · 124 BPM · {currentEngine.name} {currentEngine.version}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="px-2 py-1 rounded bg-white/10 border border-white/10">Preview: Adaptive (540–720p)</span>
                <span className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                  {playing ? 'Playing' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Canvas */}
            <div className="aspect-video bg-black/60 relative flex items-center justify-center overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${currentEngine.color} opacity-20`} />
              {/* simulated visual */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="size-72 rounded-full"
                  style={{
                    background: `radial-gradient(circle, rgba(255,255,255,0.4), transparent 60%)`
                  }}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              </div>

              {/* waveform */}
              <div className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center gap-[3px] px-8 pb-3">
                {[...Array(80)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
                    animate={{ height: [`${Math.random() * 50 + 12}px`, `${Math.random() * 50 + 12}px`] }}
                    transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.01 }}
                  />
                ))}
              </div>

              {/* Non-blocking update bar */}
              <AnimatePresence>
                {updating && (
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="absolute top-3 left-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-3 border border-white/10"
                  >
                    <RotateCw className="size-4 animate-spin text-purple-300" />
                    <span className="text-xs text-gray-200 flex-1">Updating preview… {updateProgress}%</span>
                    <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-400 to-pink-400" style={{ width: `${updateProgress}%` }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Transport + Timeline with markers */}
            <div className="px-6 py-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-4">
                <Button
                  size="icon"
                  onClick={() => setPlaying((p) => !p)}
                  className="rounded-full size-10 bg-white text-gray-900 hover:bg-gray-100"
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <div className="text-xs text-gray-300 tabular-nums">
                  {currentTime} / {totalTime}
                </div>
                <div className="flex-1 relative h-10">
                  {/* energy waveform background */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 flex items-center gap-[2px]">
                    {[...Array(120)].map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-white/15 rounded-full"
                        style={{ height: `${20 + Math.abs(Math.sin(i * 0.4)) * 70}%` }}
                      />
                    ))}
                  </div>
                  {/* markers */}
                  {SECTION_MARKERS.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => setPlayhead(m.at)}
                      className="absolute -top-1 group"
                      style={{ left: `${m.at}%` }}
                    >
                      <div className="size-2 rounded-full bg-amber-300 ring-2 ring-black/40" />
                      <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-amber-200 whitespace-nowrap opacity-70 group-hover:opacity-100">
                        {m.name}
                      </span>
                    </button>
                  ))}
                  {/* playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]"
                    style={{ left: `${playhead}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Editor tabs */}
            <div className="p-6 border-t border-white/10">
              <Tabs defaultValue="style" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-white/5">
                  <TabsTrigger value="style">Style</TabsTrigger>
                  <TabsTrigger value="motion">Motion</TabsTrigger>
                  <TabsTrigger value="color">Color</TabsTrigger>
                  <TabsTrigger value="export">Export</TabsTrigger>
                </TabsList>

                <TabsContent value="style" className="space-y-4 pt-6">
                  <div className="text-xs uppercase tracking-wider text-gray-400">Active engine</div>
                  <div className="flex flex-wrap gap-2">
                    {ENGINES.map((engine) => (
                      <button
                        key={engine.id}
                        onClick={() => {
                          setSelectedEngine(engine.id);
                          triggerUpdate();
                        }}
                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                          selectedEngine === engine.id
                            ? 'bg-white text-gray-900 border-white'
                            : 'bg-white/5 border-white/15 text-gray-200 hover:bg-white/10'
                        }`}
                      >
                        {engine.name}
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="motion" className="pt-6 space-y-6">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Beat Reactivity</div>
                    <label className="text-sm text-gray-300 mb-2 block">Beat sensitivity</label>
                    <Progress value={75} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Camera Movement</div>
                    <label className="text-sm text-gray-300 mb-2 block">Sway intensity</label>
                    <Progress value={50} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Particle Density</div>
                    <label className="text-sm text-gray-300 mb-2 block">Count</label>
                    <Progress value={62} />
                  </div>
                  <Button variant="outline" onClick={triggerUpdate} className="border-white/20 text-white hover:bg-white/10">
                    <RotateCw className="size-4 mr-2" /> Apply changes
                  </Button>
                </TabsContent>

                <TabsContent value="color" className="pt-6">
                  <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Palette</div>
                  <div className="flex gap-2">
                    {['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'].map((color) => (
                      <button
                        key={color}
                        onClick={triggerUpdate}
                        className="size-12 rounded-lg border-2 border-white/20 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="export" className="pt-6 space-y-6">
                  {/* Aspect */}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Aspect ratio</div>
                    <div className="grid grid-cols-3 gap-2">
                      {ASPECTS.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setAspect(a.id)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            aspect === a.id ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-semibold">{a.label}</div>
                          <div className="text-xs opacity-70">{a.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Duration</div>
                    <div className="flex flex-wrap gap-2">
                      {['full', '15s', '30s', '60s'].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          className={`px-3 py-2 rounded-lg border text-sm ${
                            duration === d ? 'bg-white text-gray-900 border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'
                          }`}
                        >
                          {d === 'full' ? 'Full Track' : `Clip · ${d}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality presets */}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Quality preset</div>
                    <div className="grid md:grid-cols-3 gap-3">
                      {QUALITY_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPreset(p.id)}
                          className={`text-left p-4 rounded-xl border transition-all ${
                            preset === p.id
                              ? 'bg-white/10 border-white/40 ring-2 ring-white/30'
                              : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                          }`}
                        >
                          <div className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-gradient-to-r ${p.tone} text-white mb-2`}>
                            {p.res} · {p.fps}fps
                          </div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {p.size} · {p.time}
                          </div>
                          {preset === p.id && (
                            <div className="mt-2 text-xs text-emerald-300 flex items-center gap-1">
                              <Check className="size-3" /> Selected
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={queueRender}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-6"
                  >
                    <FileVideo className="size-5 mr-2" /> Queue export
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          {/* Render queue / Versions */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold">Exports & Versions</h3>
              <span className="text-sm text-gray-400">{renderQueue.filter((j) => !j.done).length} rendering</span>
            </div>
            <div className="space-y-3">
              {renderQueue.map((job) => (
                <Card key={job.id} className="bg-white/5 border-white/10 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="size-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <FileVideo className="size-5" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold text-sm">{job.name}.mp4</div>
                      <div className="text-xs text-gray-400">
                        {job.preset} · {job.aspect}
                      </div>
                      {!job.done && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {job.progress}% · ~{Math.max(1, Math.round((100 - job.progress) / 8))}s left
                          </span>
                        </div>
                      )}
                    </div>
                    {job.done ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-white text-gray-900 hover:bg-gray-100">
                          <Download className="size-4 mr-1" /> Download
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                          <Share2 className="size-4 mr-1" /> Share
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                          <FolderOpen className="size-4 mr-1" /> Open
                        </Button>
                      </div>
                    ) : (
                      <Badge className="bg-amber-500/20 border-amber-400/30 text-amber-200">Rendering</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-3xl" />
            <Card className="relative bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl p-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to bring your sound to life?</h2>
              <p className="text-xl text-gray-200 mb-8">Every project keeps your settings, sections, and export history in one place.</p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-6 text-xl"
              >
                <Sparkles className="mr-2 size-6" />
                Start a Project — Free
              </Button>
            </Card>
          </motion.div>
        </div>
      </section>

      <footer className="relative py-12 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center text-gray-500">
          <p>© 2026 Audio Visualizer AI. Making every track visual.</p>
        </div>
      </footer>
    </div>
  );
}
