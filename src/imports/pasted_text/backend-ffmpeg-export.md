You are a senior full‑stack engineer working on the “Music Animation Generator” app.

Current state (already implemented):
- Theme:
  - useTheme hook with prefers-color-scheme default and localStorage persistence.
  - Top navbar with sun/moon toggle.
  - Only the base background is themed; hero/engine gradients are still dark-only.

- Flow:
  - Landing hero CTA, “Use with My Track” buttons, and final CTA all open a real <input type="file" accept="audio/*">.
  - Successful file pick creates a new project and routes to a Studio view.

- Studio:
  - Uses AudioContext.decodeAudioData to decode uploaded audio.
  - Runs an AnalyserNode at fftSize 1024.
  - Drives a <canvas> visualizer with three engines:
    - Spectrum Bars
    - Radial Spectrum
    - Particle Storm
  - Engines react to live frequency data.
  - Style / Motion / Color / Export tabs with sliders for beat sensitivity, particle density, smoothing, etc.
  - Proper idle / decoding / error / playing states.

- Export (front-end only):
  - Uses canvas.captureStream() + MediaRecorder, mixed with the analyser’s MediaStreamDestination, to produce a downloadable WebM with audio.
  - User can choose:
    - Aspect ratio: 9:16 / 1:1 / 16:9
    - Duration: Full / 15 / 30 / 60 seconds
    - Quality preset: 720p / 1080p / 4K

Your tasks now:

1) Add a backend ffmpeg export path for real MP4 output and reliable >60s rendering.
2) Persist projects + exports in localStorage so refreshes don’t lose work.
3) Fully theme landing gradients and key surfaces in both light and dark modes (not just the base background).
4) Tighten acceptance criteria to ensure everything is wired and robust.

====================================
1. Backend ffmpeg export path (MP4)
====================================

Assume:
- Backend: Node.js with Express (or similar).
- ffmpeg is available on the server (via system install or ffmpeg-static + fluent-ffmpeg).

Implement TWO stages:

Stage 1 – Simple WebM → MP4 transcode
-------------------------------------

Goal:
- Take the existing browser-generated WebM export and convert it to MP4 for broader compatibility.[web:56][web:59][web:65]

Design:

- API endpoint: POST /api/export/transcode
  - Request body: multipart/form-data or binary:
    - webmFile (WebM video with audio, from MediaRecorder)
    - metadata: projectId, aspectRatio, duration, qualityPreset.

  - Server behaviour:
    - Save WebM to a temp directory.
    - Run ffmpeg command to transcode to MP4 using H.264 + AAC, e.g.:
      ffmpeg -i input.webm -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 128k output.mp4
      (You may tweak preset/CRF later for quality/speed.)[web:56][web:59][web:68]
    - Store the resulting MP4 file (e.g., local /uploads or S3).
    - Respond with:
      {
        exportId,
        mp4Url,
        sizeBytes,
        duration,
        createdAt
      }

- Front-end Export tab:
  - After a successful WebM capture:
    - Call /api/export/transcode in the background.
    - Show “Converting to MP4…” progress state on the export card.
    - When done, show both:
      - “Download WebM” (fast, from browser)
      - “Download MP4” (from server)
    - Mark the export as `status: "ready-mp4"` when server returns.

Stage 2 – Offline server-side rendering for >60s reliability
------------------------------------------------------------

Goal:
- For tracks > 60 seconds or when user chooses “High reliability / Long render”:
  - Avoid relying on real-time canvas.captureStream (which can lag) by letting the server render frames offline, then encode with ffmpeg.[web:55][web:61][web:64]

Design concept (spec only; not full implementation code):

- API endpoint: POST /api/export/render
  - Request body:
    - audioFileId or URL to uploaded audio.
    - engineId.
    - visualConfig (style, motion, colors, seed for randomness).
    - aspectRatio, resolution, duration, fps (e.g., 30).
  - Server behaviour:
    - Node script using a headless canvas library (e.g., node-canvas) to render N frames:
      - durationSeconds * fps frames.
    - For each frame:
      - Compute visualization state at time t using the same engine logic (ported to Node).
      - Draw to an offscreen canvas.
      - Save frames as PNGs.
    - Use ffmpeg to stitch frames + audio into MP4:
      - ffmpeg -framerate 30 -i frame-%04d.png -i audio.wav -c:v libx264 -preset slow -crf 20 -c:a aac -b:a 192k -shortest output.mp4
      (Use a pattern like in typical Node+ffmpeg pipelines.)[web:64]
    - Return export metadata (exportId, mp4Url, etc.).

- Front-end Export tab:
  - For “Full track” or durations > 60 seconds:
    - Offer a toggle: “Fast browser export (WebM)” vs “High reliability server render (MP4)”.
    - For server render:
      - Call /api/export/render and show a queued export job.
      - Poll /api/export/:id/status until `status = "ready"` and show the download button.

