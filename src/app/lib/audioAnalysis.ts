// ─── audioAnalysis.ts ────────────────────────────────────────────────────────
// Offline (post-decode) audio analysis: section detection, energy curve,
// BPM detection, spectral centroid, mood inference.
// All functions are pure and synchronous. No external dependencies.
// ─────────────────────────────────────────────────────────────────────────────

export type SectionLabel =
  | 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'outro';

export interface TrackSection {
  startSec: number;
  endSec: number;
  label: SectionLabel;
  energyScore: number; // 0–1, mean normalised RMS for this section
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeRmsTimeline(buffer: AudioBuffer): Float32Array {
  const sr = buffer.sampleRate;
  const windowSize = sr; // 1 second per window
  const totalWindows = Math.ceil(buffer.duration);
  const rms = new Float32Array(totalWindows);
  const nCh = buffer.numberOfChannels;

  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, buffer.length);
    let sumSq = 0, count = 0;
    for (let ch = 0; ch < nCh; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = start; i < end; i++) {
        sumSq += data[i] * data[i];
        count++;
      }
    }
    rms[w] = count > 0 ? Math.sqrt(sumSq / count) : 0;
  }
  return rms;
}

function smooth3(arr: Float32Array): Float32Array {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[Math.max(0, i - 1)];
    const b = arr[i];
    const c = arr[Math.min(arr.length - 1, i + 1)];
    out[i] = (a + b + c) / 3;
  }
  return out;
}

function normalise(arr: Float32Array): Float32Array {
  let min = Infinity, max = -Infinity;
  for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min;
  if (range === 0) return arr.map(() => 0.5) as unknown as Float32Array;
  return arr.map((v) => (v - min) / range) as unknown as Float32Array;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9-A  Section detection
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeTrackSections(buffer: AudioBuffer): TrackSection[] {
  const duration = buffer.duration;
  if (duration < 20) {
    return [{ startSec: 0, endSec: duration, label: 'verse', energyScore: 0.5 }];
  }

  const rawRms = computeRmsTimeline(buffer);
  const norm   = normalise(smooth3(smooth3(rawRms)));

  const HIGH = 0.60;
  const LOW  = 0.35;
  const MIN_LEN = 2;
  const totalSec  = norm.length;
  const introEnd  = Math.floor(totalSec * 0.10);
  const outroStart = Math.floor(totalSec * 0.92);

  type RawSeg = { start: number; end: number; highEnergy: boolean };
  const segments: RawSeg[] = [];
  let segStart = 0;
  let inHigh = norm[0] >= HIGH;

  for (let i = 1; i <= totalSec; i++) {
    const v = i < totalSec ? norm[i] : -1;
    const nowHigh = v >= HIGH;
    if (nowHigh !== inHigh || i === totalSec) {
      if (i - segStart >= MIN_LEN) {
        segments.push({ start: segStart, end: i, highEnergy: inHigh });
      } else if (segments.length > 0) {
        segments[segments.length - 1].end = i;
      }
      segStart = i;
      inHigh = nowHigh;
    }
  }

  if (segments.length === 0) {
    return [{ startSec: 0, endSec: duration, label: 'verse', energyScore: 0.5 }];
  }

  let chorusCount = 0;
  return segments.map((seg) => {
    const midpoint = (seg.start + seg.end) / 2;
    const slice = norm.slice(seg.start, seg.end);
    const energyScore = slice.reduce((a, b) => a + b, 0) / slice.length;
    let label: SectionLabel;
    if      (midpoint < introEnd)   label = 'intro';
    else if (midpoint >= outroStart) label = 'outro';
    else if (seg.highEnergy) {
      label = energyScore > 0.75 ? 'drop' : chorusCount++ % 2 === 0 ? 'chorus' : 'drop';
    } else {
      label = energyScore < LOW ? 'breakdown' : 'verse';
    }
    return { startSec: seg.start, endSec: Math.min(seg.end, duration), label,
             energyScore: Math.max(0, Math.min(1, energyScore)) };
  });
}

export function getSectionAtTime(sections: TrackSection[], currentSec: number): TrackSection | null {
  if (sections.length === 0) return null;
  let lo = 0, hi = sections.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if      (sections[mid].endSec   <= currentSec) lo = mid + 1;
    else if (sections[mid].startSec >  currentSec) hi = mid - 1;
    else return sections[mid];
  }
  return sections[sections.length - 1];
}

