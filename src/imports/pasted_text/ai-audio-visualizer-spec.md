You are a senior product designer + creative technologist.
You are designing an AI-powered motion animation generator for music and audio.

### 1. Core concept

Design a web app that:
- Lets a user upload any audio/music/beat file (MP3, WAV, FLAC, etc.).
- Analyzes the audio deeply (tempo, rhythm, sections, frequency bands, energy curve, mood/emotion).
- Generates a mesmerizing, beat-synced motion video that visually "performs" the track.
- Feels as engaging and high-quality as the music itself, driving watch time, replays, and shares.

Think of it as a "DAW for visuals":
- The audio is the master timeline.
- Visuals react in real time to beats, drops, and emotional shifts.
- Output is a ready-to-share video for TikTok / Reels / YouTube / Spotify Canvas.

### 2. User personas and primary jobs

Assume at least these personas:
1) Indie musician / producer
   - Wants a fast, beautiful visualizer to release with new tracks.
   - Needs it to look “pro” without hiring a motion designer.

2) Content creator (TikTok / Reels / YouTube)
   - Wants scroll-stopping, trendy, dynamic visuals that sync perfectly with audio hooks.
   - Needs frictionless editing and export in social aspect ratios.

3) Casual user
   - Uploads favourite tracks or beats, wants something fun, trippy, and easy.

For each persona, design the product so they can:
- Upload audio and get a great default visual in one click.
- Optionally customize style, intensity, colors, and composition.
- Preview quickly and export in the right formats.

### 3. End-to-end flow (high level)

Describe and then design the following key flows:

1) "Instant Visualizer" flow
   - User lands, uploads an audio file, chooses a basic style preset.
   - System generates a default, beat-synced animation with minimal input.
   - User gets a 10–30 second preview quickly, then can render full length and export.

2) "Pro Control" flow
   - After an initial auto-generated result, user can tweak:
     - Visual style family (e.g., waveform/spectrum, particles, 3D shapes, abstract fractals, minimal geometric, typography/lyric-heavy).
     - Color palette, brand colors.
     - Motion intensity (calm → wild).
     - Level of beat-reactivity vs smoothness.
     - Focal elements (logo, cover art, photo, character, etc.).

3) Export flow
   - User chooses aspect ratio and duration:
     - 9:16, 1:1, 16:9.
     - Full-track or clip (e.g., 15s, 30s, 60s).
   - Shows approximate render time and quality options (e.g., 1080p, 4K).
   - Download and "Copy share link" behaviours.

### 4. Audio analysis model (behavioural spec, non-technical)

Define the behaviour of the audio analysis pipeline (describe what it should do, not low-level DSP math):

- Input:
  - Audio file (MP3, WAV, FLAC; mono or stereo).
- Analysis goals:
  - Detect tempo (BPM) and overall groove.
  - Mark beats and strong transients (kicks, snares, claps).
  - Detect macro-sections: intro, verse, chorus, drop, breakdown, outro.
  - Compute an "energy curve" over time (low, medium, high).
  - Optional: infer broad mood/emotion (e.g., dark, uplifting, melancholic, aggressive).
  - Extract frequency bands (bass, mids, highs) that can independently drive visual parameters.

Describe:
- How markers and curves from this analysis should drive visuals:
  - Hard beats → camera cuts, bursts, flashes, scale pops, particle explosions, shape deformations.
  - Sustained sections → slow camera moves, evolving gradients, flowing patterns.
  - Drops / climaxes → major visual transformations (new style mode, zoom-outs, color inversions, etc.).
- How to avoid cheap-looking effects:
  - Smooth interpolation between beats and sections.
  - Ease-in / ease-out on motion parameters.
  - Avoid constant strobing; reserve big hits for important moments.

### 5. Visual “engines” and styles

Define a system of modular visual engines that the app can offer as presets.
Each engine should specify:
- Visual motif (e.g., radial spectrum, 3D particle field, liquid blobs, kaleidoscopic fractals, minimal lines, typography).
- Primary audio drivers (e.g., bass → scale/position, mids → color shifts, highs → particle emission).
- Overall mood (e.g., dreamy, aggressive, futuristic, organic, glitchy).
- Best use cases (e.g., EDM drop, ambient track, hip-hop beat, lo-fi/chill, podcast).

Design at least 5–7 clearly distinct visual engines.
For each, describe:
- How they look and move in plain language.
- How they react to tempo, energy, and different frequency bands.
- How they evolve across song structure (e.g., verse vs chorus vs drop).

Include:
- A ”Logo / Cover Art” engine that integrates user-supplied imagery.
- At least one ”Lyrics / Typography” engine that can animate heavily around text beats (for future expansion when lyric data is available).
- At least one “Trippy / Psychedelic” engine optimized to be visually mesmerizing.

