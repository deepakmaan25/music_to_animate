// ─── engineRecommendations.ts ────────────────────────────────────────────────
// Score each engine for the detected track characteristics.
// Pure functions, no side effects, no imports beyond local types.
// ─────────────────────────────────────────────────────────────────────────────

import type { MoodLabel } from './audioAnalysis';

export type EngineId =
  | 'bars' | 'radial' | 'orbital' | 'depth'
  | 'terrain' | 'tunnel' | 'neon_spheres' | 'fractal' | 'solar';

export interface EngineRecommendation {
  engineId: EngineId;
  score: number;  // 0–1 normalised
  reason: string;
}

// ─── Mood score matrix ────────────────────────────────────────────────────────
// Row = engine, column = mood (aggressive | euphoric | calm | dark | bright)
const MOOD_SCORES: Record<EngineId, Record<MoodLabel, number>> = {
  tunnel:      { aggressive: 0.90, euphoric: 0.70, calm: 0.20, dark: 0.60, bright: 0.50 },
  depth:       { aggressive: 0.70, euphoric: 0.90, calm: 0.60, dark: 0.70, bright: 0.80 },
  fractal:     { aggressive: 0.80, euphoric: 0.80, calm: 0.40, dark: 0.90, bright: 0.60 },
  radial:      { aggressive: 0.90, euphoric: 0.70, calm: 0.30, dark: 0.50, bright: 0.70 },
  neon_spheres:{ aggressive: 0.60, euphoric: 0.90, calm: 0.50, dark: 0.60, bright: 0.90 },
  bars:        { aggressive: 0.70, euphoric: 0.60, calm: 0.50, dark: 0.50, bright: 0.70 },
  orbital:     { aggressive: 0.50, euphoric: 0.70, calm: 0.90, dark: 0.70, bright: 0.60 },
  terrain:     { aggressive: 0.40, euphoric: 0.50, calm: 0.90, dark: 0.80, bright: 0.50 },
  solar:       { aggressive: 0.30, euphoric: 0.60, calm: 0.80, dark: 0.70, bright: 0.60 },
};

// ─── BPM adjustment ───────────────────────────────────────────────────────────
// Engines that suit high-tempo or slow-tempo tracks get a bonus
const BPM_BONUS: Partial<Record<EngineId, { highBPM?: number; lowBPM?: number }>> = {
  tunnel:       { highBPM: 0.10 },
  radial:       { highBPM: 0.10 },
  depth:        { highBPM: 0.08 },
  fractal:      { highBPM: 0.08 },
  terrain:      { lowBPM: 0.10 },
  solar:        { lowBPM: 0.10 },
  orbital:      { lowBPM: 0.08 },
};

// ─── Human-readable reason strings ───────────────────────────────────────────
function buildReason(engineId: EngineId, mood: MoodLabel, bpm: number): string {
  const bpmDesc = bpm > 128 ? 'high BPM' : bpm < 90 ? 'slow tempo' : 'mid-tempo';
  const moodDesc: Record<MoodLabel, string> = {
    aggressive: 'aggressive energy',
    euphoric:   'euphoric energy',
    calm:       'calm, ambient feel',
    dark:       'dark, brooding tone',
    bright:     'bright, upbeat character',
  };
  const engineNotes: Record<EngineId, string> = {
    tunnel:       'the tunnel depth amplifies drive and momentum',
    depth:        'the starfield responds beautifully to rhythm',
    fractal:      'kaleidoscope patterns match complex energy well',
    radial:       'radial bursts complement percussive transients',
    neon_spheres: 'bouncing spheres mirror melodic energy',
    bars:         'spectrum bars make every frequency visible',
    orbital:      'orbital motion suits sustained, evolving sounds',
    terrain:      'terrain rises with low, powerful frequencies',
    solar:        'planetary motion works well with slow builds',
  };
  return `${moodDesc[mood]} + ${bpmDesc} — ${engineNotes[engineId]}`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the top N engine recommendations sorted by score descending.
 * Scores are normalised so the highest is 1.0.
 */
export function recommendEngines(
  mood: MoodLabel,
  bpm: number,
  topN = 3
): EngineRecommendation[] {
  const engines = Object.keys(MOOD_SCORES) as EngineId[];

  const raw = engines.map((id) => {
    let score = MOOD_SCORES[id][mood];

    // BPM bonus
    const bonus = BPM_BONUS[id];
    if (bonus) {
      if (bonus.highBPM && bpm > 128) score += bonus.highBPM;
      if (bonus.lowBPM  && bpm < 90)  score += bonus.lowBPM;
    }

    return { engineId: id, score, reason: buildReason(id, mood, bpm) };
  });

  // Sort descending
  raw.sort((a, b) => b.score - a.score);

  // Normalise so max = 1.0
  const maxScore = raw[0]?.score ?? 1;
  const normalised = raw.map((r) => ({
    ...r,
    score: maxScore > 0 ? r.score / maxScore : r.score,
  }));

  return normalised.slice(0, topN);
}