export function getSectionProgress(section: TrackSection, currentSec: number): number {
  const len = section.endSec - section.startSec;
  if (len <= 0) return 0;
  return Math.max(0, Math.min(1, (currentSec - section.startSec) / len));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9-B  Energy curve (high-resolution, 0.1 s per sample)
// ─────────────────────────────────────────────────────────────────────────────

export function buildEnergyCurve(buffer: AudioBuffer, resolution = 0.1): Float32Array {
  const sr = buffer.sampleRate;
  const hopSize = Math.max(1, Math.round(sr * resolution));
  const totalHops = Math.ceil(buffer.length / hopSize);
  const raw = new Float32Array(totalHops);
  const nCh = buffer.numberOfChannels;

  for (let h = 0; h < totalHops; h++) {
    const start = h * hopSize;
    const end = Math.min(start + hopSize, buffer.length);
    let sumSq = 0, count = 0;
    for (let ch = 0; ch < nCh; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = start; i < end; i++) {
        const v = isNaN(data[i]) ? 0 : data[i];
        sumSq += v * v;
        count++;
      }
    }
    raw[h] = count > 0 ? Math.sqrt(sumSq / count) : 0;
  }

  // 5-point Gaussian smooth
  const smoothed = new Float32Array(totalHops);
  const kernel = [0.0625, 0.25, 0.375, 0.25, 0.0625];
  for (let i = 0; i < totalHops; i++) {
    let val = 0;
    for (let k = 0; k < kernel.length; k++) {
      const idx = Math.max(0, Math.min(totalHops - 1, i + k - 2));
      val += raw[idx] * kernel[k];
    }
    smoothed[i] = isNaN(val) ? 0 : val;
  }
  return normalise(smoothed);
}

