You are a senior full‑stack web engineer + product designer.

Context:
- Current project: “Music Animation Generator” at https://suite-quake-51108117.figma.site/
- The site is mostly static marketing UI: hero (“Your Sound, Visualized”), stats, 3‑step explainer, Visual Engines section, Real‑Time Preview section.
- Right now, buttons and CTAs do not do anything and there is no real upload or visualization capability.

Goal:
Turn this into a working web app with:
1) Light/Dark mode toggle across the whole site.
2) A complete, usable flow:
   - Upload audio (MP3/WAV/FLAC).
   - Analyze audio in the browser using Web Audio API.
   - Generate a real‑time music visualization on a canvas (at least one engine to start).
   - Export an animation as a video file (MP4/WebM) or at least downloadable visualization recording.
3) Clear UI states, error handling, and acceptance criteria so this is actually useful, not just a mock.

Assume a modern stack like:
- Frontend: React + TypeScript + Next.js
- Styling: Tailwind or CSS‑in‑JS with design tokens
- Visualization: Web Audio API + Canvas or WebGL for the visualizer[web:41][web:43][web:44][web:50][web:52]
- Backend (if needed for export): Node service using ffmpeg OR browser‑only recording via MediaRecorder.

================================
1. Theme system (Light/Dark toggle)
================================

Design and specify:

- A theme token system:
  - Define semantic tokens: `bg`, `bg-elevated`, `text-primary`, `text-secondary`, `accent`, `border-subtle`, etc.
  - Provide values for both `light` and `dark` themes.
  - Implement via CSS variables on `<html>` or `<body>` so existing components can be themed.

- Theme toggle UI:
  - A small icon/button in the top-right of the navbar, with:
    - Icon changes (sun/moon).
    - Accessible label: “Toggle dark mode”.
    - Keyboard focus and ARIA attributes.

- Behaviour:
  - Default theme: follow system preference via `prefers-color-scheme`.
  - Persist user choice in `localStorage`.
  - Smooth transition (e.g., CSS `transition` on background/text colors).
  - Make sure critical sections (hero gradient, Visual Engine cards, preview background) look good in both themes.

Deliver:
- Theme token definitions.
- Updated component styles for hero, cards, buttons, and preview area.
- Implementation notes (React hook or context) for `useTheme()`.

=====================================
2. App architecture & routing model
=====================================

Define the app structure:

Pages / routes:
1) `/` – Marketing + entry (current landing but wired up).
2) `/studio` – Main “Live Preview & Editor” screen where a user works on one project.
3) (Optional) `/projects` – List of saved projects/exports (if simple, this can be a section on `/studio`).

State model:
- PROJECT:
  - `id`
  - `audioFile` (File + metadata: name, duration, BPM, sections)
  - `engineId` (current Visual Engine)
  - `style` (colors, background type, typography preset)
  - `motion` (beat sensitivity, camera movement, particle density, etc.)
  - `exports[]` (each export: id, createdAt, resolution, aspect ratio, status, downloadUrl)

Explain how you will:
- Create a new project when the user uploads a track.
- Store project state (client-only for now, e.g., in localStorage or in-memory).
- Route the user from `/` → `/studio` with the created project.

=========================================
3. Wiring existing UI into the new flow
=========================================

Hero section:
- “Upload Your Track”:
  - Clicking opens a file picker (`accept="audio/*"`).
  - After selection:
    - Validate file type and size.
    - Navigate to `/studio` and show an “Analyzing audio…” state.
- Any secondary input box (for URLs) should either:
  - Be wired to load audio from a pasted URL (for later), OR
  - Be removed/commented out to avoid dead UI.

“Three Steps to Magic”:
- Keep as an explainer but:
  - Step 1: link to opening the file picker.
  - Step 2: scroll to Visual Engines section or go to `/studio` if project exists.
  - Step 3: scroll to an “Export & Share” area or `/studio#export`.

“Visual Engines”:
- Each engine card:
  - Button label: “Use with My Track”.
  - If user has NO project yet:
    - Open file picker then go to `/studio` with that engine selected.
  - If project exists:
    - Immediately switch engine for current project and go to `/studio` (or focus preview).

Document these navigation rules clearly.

====================================
4. Upload + audio analysis behaviour
====================================

Use Web Audio API for analysis.[web:41][web:43][web:44][web:50][web:52]

Design the flow:

1) User selects file:
   - Show an “Uploading / Decoding” overlay with progress text.
   - Create an `AudioContext`.
   - Decode audio buffer using Web Audio API.
   - Create an `AnalyserNode`.
   - Extract:
     - Frequency data over time.
     - Approximate BPM (can be simple or stubbed for now).
     - Basic sections (approximate high vs low energy windows).

