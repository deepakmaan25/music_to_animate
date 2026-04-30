You are a senior front‑end + WebGL engineer and Supabase‑savvy full‑stack dev.

Context:
- App: “Music Animation Generator” (web app built from a Figma site).
- Stack: React + TypeScript (Next.js), theme system via CSS variables + useTheme hook, Web Audio API + <canvas> visualizer, optional Three.js for 3D, Supabase integration available.
- Current state:
  - Light/dark theme toggle works, but in light mode only the base background changes; gradients and contrast aren’t fully tuned.
  - Flow is wired end‑to‑end:
    - Hero CTAs and engine cards open a real <input type="file" accept="audio/*">.
    - Uploading an audio file creates a project and routes to a Studio view.
    - Studio decodes audio with AudioContext.decodeAudioData and runs an AnalyserNode at fftSize 1024.
    - Three engines exist and work:
      1) Spectrum Bars
      2) Radial Spectrum
      3) Particle Storm
    - These all use a 2D canvas visualizer driven by live frequency data.
    - Style / Motion / Color / Export tabs exist with sliders (beat sensitivity, smoothing, particle density, etc.) and proper idle/decoding/error/playing states.
    - Export uses canvas.captureStream() + MediaRecorder + MediaStreamDestination to mix audio and produce a downloadable WebM at selected aspect ratio (9:16 / 1:1 / 16:9), duration (Full / 15 / 30 / 60s), and quality preset (720p / 1080p / 4K).
  - Supabase is wired into the project but not yet used for auth or project storage.

Goals:
1) Fix light‑mode contrast and gradients so the UI is fully usable and intentional in light mode.
2) Add 3–4 immersive “3D‑feel” visual engines (using WebGL/Three.js) on top of the existing three engines, WITHOUT removing current styles.
3) Implement Supabase sign‑in and project persistence so projects and exports are saved to a backend and recoverable across sessions/devices, while still supporting anonymous/local usage.

================================
1. Light‑mode contrast & theming
================================

Requirements:
- Keep the existing theme toggle + useTheme hook, but extend the theme tokens.

Implementation details:
- Introduce/expand semantic CSS variables, for example:
  - --bg-base
  - --bg-elevated
  - --bg-preview
  - --border-subtle
  - --text-primary
  - --text-secondary
  - --accent-gradient-hero
  - --accent-gradient-cta
  - --engine-card-gradient

- Define values for both `[data-theme="dark"]` and `[data-theme="light"]`:
  - In light mode:
    - bg-base: very light, slightly tinted background (not pure white).
    - bg-preview: still dark/neutral so visuals pop (deep navy/charcoal).
    - text-primary: high contrast vs bg-base (WCAG AA/AAA).
    - text-secondary: ~7:1 contrast.
    - Gradients: reuse brand hues but brighter / less saturated for light mode so type stays readable.

- Apply tokens to:
  - Hero background + headline/body text.
  - CTA buttons (including hover and focus states).
  - Visual Engines cards.
  - Studio panels (Style/Motion/Color/Export) and engine list items.
  - Preview label (“Preview · Adaptive quality”).

- Ensure:
  - In light mode, panels feel lighter/elevated, but preview canvas remains a “dark theatre”.
  - All text in both themes has good contrast, especially body copy and small labels.

Deliver:
- Updated theme token definitions.
- Concrete CSS variable usage in key components (hero, CTAs, engine cards, Studio layout).
- Short note on how you validated contrast.

=========================================
2. New immersive 3D‑style visual engines
=========================================

We ALREADY HAVE three 2D engines:
1) Spectrum Bars
2) Radial Spectrum
3) Particle Storm

Keep them exactly as they are.

Now ADD 3–4 more engines that feel more immersive/3D while still being driven by the same AnalyserNode. Use WebGL/Three.js or similar where appropriate, but keep the API consistent: engines receive smoothed frequency and energy data and return a render loop.

General engine requirements:
- Use the existing audio analysis pipeline: FFT data, energy curve, maybe section markers (intro/verse/chorus/drop).
- Each engine:
  - Has a distinct visual identity and motion language.
  - Maps bass/mids/highs to different parameters (scale, rotation, color, blur, etc.).
  - Has a small set of user‑exposed controls under Style/Motion/Color tabs (sliders/toggles).