export function sampleEnergyCurve(curve: Float32Array, currentSec: number, resolution: number): number {
  if (curve.length === 0) return 0;
  const rawIdx = currentSec / resolution;
  const lo = Math.max(0, Math.min(curve.length - 1, Math.floor(rawIdx)));
  const hi = Math.min(curve.length - 1, lo + 1);
  const t  = rawIdx - Math.floor(rawIdx);
  const v  = curve[lo] + (curve[hi] - curve[lo]) * t;
  return isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9-C  BPM detection — cheap autocorrelation on downsampled envelope
//      O(N) envelope + O(W²) autocorrelation where W ≈ 200 lag windows
//      Runs in < 50 ms on a 3-minute track.
// ─────────────────────────────────────────────────────────────────────────────

export function detectBPM(buffer: AudioBuffer): number {
  if (buffer.duration < 5) return 120;

  const data = buffer.getChannelData(0);
  const sr   = buffer.sampleRate;

  // --- 1. Downsample to ~200 Hz envelope (RMS per 5 ms window) ---
  const envRate = 200; // Hz
  const hopSize = Math.max(1, Math.round(sr / envRate));
  const envLen  = Math.floor(data.length / hopSize);
  const env     = new Float32Array(envLen);

  for (let i = 0; i < envLen; i++) {
    const start = i * hopSize;
    const end   = Math.min(start + hopSize, data.length);
    let sumSq = 0;
    for (let j = start; j < end; j++) sumSq += data[j] * data[j];
    env[i] = Math.sqrt(sumSq / (end - start));
  }

  // --- 2. First-order difference (onset strength) ---
  const diff = new Float32Array(envLen);
  for (let i = 1; i < envLen; i++) diff[i] = Math.max(0, env[i] - env[i - 1]);

  // --- 3. Autocorrelation over 40–200 BPM lag range ---
  // Use only first 30 seconds for speed
  const analysisLen = Math.min(envLen, envRate * 30);
  const minLag = Math.round((60 / 200) * envRate); // 200 BPM
  const maxLag = Math.round((60 / 40)  * envRate); //  40 BPM

  let bestLag = minLag, bestCorr = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < analysisLen - lag; i++) {
      corr += diff[i] * diff[i + lag];
    }
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  let bpm = Math.round((60 / bestLag) * envRate);

  // Octave correction: fold into 80–160 range
  if (bpm < 80  && bpm * 2 <= 160) bpm *= 2;
  if (bpm > 160 && Math.round(bpm / 2) >= 80) bpm = Math.round(bpm / 2);

  return (isNaN(bpm) || bpm < 40 || bpm > 220) ? 120 : bpm;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spectral centroid — cheap version using 1-second RMS bands
// Returns 0–1 (0 = bass-heavy, 1 = treble-heavy)
// ─────────────────────────────────────────────────────────────────────────────

export function computeSpectralCentroid(buffer: AudioBuffer): number {
  // Sample 10 windows, each 0.5 s, spread across the track
  const sr       = buffer.sampleRate;
  const winSize  = Math.round(sr * 0.5);
  const data     = buffer.getChannelData(0);
  const sampleCount = 10;
  const bands    = 8; // log-spaced frequency bands
  let totalCentroid = 0;

  for (let s = 0; s < sampleCount; s++) {
    const base = Math.floor((s / sampleCount) * (data.length - winSize));
    const bandPower = new Float32Array(bands);

    for (let b = 0; b < bands; b++) {
      // Each band covers (winSize/bands) samples — crude but fast
      const bStart = base + Math.floor((b / bands) * winSize);
      const bEnd   = base + Math.floor(((b + 1) / bands) * winSize);
      let sumSq = 0;
      for (let i = bStart; i < bEnd && i < data.length; i++) sumSq += data[i] * data[i];
      bandPower[b] = sumSq;
    }

    let weightedSum = 0, totalPower = 0;
    for (let b = 0; b < bands; b++) {
      weightedSum += (b / (bands - 1)) * bandPower[b];
      totalPower  += bandPower[b];
    }
    totalCentroid += totalPower > 0 ? weightedSum / totalPower : 0.5;
  }

  const centroid = totalCentroid / sampleCount;
  return isNaN(centroid) ? 0.5 : Math.max(0, Math.min(1, centroid));
}

export type MoodLabel = 'dark' | 'bright' | 'aggressive' | 'calm' | 'euphoric';

export function inferMood(bpm: number, avgEnergy: number, spectralCentroid: number): MoodLabel {
  if (bpm > 140 && avgEnergy > 0.65 && spectralCentroid > 0.45) return 'aggressive';
  if (bpm > 118 && avgEnergy > 0.55)                             return 'euphoric';
  if (avgEnergy < 0.32 && spectralCentroid < 0.42)               return 'calm';
  if (bpm < 105 && avgEnergy > 0.38 && spectralCentroid < 0.42)  return 'dark';
  return 'bright';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackAnalysis {
  sections: TrackSection[];
  energyCurve: Float32Array;
  energyCurveResolution: number;
  bpm: number;
  avgEnergy: number;
  spectralCentroid: number;
  mood: MoodLabel;
}

export function analyzeTrack(buffer: AudioBuffer): TrackAnalysis {
  const RESOLUTION  = 0.1;
  const sections    = analyzeTrackSections(buffer);
  const energyCurve = buildEnergyCurve(buffer, RESOLUTION);
  const avgEnergy   = energyCurve.reduce((a, b) => a + b, 0) / energyCurve.length;
  const bpm         = detectBPM(buffer);
  const spectralCentroid = computeSpectralCentroid(buffer);
  const mood        = inferMood(bpm, avgEnergy, spectralCentroid);
  return { sections, energyCurve, energyCurveResolution: RESOLUTION,
           bpm, avgEnergy, spectralCentroid, mood };
}