2) Error handling:
   - If decoding fails:
     - Show friendly error: “We couldn’t read this file. Please try a different MP3/WAV.”
     - Offer retry + link back to `/`.

3) Performance:
   - Do decoding on user interaction to respect browser auto-play policies.
   - Keep the raw `AudioBuffer` and analyser connected so it can drive visualization.

Deliverables:
- High-level pseudocode for:
  - Handling file input.
  - Creating `AudioContext`, `AnalyserNode`.
  - Starting playback + analysis loop with `requestAnimationFrame`.

=====================================
5. Live visualization + editor UI
=====================================

In `/studio`, design:

Layout:
- Left or top: large preview canvas (“Live Preview”).
- Under it: transport bar (Play/Pause, timecode, waveform/scrubber, section markers).
- Right or bottom: tabs / panels for:
  - Style
  - Motion
  - Color
  - Export

Preview behaviour:
- Use `Canvas` or WebGL to draw at least one visual engine driven by analyser data.
- Implement a simple bar/spectrum engine as the first version (bars height from frequency data).[web:41][web:43][web:50][web:52]
- Add a label like “Preview: Adaptive quality” to differentiate from final export.

States:
- Idle (no audio loaded): show an empty state with CTA “Upload Your Track”.
- Loading/Analyzing: spinner + text.
- Playing: canvas animates; controls active.
- Paused: freeze last frame.
- Updating preview (on parameter change): subtle progress bar, but never block everything.

Controls:
- In “Style” tab: engine selector, color presets, background type.
- In “Motion” tab: sliders for beat sensitivity, camera movement, complexity.
- In “Color” tab: fine-grained color pickers.
- All changes should update the preview almost immediately.

Include detailed interaction notes for each control.

==================================
6. Export & video generation flow
==================================

We need a usable export path.

Propose TWO options and pick one as default:

Option A – Browser-only recording:
- Use `canvas.captureStream()` + `MediaRecorder` to record the visualization while audio plays.
- After recording:
  - Generate a WebM or MP4 (depending on browser).
  - Show an “Export complete” card with:
    - Thumbnail, duration, resolution.
    - Download button.

Option B – Backend (Node + ffmpeg):
- Frontend sends:
  - Audio file, chosen engine + parameters, desired resolution/duration.
- Backend renders video using ffmpeg + headless renderer (conceptual only).
- Returns URL when done.

For now, DESIGN and SPECIFY in detail Option A (browser-only), since it’s simpler to ship first:
- How the user picks:
  - Aspect ratio: 9:16, 1:1, 16:9.
  - Duration: full track vs 15s/30s/60s clip (with ability to choose clip start from the timeline).
  - Quality preset: “Social Fast (720p)”, “Standard (1080p)”, “Pro (4K)” (if feasible).

Export states:
- “Preparing export…”
- “Recording preview…” (if canvas recording is real time).
- “Finalizing file…”
- “Done – Download / Copy link”.

Also define how each export is stored in the project’s `exports[]` list and displayed (mini cards in a sidebar or table).

========================================
7. Light/dark mode + visualization UX
========================================

Ensure visualization still looks good in both themes:
- Use theme tokens in the canvas background and overlay UI (text, controls).
- Make sure bar/particle colors work on both light and dark backgrounds (e.g., auto adjust brightness/contrast).
- Update icons and focus states for both themes.

================================
8. Edge cases and acceptance tests
================================

Edge cases to handle:
- Unsupported file type or huge file.
- Very short audio (< 5s).
- Very long audio (> 10min) – optionally suggest “Highlight mode” that renders only a selected segment.
- No audio playback allowed until user interacts (Web Audio API policy).

Define acceptance criteria like:

1) User can:
   - Visit `/`, toggle light/dark mode, and the preference is persisted.
   - Click “Upload Your Track”, choose an MP3, and be taken to `/studio`.
   - See the track analyzed and a live visualizer reacting to audio.

2) User can:
   - Switch between at least two visual engines via the Style/Visual Engine controls.
   - Adjust motion and color sliders and see changes in the preview.

3) User can:
   - Hit “Export”, choose 9:16, 30s clip, “Social Fast”.
   - Wait for progress to complete.
   - Download a playable video/webm file that shows the visualizer synced to the audio.

4) No button on the site is “dead”:
   - All primary CTAs either navigate, open dialogs, or provide clear “coming soon” messages.

Deliver:
- A full UX + technical spec.
- Component hierarchy and state model.
- Pseudocode or high‑level code snippets for:
  - File upload + audio analysis.
  - Visualization loop.
  - Export recording.
- Clear checklist mapping each acceptance criterion to UI/behaviour.

Make everything explicit so a dev team could build this app with minimal ambiguity.