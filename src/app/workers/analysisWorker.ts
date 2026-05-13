// analysisWorker.ts
// Runs analyzeTrack() off the main thread so the UI never freezes.
// Vite bundles this automatically via `new Worker(new URL(...), { type: 'module' })`.

import { analyzeTrack } from '../lib/audioAnalysis';

interface WorkerInput {
  channelData: Float32Array[];
  sampleRate: number;
  duration: number;
}

interface WorkerOutput {
  ok: boolean;
  sections?: ReturnType<typeof analyzeTrack>['sections'];
  energyCurve?: number[];          // Array not Float32Array — safe across all browsers
  energyCurveResolution?: number;
  bpm?: number;
  avgEnergy?: number;
  spectralCentroid?: number;
  mood?: string;
  error?: string;
}

// Safety timeout — if analysis takes > 15 s something has gone wrong
const TIMEOUT_MS = 15_000;
let analysisTimer: ReturnType<typeof setTimeout> | null = null;

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { channelData, sampleRate, duration } = e.data;

  // Guard: channel data must have arrived un-detached
  if (!channelData?.length || channelData[0].byteLength === 0) {
    self.postMessage({ ok: false, error: 'Channel data is empty or detached' } satisfies WorkerOutput);
    return;
  }

  // Start safety timeout
  analysisTimer = setTimeout(() => {
    self.postMessage({ ok: false, error: 'Analysis timed out after 15 s' } satisfies WorkerOutput);
    self.close();
  }, TIMEOUT_MS);

  // Reconstruct a minimal AudioBuffer-like object from transferred data
  const mockBuffer = {
    sampleRate,
    length: channelData[0].length,
    duration,
    numberOfChannels: channelData.length,
    getChannelData: (ch: number) => channelData[ch] ?? new Float32Array(0),
  } as unknown as AudioBuffer;

  try {
    const analysis = analyzeTrack(mockBuffer);
    clearTimeout(analysisTimer!);

    self.postMessage({
      ok: true,
      sections: analysis.sections,
      // Convert Float32Array → plain array: safe for structured clone in all browsers
      energyCurve: Array.from(analysis.energyCurve),
      energyCurveResolution: analysis.energyCurveResolution,
      bpm: analysis.bpm,
      avgEnergy: analysis.avgEnergy,
      spectralCentroid: analysis.spectralCentroid,
      mood: analysis.mood,
    } satisfies WorkerOutput);
  } catch (err: unknown) {
    clearTimeout(analysisTimer!);
    const msg = err instanceof Error ? err.message : 'Unknown analysis error';
    self.postMessage({ ok: false, error: msg } satisfies WorkerOutput);
  }
};
