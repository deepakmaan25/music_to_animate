You are a senior product designer and UX architect.

We already have a first version of a web app for AI-powered music visualizations with:
- Landing hero (“Your Sound, Visualized”)
- “Three Steps to Magic” section
- “Visual Engines” grid
- A large Real-Time Preview canvas with tabs for Style / Motion / Color / Export

Your task is to IMPLEMENT a refined version of this design and workflow, focusing on:
- Clearer user flow
- Better feedback during preview/render
- A robust model for output quality and long-term project maintenance

Design everything at a level where a designer + engineer team could build it directly.

================================
1. Overall product + flow goals
================================

Update the product so that:
- The core mental model is: each uploaded audio file becomes a PROJECT with saved settings and export history.
- Users clearly move through: Landing → Upload → Visual Engine selection → Live Preview & Tuning → Export → Manage Versions.
- “Real-Time” means responsive, low-friction previews, while final exports are explicitly higher quality and may take longer.

Make sure the new flow:
- Reduces confusion about what is preview vs final output.
- Provides non-blocking feedback when rendering.
- Scales to many visual engines and repeated exports per track.

=============================
2. Landing hero refinements
=============================

We already have:
- Headline: “Your Sound, Visualized”
- Subcopy explaining beat-synced motion videos
- Primary CTA: “Upload Your Track”
- A white rectangular element next to the CTA
- Social proof stats (12K+ indie musicians, etc.)

Implement the following changes:

A. Clarify actions around the primary CTA
- Keep “Upload Your Track” as the primary CTA.
- Either:
  - Clearly label the white box as “Paste track URL (YouTube / SoundCloud)” with a placeholder and small helper text, OR
  - Remove this element entirely if URL upload is not yet supported.
- Ensure drag-and-drop hinting is visible (e.g., “or drop an audio file here”).

B. Improve text hierarchy and contrast
- Tighten subcopy to emphasize speed and quality, e.g.:
  “Upload any track. Get a beat-perfect, studio-grade visual in seconds.”
- Increase contrast of body text and ensure readability on dark backgrounds.
- Make focus and hover states for the main CTA very obvious.

C. Adjust social proof
- If numbers are aspirational, rephrase to qualitative proof:
  - “Loved by indie musicians”
  - “Built for content creators”
  - “Perfect for beat makers”
- Otherwise, give them a subtle label like “Creators using our tools” for clarity.

==================================
3. “Three Steps to Magic” section
==================================

We already show 01 / 02 / 03 cards for:
1) Upload Your Audio
2) Choose Your Vibe
3) Export & Share

Refine this section to:
- Emphasize the AI analysis.
- Communicate speed clearly.
- Strengthen the benefit statements.

For each step:

Step 1 – Upload Your Audio
- Title: “Upload Your Audio”
- Supporting line: “Drop any MP3, WAV, or FLAC. We auto-detect tempo, energy, and emotional peaks to drive the visuals.”
- Optional microcopy: “≈ 10 seconds”

Step 2 – Choose Your Vibe
- Title: “Choose Your Vibe”
- Supporting line: “Get AI-recommended visual engines that match your track’s mood, then customize colors, motion, and intensity.”
- Optional microcopy: “≈ 20 seconds”

Step 3 – Export & Share
- Title: “Export & Share”
- Supporting line: “Render in 9:16, 1:1, or 16:9 with quality presets up to 4K, optimized for TikTok, Reels, and YouTube.”
- Optional microcopy: “≈ 30–60 seconds”

Design details:
- Make the benefit line slightly larger / higher contrast than body text.
- Use consistent card layout, but step numbers and icons should not overpower the text.

===========================
4. “Visual Engines” section
===========================

We already have:
- Large gradient cards per engine with:
  - Engine name
  - Description line
  - Mood tags (e.g., “Dreamy”)
  - Genre tags (e.g., “Ambient, Chill”)
  - A “Try Engine” button

Make this section scalable and more understandable:

A. Clarify primary actions
- Replace “Try Engine” with a clearer primary CTA per card:
  - “Use with My Track” → loads this engine into the current project.
- Optional secondary action:
  - “Play Demo” → plays a short, built-in demo visualization with a demo track.

B. Add filters and tag distinction
- Above the grid, add filter chips such as:
  - “All · High-Energy · Chill · Vocal-Heavy · Instrumental · Trippy”
- Allow combining a mood filter + genre filter (e.g., “Aggressive + Hip-Hop”).
- Visually differentiate:
  - Mood tags (e.g., filled pills, icon like a spark or heart)
  - Genre tags (e.g., outlined pills, music-note icon)
- Ensure scanning the tags gives immediate information about mood vs genre.

C. On-hover previews
- On desktop, hovering over a card should:
  - Show a subtle micro-preview of motion (no audio) using a generic loop that reflects that engine’s personality.
- Keep it performance-conscious: short, looping animation.

====================================
5. Real-Time Preview & editor screen
====================================