- Keep performance in mind; add a “Performance mode” toggle that reduces complexity for low‑powered devices (fewer particles, lower grid resolution, etc.).

Implement at least these four engines:

Engine 4 – “Orbital Rings”
- Concept:
  - Concentric 3D rings orbit around a glowing core, tilting and pulsing with the beat.
- Behaviour:
  - Scene: central glowing sphere; 3–6 torus rings around it; slow camera orbit.
  - Bass → ring radius + tilt and “breathing” scale.
  - Mids → ring thickness + ring glow.
  - Highs → sparks or flares traveling along rings on peaks.
  - Section logic: calmer in verses; more rings + faster orbit in drops.
- Controls:
  - Style: ring count; core style (solid / nebula / dot).
  - Motion: orbit speed; beat intensity.
  - Color: gradient presets + custom colors.

Engine 5 – “Depth Field Particles”
- Concept:
  - Flying through a 3D particle cloud (starfield) with depth of field.
- Behaviour:
  - Scene: thousands of particles in 3D; camera moves forward with gentle sway; near particles larger/blurred, far particles small/sharp.
  - Bass → forward speed + radial shockwave pulses.
  - Mids → particle size + clustering.
  - Highs → sparkle intensity/flicker.
  - Sections: build‑ups increase density and speed; drops trigger big shockwaves; quiet sections slow drift.
- Controls:
  - Motion: travel speed; depth exaggeration.
  - Style: particle density; shockwave frequency.
  - Color: two/three‑color gradient presets + custom colors.

Engine 6 – “Audio Terrain”
- Concept:
  - A 3D wave/terrain landscape whose height follows the track’s spectrum.
- Behaviour:
  - Scene: grid plane stretching into distance; camera flies low over the terrain.
  - Bass → large hills; mids → medium ripples; highs → fine jitter/glow on lines.
  - Sections: choruses/drops = higher peaks + faster flyover; breakdowns = hover + calmer terrain.
- Controls:
  - Style: wireframe vs solid; grid detail.
  - Motion: terrain roughness; camera speed.
  - Color: sky gradient + terrain glow presets.

Engine 7 – “Neon Tunnel”
- Concept:
  - Infinite neon tunnel (circular/hex/square) with beats driving pulses and zooms.
- Behaviour:
  - Scene: repeating tunnel segments receding into distance; camera moves forward, occasionally rolling slightly.
  - Bass → forward speed + scale pops on hits.
  - Mids → panel brightness and pattern changes.
  - Highs → rim lights/sparks (soft‑limited to avoid harsh strobes).
  - Sections: build‑ups tighten tunnel; drops zoom out or snap to new pattern/color.
- Controls:
  - Style: tunnel shape; panel density.
  - Motion: camera roll amount; beat zoom intensity.
  - Color: palette presets; optional auto color cycle per section.

Integration into UI:
- In Style tab, ENGINE list:
  - Keep existing three engines at the top.
  - Group the new ones under a “3D” label.
- Add a “Performance mode” toggle for all engines:
  - When ON, reduce complexity (particle count, detail, segments) and cap fps if needed.

Deliver:
- Engine interfaces / TypeScript types.
- Implementation sketches/pseudocode for each engine (how they use FFT data).
- Updated controls in Style/Motion/Color tabs for these engines.

===========================================
3. Supabase sign‑in and project persistence
===========================================

Goal:
- Add real user accounts and backend storage so projects and exports persist across sessions and devices.
- Keep existing localStorage projects so anonymous users can still experiment.
- When users sign in, sync/migrate their local projects to Supabase.

Assumptions:
- Supabase project is created with URL + anon key.
- We can use @supabase/supabase-js.
- Auth should persist via localStorage.

3.1 Supabase client & auth hook
-------------------------------

Implement:
- supabaseClient.ts:

  - createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storage: window.localStorage, autoRefreshToken: true }
    })

- useAuth() hook:
  - Tracks { user, session, loading } via supabase.auth.getSession() and onAuthStateChange.
  - Exposes functions:
    - signInWithEmail(email) – send magic link.
    - signInWithProvider('google') – OAuth.
    - signOut().