### 6. Sync and motion design principles

Specify motion design principles so the generator feels intentional and premium:

- Temporal hierarchy:
  - Micro: per-beat motions (small scale pops, glow, subtle shake).
  - Meso: phrase-level changes every 2–4 bars (new patterns, camera moves).
  - Macro: section-level transformations (color theme shift, motif changes, layout reconfiguration).

- Visual rhythm:
  - Avoid over-synchronizing every single beat — use patterns, accents, and variations.
  - Use silence or low-energy sections to pull back visuals and create contrast.
  - Align big visual moments (cuts, big flashes, motif switches) with musically meaningful events (drops, fills, transitions).

- Cohesion:
  - Keep a consistent visual language within one export: same rendering style, line weight, shading style, etc.
  - Provide parameters or rules that prevent clashing styles from being combined.

### 7. UX and interface design

Design the main screens and UX:

1) Landing / “New Project” screen
   - Clear call to action: “Upload audio to generate visuals”.
   - Option to paste a link (future: YouTube/SoundCloud).
   - Showcase a few live demos to set expectations.

2) Analysis & preset selection
   - Progress indicator during audio analysis.
   - Auto-generated suggestions:
     - Suggested visual styles labeled with tags like “Best for high-energy EDM”, “Good for chill / ambient”.
   - Quick style previews (short looping clips or thumbnails).

3) Editor / Preview
   - Timeline view aligned with the audio waveform.
   - Real-time preview window.
   - Control panel with:
     - Style engine selector.
     - Color palette presets plus custom color pickers.
     - Sliders/toggles for:
       - Motion intensity.
       - Beat reactivity vs smoothness.
       - Camera movement amount.
       - Particle density / visual complexity.
     - Optional advanced tab:
       - Map bass/mids/highs to specific visual parameters.
       - Save presets as “My Styles”.

4) Export screen
   - Aspect ratio selection (9:16, 1:1, 16:9).
   - Duration selection (clip or full-track).
   - Quality (720p, 1080p, 4K).
   - Estimated render time and filesize.
   - Export progress state and completion screen with:
     - Download button.
     - Copy link.
     - Suggested social sharing CTAs.

Produce:
- Wireframe-level description of each screen (layout, sections, key controls).
- Interaction details for hover states, drag behaviours (e.g., scrubbing timeline to preview at specific beats).

### 8. Parameters and configuration model

Define a clear internal configuration model for a generated visual:

- Project-level properties:
  - Audio file metadata (duration, BPM, detected sections).
  - Chosen visual engine.
  - Aspect ratio and output resolution.

- Style-level properties:
  - Color palette (primary, secondary, accent).
  - Background type (solid, gradient, image, generative texture).
  - Typography style (for any text / future lyrics).

- Motion & sync properties:
  - Beat sensitivity.
  - Bass → [list of parameters it modulates].
  - Mids → [list].
  - Highs → [list].
  - Camera movement amplitude and frequency.
  - Global motion blur / trails settings.

Document:
- How these properties can be randomized with constraints to give “fresh visual every render” while staying on-brand for a given engine.
- How presets can be saved and reused.

### 9. Guardrails, constraints, and edge cases

Specify handling for:

- Very short clips (< 10 seconds).
- Very long tracks (e.g., > 10 minutes) — proposals for “highlight only” exports.
- Tracks with very low dynamic range (almost no variation).
- Very quiet or noisy recordings.
- User uploads that fail analysis (fallback: simpler spectrum/waveform-based visualization).

Include design guardrails to:
- Avoid epilepsy risks (limit strobe-like patterns, max brightness changes per second).
- Keep UI simple enough for casual users while still powerful for pros (progressive disclosure of advanced controls).

### 10. Deliverables from you (Claude)

As your output, provide:

1) A structured product spec:
   - Problem statement and goals.
   - Personas and primary use cases.
   - User journeys for the main flows.

2) UX design description:
   - Screen-by-screen descriptions with clear sections and major components.
   - Interaction details for key controls (sliders, toggles, timeline, presets).
   - Empty states, loading states, and error states.

3) Visual system:
   - Detailed descriptions of each visual engine and how it behaves with different audio.
   - Examples of motion behaviours tied to specific musical events.

4) Implementation blueprint (conceptual, not full code):
   - High-level architecture: audio analysis layer, visual generation layer, preview/rendering pipeline.
   - Data structures for storing analysis results and visual configuration.
   - Pseudocode or step-by-step algorithm for turning an analyzed audio track + selected engine into a complete video timeline.

Use clear headings and bullet points.
Prioritize clarity and implementability so a design + engineering team can build this product directly from your spec.