Document all of this clearly as an implementation spec with:
- API route definitions (methods, payloads, responses).
- Basic ffmpeg commands and where to plug in arguments.
- Error cases (ffmpeg failure, timeout).

=========================================
2. Persist projects + exports in localStorage
=========================================

We already use localStorage for theme. Extend this with a robust pattern for project persistence.[web:60][web:63][web:66]

Design:

- Storage key: "mag-projects-v1".
- Shape:
  {
    projects: {
      [projectId]: {
        id,
        createdAt,
        updatedAt,
        audioMeta: { name, duration, sampleRate, bpm, etc. },
        engineId,
        style,
        motion,
        color,
        exports: {
          [exportId]: {
            id,
            createdAt,
            type: "webm" | "mp4",
            status: "recording" | "transcoding" | "rendering" | "ready" | "error",
            aspectRatio,
            resolution,
            duration,
            qualityPreset,
            localUrl?,    // for WebM Blob URL
            remoteUrl?,   // for server MP4
            errorMessage?
          }
        }
      }
    },
    lastOpenedProjectId
  }

Implementation:

- Create a reusable hook: usePersistentProjects()
  - Internally:
    - On initial load, read from localStorage.
    - On any project change, stringify and write back (debounce to avoid excessive writes).[web:63][web:66]
  - Provide functions:
    - createProjectFromFile(file, engineId?)
    - updateProject(projectId, partial)
    - addExport(projectId, export)
    - updateExport(projectId, exportId, partial)
    - setLastOpenedProject(projectId)

- Studio view:
  - On mount:
    - If a projectId is present in the URL, load that project from localStorage.
    - If none, use lastOpenedProjectId.
  - If project is missing (e.g., stale link), show a friendly error and link back to “Upload Your Track”.

- On refresh:
  - All project settings and exports should reappear.
  - Only ephemeral browser Blob URLs may need to be recreated; handle this by:
    - Rebuilding WebM Blob URLs from stored binary (optional), or
    - Only persisting server URLs + metadata, and not WebM data if that’s too heavy.

Explain the tradeoffs and pick a pragmatic v1.

=============================================
3. Fully theme landing gradients in light mode
=============================================

Right now:
- Only the base background changes with theme.
- Hero, CTA, and Visual Engine gradients remain tuned for dark mode.

Goal:
- Define theme tokens for gradients and use them across both light and dark themes so the site feels intentional in both modes.

Design:

- Extend the theme token system:

  Semantic tokens:
  - `hero-bg-gradient`
  - `hero-cta-gradient`
  - `engine-card-gradient-primary`
  - `engine-card-gradient-secondary`
  - `accent-glow`

  For each token, define:
  - Dark theme values (current look).
  - Light theme values (lighter hues, increased brightness, but still “music/visualizer” vibe).

- Implementation:
  - Use CSS variables on `html[data-theme="light"]` and `html[data-theme="dark"]`, e.g.:

    --hero-bg-gradient: linear-gradient(...);
    --hero-cta-gradient: linear-gradient(...);

  - Update hero, CTAs, engine cards, and any decorative elements to use these variables instead of hard-coded gradients.

- Details:
  - Ensure contrast: body text over gradients must remain accessible.
  - Keep brand identity consistent: reuse hues but adjust saturation and lightness for light mode.
  - Test hero in both themes with actual screenshots: no “burned” white or muddy grey.

Document:
- Final CSS variable list and example values.
- Components that must be updated to consume these variables.

=====================================
4. Final acceptance criteria/checklist
=====================================

Define clear criteria that must be true:

Export & backend:
- [ ] Exporting via browser-only path still produces a WebM that downloads immediately.
- [ ] Clicking “Convert to MP4” on an export sends WebM to /api/export/transcode and produces a valid MP4 file that plays in common players.
- [ ] For long tracks (> 60s), user can choose server-side “High reliability” export, which:
  - [ ] Enqueues a render job on /api/export/render.
  - [ ] Shows progress and completed state in the UI.
  - [ ] Produces an MP4 synchronized with audio.

Persistence:
- [ ] Creating a project, changing engine, and running exports is reflected in localStorage.
- [ ] After refreshing the page:
  - [ ] Last project re-opens automatically (or via project list).
  - [ ] Exports show correct metadata and working download links (for server MP4s).
- [ ] Deleting a project removes it from localStorage.

Theming:
- [ ] Toggling light/dark changes:
  - [ ] Base backgrounds.
  - [ ] Hero background gradient.
  - [ ] CTA button gradients.
  - [ ] Visual Engine cards’ gradients.
- [ ] All text remains readable and accessible in both themes.

Flow:
- [ ] No primary CTA or engine card is “dead”; all either:
  - Open file picker and route to Studio, or
  - Show a clear, intentional “Coming soon” message.

Please:
- Update the existing codebase/spec to incorporate this backend path, persistence layer, and full theming.
- Provide:
  - Updated API design.
  - Data models for projects and exports.
  - Implementation notes/pseudocode for ffmpeg integration.
  - Updated React hooks for theme and project persistence.