3.2 Auth UI
-----------

- Navbar:
  - When logged out:
    - “Sign in” button → modal with:
      - Email text field + “Send magic link”.
      - Optional Google sign‑in button.
  - When logged in:
    - Show avatar/initials + email.
    - Dropdown menu:
      - “My Projects”
      - “Sign out”

- Handle loading state (spinner or skeleton) while session is being restored.

3.3 Database schema
-------------------

Create tables in Supabase:

profiles (optional, linked to auth.users):
- id uuid primary key references auth.users(id)
- display_name text
- created_at timestamptz default now()
- updated_at timestamptz default now()

projects:
- id uuid primary key default gen_random_uuid()
- user_id uuid references auth.users(id) on delete cascade
- name text not null
- audio_url text           -- Supabase Storage path or external URL
- duration_seconds integer
- bpm numeric
- config jsonb not null    -- full Style/Motion/Color/Engine config
- created_at timestamptz default now()
- updated_at timestamptz default now()

exports:
- id uuid primary key default gen_random_uuid()
- project_id uuid references public.projects(id) on delete cascade
- type text check (type in ('webm','mp4'))
- status text check (status in ('recording','transcoding','rendering','ready','error'))
- aspect_ratio text
- resolution text
- duration_seconds integer
- quality_preset text
- url text                 -- final download URL
- error_message text
- created_at timestamptz default now()

Enable RLS so users can only access their own rows.

3.4 LocalStorage + Supabase sync strategy
-----------------------------------------

We already have localStorage persistence. Extend it into a dual‑layer store:

- Local shape (example key: "mag-projects-v1"):
  {
    projects: {
      [projectId]: {
        id,
        remoteId?: string,        // Supabase project id
        name,
        audioMeta,
        engineId,
        style,
        motion,
        color,
        exports: { ... }
      }
    },
    lastOpenedProjectId
  }

Implement a useProjectStore() hook/provider that:

- Works offline and for anonymous users:
  - All create/update/export operations update the local store.

- When user logs in:
  - Fetch projects from Supabase (projects where user_id = current user).
  - Merge them into local store.
  - Detect existing local projects without remoteId and:
    - Either auto‑upload them to Supabase, OR
    - Prompt user: “Import X local projects into your account?”

- For logged‑in users:
  - Saving a project:
    - Upsert to Supabase projects table (including config JSON).
    - Update local project.remoteId.
  - Creating an export (after WebM/MP4 done):
    - Insert into Supabase exports table.
    - Store returned URL and metadata in local exports list.

3.5 Studio UI changes
---------------------

- Add a “Save” or “Saved” indicator in Studio header:
  - Anonymous:
    - Saves to localStorage only.
    - Show small hint: “Sign in to sync projects across devices.”
  - Logged in:
    - On change, autosave or explicit save button triggers Supabase upsert.
    - Show toast/snackbar on success/failure.

- “My Projects” view (modal or /projects route):
  - List projects from combined local+Supabase store (but clearly mark which are synced).
  - Show:
    - Name, createdAt, engine, duration.
  - Actions:
    - “Open” → load into Studio.
    - “Delete” → delete locally and in Supabase.

3.6 Acceptance criteria
-----------------------

When you’re done, the app should satisfy:

- Light Mode:
  - Text and gradients have good contrast; preview stays dark but panels adjust.
- Visual Engines:
  - All three original engines still work.
  - Four new immersive engines (Orbital Rings, Depth Field Particles, Audio Terrain, Neon Tunnel) exist, selectable in Style tab, and respond visibly to bass/mids/highs.
  - Performance mode reduces complexity for low-end devices.

- Supabase:
  - User can sign in (magic link or OAuth), sign out, and have session persist across refresh.
  - While logged in:
    - New projects and edits are stored in Supabase.
    - Exports are written to Supabase exports table.
    - “My Projects” lists backend projects and opens them correctly.
  - Local anonymous projects still work; optional migration on first login.

Please:
- Update the existing codebase/spec with all of the above.
- Provide:
  - Concrete type definitions for engines and theme tokens.
  - React hooks for auth and project store.
  - Example SQL for Supabase tables and notes on RLS policies.
  - Any necessary Three.js/WebGL setup code sketches for the new engines.