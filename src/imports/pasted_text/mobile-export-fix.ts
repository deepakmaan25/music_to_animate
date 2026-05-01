You are working on an ALREADY-BUILT app: “Music Animation Generator”.

Do NOT redesign from scratch. Keep the current architecture, UI, and working features. Your job is to UPGRADE and FIX specific parts of the existing product described below.

================================
0. Current product (do not change)
================================

Assume all of this is already working and should remain:

- React + TypeScript (Next.js) app with:
  - Theme toggle (light/dark) and design tokens.
  - Landing page with hero, “Visual Engines” section, and CTA.
  - Studio view with:
    - Audio upload.
    - AudioContext + AnalyserNode (fftSize 1024) driving visuals.
    - Engines such as Spectrum Bars, Radial Spectrum, Depth Field Particles, Neon Tunnel, Audio Terrain, etc.
    - Style / Motion / Color / Export tabs and sliders.
    - Playback states: idle / decoding / error / playing.
- Export:
  - On desktop: canvas.captureStream() + MediaRecorder + MediaStreamDestination → WebM download.
  - Backend ffmpeg MP4 path exists in some form.
- Supabase:
  - Client and hooks partially wired.
  - Magic-link emails are sent from Supabase.

You are ONLY making targeted changes and improvements listed below.

=======================================
1. Fix mobile recording/export behaviour
=======================================

PROBLEM (existing behaviour):
- On mobile (especially iOS Safari), export recording starts but never completes or doesn’t produce a downloadable file.
- Desktop export is fine and should not be broken.

CHANGE REQUIRED:
- Make export reliable on mobile, with platform-aware branching:
  - Desktop/Android:
    - Keep the current WebM export path using MediaRecorder + canvas.captureStream (unchanged in behaviour, just refactored if needed).
  - iOS Safari:
    - Detect iOS + Safari.
    - Try MediaRecorder with an MP4-compatible mimeType when supported.
    - If MediaRecorder or the chosen mimeType is not supported or fails:
      - Automatically fall back to the existing server-side MP4 export path.
  - Ensure:
    - Export either completes with a valid file OR clearly falls back to server render with visible progress.
    - No “stuck” recording that never finishes.

IMPLEMENTATION NOTES:
- Add helpers: isIOS, isSafari, isMobile.
- Add logic in Export tab to:
  - Show which mode is being used (Fast in-browser vs Reliable server render).
  - Handle errors from MediaRecorder gracefully and switch to server export.

Do NOT remove the existing desktop export path; just expand it to be platform-aware.

==========================================
2. Adjust and align existing visual engines
==========================================

We already have multiple engines wired and working. Do not remove the working pipeline. Make the following specific changes:

2.1 Align homepage engines with Studio engines
---------------------------------------------

- Homepage “Visual Engines” cards (Radial Spectrum, Geometric Pulse, Liquid Motion, Kaleidoscope, Depth Field Particles, Neon Tunnel, Audio Terrain, etc.) must map to actual Studio engines.
- For each card:
  - Confirm its `studio` id points to a real engine in Studio.
  - Ensure the visual behaviour matches the description on the homepage (e.g., “Geometric Pulse” uses bold shapes reacting to bass).

2.2 Remove Particle Storm from the selectable list
--------------------------------------------------

- Current state: you have a simple “Particle Storm” engine and a newer Depth Field Particles engine.
- Change:
  - Remove Particle Storm from the visible ENGINE selector in Studio.
  - Keep Depth Field Particles as the main particle-style engine.
  - Optionally keep Particle Storm code internally only if reused; otherwise, you can delete it.

2.3 Tune Depth Field Particles (not a new engine)
-------------------------------------------------

- Current issue: motion is too fast; feels like constant noise, not musical.
- Keep the same underlying engine but change its behaviour:
  - Base motion:
    - Slower, smoother particle travel so you get an immersive “space” feeling.
  - Beat response:
    - Use energy in bass/mid/high bands to:
      - Add temporary speed bursts on bass hits.
      - Increase spawn rate and size on strong beats.
      - Add sparkle/intensity on highs.
  - The result: visually calmer baseline + clear surges on beats (so slowing it down does NOT make it feel disconnected from the music).

Expose these controls in the existing Motion/Style tabs:
- Base travel speed.
- Beat responsiveness (how strong the surges are).
- Particle density / depth exaggeration.

2.4 Upgrade Neon Tunnel and Audio Terrain (keep them, just improve)
-------------------------------------------------------------------

Do NOT remove these engines. Upgrade their visuals and motion:

- Neon Tunnel:
  - Enhance the 3D illusion:
    - Cleaner tunnel geometry (circle/hex/square).
    - Smoother camera forward motion and subtle roll/tilt.
  - Make the audio mapping more obvious:
    - Bass → tunnel speed + scale pulses (zoom in/out).
    - Mids → panel brightness/pattern changes.
    - Highs → rim lights, sparks (soft-limited to avoid epileptic flashes).
  - Add nicer gradients/glows so it looks “production-grade” rather than basic.

- Audio Terrain:
  - Improve terrain mesh and shading:
    - More depth (fog, sky gradient).
    - Heightfield that clearly reacts to bass (big hills), mids (ripples), highs (surface shimmer).
  - Make camera path more cinematic (gentle curves, easing), but still synced with sections.

Keep engine IDs and integration the same; only upgrade visuals and motion.

2.5 Add 2–3 NEW engines (extend what exists)
--------------------------------------------

Add more visual variety by introducing NEW engines (without removing the existing ones):

- Examples (you can refine names/behaviour):
  1) Neon Spheres:
     - Several neon spheres, wobbling and scaling with bass/mids.
  2) Fractal Kaleidoscope:
     - Mirrored tiling pattern; rotation and zoom tied to energy.
  3) Solar System:
     - Central sun with orbiting bodies; orbits and flares respond to audio.

Integrate them into:
- The engine registry (Studio + homepage).
- The Style tab with appropriate controls.
Reuse the existing AnalyserNode data and parameter model.

=========================================
3. Finish Supabase auth + persistence
=========================================

Do NOT rearchitect auth. Complete and fix what’s already there.

Current issues:
- Magic link emails are sent, but:
  - Clicking them does not reliably log users in or confirm them.
- Projects and exports might not be properly stored and reloaded for authenticated users.

Changes required:

3.1 Fix magic-link sign-in
--------------------------

- Check Supabase Auth settings (dashboard):
  - Site URL and Redirect URLs must match your deployed app (and localhost for dev).
- In the client:
  - Ensure you call:
    - `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'https://YOUR_APP_URL/auth/callback' } })`
  - On `/auth/callback` route:
    - Initialise the Supabase client once.
    - Call `supabase.auth.getSession()` and subscribe to `onAuthStateChange`.
    - Rely on Supabase to parse the hash and create the session; do not manually call verifyOtp unless truly needed.
- If you use verifyOtp:
  - Make sure you use `type: 'magiclink'` when verifying magic links (not 'email').

3.2 Ensure session persistence
------------------------------

- Supabase client must be configured with:
  - `persistSession: true`
  - `storage: window.localStorage`
- Your `useAuth` hook should:
  - On mount:
    - read `getSession()` and set user/session state.
    - subscribe to `onAuthStateChange` to react to magic-link login.
  - Expose `user`, `session`, `signInWithEmail`, `signOut`.

3.3 Project + export storage per user
-------------------------------------

- When `user` is present:
  - On login:
    - Fetch projects for that user from Supabase and merge them into the local store.
    - Optionally import existing local projects (without `remoteId`) into Supabase.
  - On change (save project / new export):
    - Upsert project row in `projects` table (with config JSON).
    - Insert export rows in `exports` table.

- When `user` is absent:
  - Keep using localStorage projects as now.

Do NOT break existing local behaviour; only complete the Supabase layer.

=================================================
4. Make parameter changes fully live and smooth
=================================================

Current behaviour:
- Motion changes respond in real-time.
- Some style/color changes apply only after selecting or after pause/play.
- Pause/play sometimes feels slightly “steppy”.

Required change:
- While audio is playing, changes to:
  - Motion sliders,
  - Style (engine switch),
  - Color/palette
  must all immediately affect the next frame drawn by the visualizer.

Implementation details:
- Ensure the animation loop reads current React state on each frame (engine, palette, motion params).
- On any relevant state change when paused:
  - Call `drawFrame()` once so the static view updates without needing to hit play.
- For play/pause:
  - Maintain offset correctly and call `drawFrame()` after pause and after resume start, so there are no visual jumps.

Do NOT change the overall structure of the loop; just make sure dependency arrays and draw logic are wired to always reflect current state.

=================================
5. Deliverables (for this product)
=================================

When you output your answer, provide:

- A concise list of code-level changes for:
  - Platform-aware export (mobile vs desktop).
  - Engine registry and tuning (which engines to hide, tweak, or add).
  - Supabase auth configuration and `useAuth` updates.
  - Visualizer loop changes for fully live parameter updates.

- Pseudocode or TypeScript snippets that patch the existing code rather than full rewrites.

- Short notes on any Supabase dashboard settings that MUST be updated (site URL, redirect URL, email settings) to make magic links work.

Remember: this is a DELTA on top of an existing app. Preserve what works; only modify the parts described above.