We currently have:
- A large dark preview area
- Title “Real-Time Preview – Instant feedback. Every beat. Every drop.”
- A central status pill “Rendering Preview…”
- Style / Motion / Color / Export tabs near the bottom
- Bar-style waveform/visualizer at the bottom

Upgrade this area to better support editing and feedback:

A. Preview vs rendering behaviour
- Remove blocking, full-screen “Rendering Preview…” states when possible.
- Instead:
  - Show a slim progress bar directly under the preview when recomputing, with text like “Updating preview… 63%”.
  - Allow a low-fidelity preview to continue playing or resume quickly.
- Add a small label in a corner such as:
  - “Preview: Adaptive (540–720p)” to clarify that this is not final export quality.

B. Transport controls and timeline
- Add a minimal transport bar under the preview:
  - Play / Pause button
  - Current timecode and total duration
  - Draggable playhead with waveform/energy visualization
- Integrate audio-analysis markers:
  - Show labelled markers for sections like Intro, Verse, Chorus, Drop, Break.
  - Clicking a marker jumps the playhead to that section.

C. Editing panel and tabs
- Reposition the main tabs (Style / Motion / Color / Export) so they are clearly visible and feel like primary navigation for the editor.
  Options:
  - Horizontally below the preview in a prominent tab bar, OR
  - As vertical tabs in a right-hand property panel.
- Within each tab:
  - Group controls into logical sections, e.g., in “Motion”:
    - “Beat Reactivity”
    - “Camera Movement”
    - “Particle Density”
  - Where possible, show a tiny inline loop preview that reacts immediately to parameter changes without requiring a full track re-render.

D. State handling
- Define distinct states:
  - Idle (preview ready, not playing)
  - Playing
  - Updating preview (non-blocking update bar)
  - Error (e.g., preview failed; show retry and simple diagnostics)
- Ensure the title copy still promises responsiveness but doesn’t overclaim; you can slightly soften to:
  - “Live Preview – Tune every beat, instantly.”

===========================================
6. Project model, versions, output quality
===========================================

Implement a clear project + output model:

A. Project definition
Each uploaded audio file becomes a PROJECT with:
- Project name (default from audio file name)
- Audio metadata: duration, BPM, detected sections, high-level mood.
- Chosen visual engine.
- Style settings: color palette, background type, typography.
- Motion settings: beat sensitivity, camera movement, particle density, etc.
- A list of exports (versions).

B. Preview vs export tiers
Define two quality tiers:

1) Preview tier:
- Adaptive resolution (e.g., 360–720p).
- 24–30 fps.
- Simplified shaders and reduced particle counts to keep things responsive.
- Used for scrubbing and live parameter changes.

2) Export tier:
- User-selectable resolution: 720p, 1080p, 4K.
- User-selectable frame rate: 24 / 30 / 60 fps.
- Full-quality effects (motion blur, higher particle counts, better anti-aliasing).
- Used only during final rendering.

Communicate this clearly in the UI.

C. Export tab redesign
In the Export tab, provide:

- Aspect ratios:
  - 9:16 (Vertical), 1:1 (Square), 16:9 (Horizontal)
- Duration:
  - “Full Track” or “Clip: 15s, 30s, 60s” (with a way to choose the segment for clips).
- Quality presets:
  - “Social Fast” – 720p, 30 fps.
  - “Creator Standard” – 1080p, 30 fps.
  - “Pro Master” – 4K, 60 fps (if supported).
- For each preset, show:
  - Estimated file size (rough).
  - Estimated render time (based on track length and engine complexity).

Export state:
- Show a queue card with:
  - Filename, resolution, aspect ratio.
  - Progress bar + remaining time.
- After completion, offer:
  - Download button.
  - Copy share link.
  - “Open project” shortcut.

D. Caching and maintenance concept (conceptual, not low-level)
- Document that preview rendering should cache already computed segments so scrubbing through the timeline remains smooth where cached.
- Outline that exports can reuse cached frames where compatible, to reduce render time and server cost.
- Plan for versioning of visual engines:
  - Each project stores the engine version used.
  - When an engine is upgraded, offer an “Upgrade to v2” action with a short description of visual differences, instead of silently changing existing projects.

===========================
7. Acceptance criteria
===========================

When you are done, deliver:

1) Updated screen-by-screen UX descriptions for:
   - Landing hero
   - Three Steps to Magic
   - Visual Engines
   - Project / Editor with Live Preview
   - Export & Versions view

2) Interaction details:
   - For filters and tag behaviours in Visual Engines.
   - For preview vs export states and indicators.
   - For timeline transport, markers, and scrubbing.
   - For export presets and progress handling.

3) A concise conceptual model:
   - How a project is structured.
   - How preview vs export quality works.
   - How caching and engine versioning are handled at a UX level.

Make the spec clear, detailed, and directly implementable in a modern web app (React or similar). Use headings, bullets, and explicit state descriptions so there is no ambiguity.