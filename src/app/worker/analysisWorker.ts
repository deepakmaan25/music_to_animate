// analysisWorker.ts
// Runs analyzeTrack off the main thread.
// Vite handles this as a Worker via `?worker` import.

import { analyzeTrack } from '../lib/audioAnalysis';

self.onmessage = (e: MessageEvent<{ channelData: Float32Array[]; sampleRate: number; duration: number }>) => {
  const { channelData, sampleRate, duration } = e.data;

  // Reconstruct a minimal AudioBuffer-like object from the transferred data
  const mockBuffer = {
    sampleRate,
    length: channelData[0]?.length ?? 0,
    duration,
    numberOfChannels: channelData.length,
    getChannelData: (ch: number) => channelData[ch] ?? new Float32Array(0),
  } as unknown as AudioBuffer;

  try {
    const analysis = analyzeTrack(mockBuffer);
    // Float32Array can't be serialised as-is with structuredClone across some browsers
    // Convert to regular array for the energyCurve transfer
    self.postMessage({
      ok: true,
      sections: analysis.sections,
      energyCurve: Array.from(analysis.energyCurve),
      energyCurveResolution: analysis.energyCurveResolution,
      bpm: analysis.bpm,
      avgEnergy: analysis.avgEnergy,
      spectralCentroid: analysis.spectralCentroid,
      mood: analysis.mood,
    });
  } catch (err: any) {
    self.postMessage({ ok: false, error: err?.message ?? 'Analysis failed' });
  }
};
