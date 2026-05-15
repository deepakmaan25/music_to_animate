/**
 * SharePage — public-facing video share page
 * Route: /share?v=<signedUrl>&n=<trackName>&e=<engineId>&a=<aspect>
 *
 * No auth required. The signed URL in `v` carries its own expiry (7 days).
 * Opens in a new tab from the Studio share button.
 */

import { useEffect, useRef, useState } from 'react';
import { Download, Play, Pause, Volume2, VolumeX, ExternalLink } from 'lucide-react';

const ENGINE_LABELS: Record<string, string> = {
  bars:        'Spectrum Bars',
  radial:      'Radial Spectrum',
  orbital:     'Orbital Rings',
  depth:       'Depth Field',
  terrain:     'Audio Terrain',
  tunnel:      'Liquid Aurora',
  neon_spheres:'Neon Spheres',
  fractal:     'Fractal Kaleidoscope',
  solar:       'Geometric Pulse',
};

const ASPECT_LABELS: Record<string, string> = {
  '9:16': 'TikTok / Reels',
  '1:1':  'Instagram',
  '16:9': 'YouTube',
};

export function SharePage() {
  const params   = new URLSearchParams(window.location.search);
  const videoUrl = params.get('v') ?? '';
  const trackName = params.get('n') ?? 'Untitled Track';
  const engineId  = params.get('e') ?? '';
  const aspect    = params.get('a') ?? '9:16';

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded,   setLoaded]   = useState(false);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    document.title = `${trackName} — Music Animate`;
  }, [trackName]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm">No video URL provided.</p>
          <a href="/" className="text-purple-400 text-xs mt-3 inline-block hover:underline">← Back to Music Animate</a>
        </div>
      </div>
    );
  }

  // Aspect ratio → CSS classes for the video wrapper
  const aspectClass =
    aspect === '1:1'  ? 'aspect-square max-w-[480px]' :
    aspect === '16:9' ? 'aspect-video  max-w-[800px]' :
                        'aspect-[9/16] max-w-[340px]';

  return (
    <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-start px-4 py-8 md:py-14"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Nav bar */}
      <div className="w-full max-w-[860px] flex items-center justify-between mb-8">
        <a href="/" className="flex items-center gap-2 group">
          {/* Favicon-matching gradient wordmark */}
          <div className="size-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#a855f7 0%,#ec4899 50%,#f59e0b 100%)' }}>
            <svg viewBox="0 0 16 16" className="size-4 fill-white" aria-hidden="true">
              <rect x="1.5" y="8"  width="2.5" height="7" rx="1" />
              <rect x="5.5" y="4"  width="2.5" height="11" rx="1" />
              <rect x="9.5" y="6"  width="2.5" height="9" rx="1" />
              <rect x="13"  y="10" width="2.5" height="5" rx="1" />
            </svg>
          </div>
          <span className="text-white/70 text-sm font-medium group-hover:text-white/90 transition-colors">Music Animate</span>
        </a>
        <a href="/"
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors">
          <ExternalLink className="size-3" /> Create yours
        </a>
      </div>

      {/* Video card */}
      <div className="w-full max-w-[860px] flex flex-col md:flex-row gap-8 items-start justify-center">

        {/* Video player */}
        <div className={`relative w-full ${aspectClass} mx-auto md:mx-0 shrink-0 rounded-2xl overflow-hidden shadow-2xl`}
          style={{ boxShadow: '0 0 80px -20px rgba(168,85,247,0.35)' }}>

          {/* Glow border */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }} />

          {/* Loading state */}
          {!loaded && !error && (
            <div className="absolute inset-0 bg-[#0d0d18] flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
                <p className="text-[11px] text-white/30">Loading video…</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 bg-[#0d0d18] flex items-center justify-center z-20">
              <div className="text-center px-6">
                <p className="text-white/60 text-sm font-medium mb-1">Link expired</p>
                <p className="text-white/30 text-xs">This share link has expired. Ask the creator to share a new one.</p>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            src={videoUrl}
            loop
            playsInline
            muted={muted}
            className="w-full h-full object-cover"
            onLoadedData={() => { setLoaded(true); setDuration(videoRef.current?.duration ?? 0); }}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
            }}
            onError={() => setError(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          {/* Overlay controls — bottom gradient */}
          {loaded && (
            <div className="absolute inset-x-0 bottom-0 z-10"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
              {/* Progress bar */}
              <div className="mx-3 mb-2 h-0.5 bg-white/15 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const v = videoRef.current;
                  if (!v) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
                }}>
                <div className="h-full rounded-full transition-[width]"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#a855f7,#ec4899)' }} />
              </div>
              {/* Controls row */}
              <div className="flex items-center gap-2 px-3 pb-3">
                <button onClick={toggle}
                  className="size-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors backdrop-blur-sm">
                  {playing
                    ? <Pause className="size-3.5 text-white" />
                    : <Play  className="size-3.5 text-white" />}
                </button>
                <span className="text-[10px] text-white/50 tabular-nums">
                  {fmt((progress / 100) * duration)} / {fmt(duration)}
                </span>
                <button onClick={() => { setMuted(m => !m); }}
                  className="ml-auto size-7 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors">
                  {muted
                    ? <VolumeX className="size-3.5 text-white/50" />
                    : <Volume2 className="size-3.5 text-white/50" />}
                </button>
              </div>
            </div>
          )}

          {/* Click anywhere to play/pause */}
          {loaded && (
            <button className="absolute inset-0 z-[5]" onClick={toggle} aria-label="Play / Pause" />
          )}
        </div>

        {/* Track info sidebar */}
        <div className="flex flex-col gap-5 pt-1 md:pt-4 shrink-0 w-full md:w-[220px]">
          {/* Track name */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Track</p>
            <p className="text-white font-semibold text-lg leading-tight break-words">{trackName}</p>
          </div>

          {/* Engine used */}
          {engineId && ENGINE_LABELS[engineId] && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Visualizer</p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5">
                <span className="size-1.5 rounded-full bg-purple-400" />
                <span className="text-xs text-white/70">{ENGINE_LABELS[engineId]}</span>
              </div>
            </div>
          )}

          {/* Aspect / platform */}
          {aspect && ASPECT_LABELS[aspect] && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Format</p>
              <p className="text-xs text-white/60">{aspect} · {ASPECT_LABELS[aspect]}</p>
            </div>
          )}

          {/* Download */}
          <a href={videoUrl} download
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#a855f7 0%,#ec4899 100%)' }}>
            <Download className="size-4" /> Download
          </a>

          {/* CTA */}
          <a href="/"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white transition-all">
            Make your own →
          </a>

          {/* Expiry notice */}
          <p className="text-[10px] text-white/20 leading-relaxed">
            This share link is valid for 7 days. Download the video to keep it permanently.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-[11px] text-white/20">
          Made with{' '}
          <a href="/" className="text-purple-400/60 hover:text-purple-400 transition-colors">Music Animate</a>
          {' '}· Visualize Your Sound
        </p>
      </div>
    </div>
  );
}
