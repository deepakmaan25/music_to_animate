You are working on an EXISTING product called “Music Animation Generator”.

Tech stack already exists:
- Next.js
- React
- TypeScript
- Supabase auth
- Supabase database/storage planned or partially wired

IMPORTANT:
- Do NOT rebuild the app from scratch.
- Do NOT redesign unrelated UI.
- Do NOT replace Supabase with another auth provider.
- Your task is ONLY to fix and complete the EXISTING magic-link sign-in flow so it works reliably.

================================
1. Product context
================================

This product already has:
- A landing page
- A Studio/editor flow
- Audio upload and animation generation
- Some level of local project persistence
- A partially implemented Supabase integration

Current auth issue:
- The app successfully sends a magic-link email to the intended email address.
- But when the user clicks the link, the sign-in flow breaks:
  - the redirect is wrong OR
  - the callback route is not correctly handling session creation OR
  - the app does not restore/set session properly after redirect.
- As a result:
  - the user is not reliably signed in,
  - the app does not persist authenticated sessions correctly,
  - and user-specific project storage cannot work.

Your job is to FIX this as a delta on the existing implementation.

================================
2. Goal
================================

Make Supabase passwordless magic-link auth fully functional so that:

- A user enters their email.
- A magic-link email is sent successfully.
- Clicking the email link opens the correct app URL.
- The session is correctly established in the browser.
- The user becomes authenticated in the app UI.
- Refreshing the app preserves the session.
- The app can then use `user.id` to associate saved projects, uploads, and exports with that authenticated user.

================================
3. What to investigate and fix
================================

You should assume the current issue may be caused by one or more of these:

1. Supabase dashboard misconfiguration
- Wrong Site URL
- Missing Redirect URLs
- Email provider not fully enabled
- Localhost URL still being used in production links

2. Incorrect frontend sign-in call
- `signInWithOtp()` missing `emailRedirectTo`
- Hardcoded redirect URL
- Wrong callback path

3. Broken callback route handling
- Missing `/auth/callback` page or route
- Session not being read after redirect
- Not subscribing to auth state changes
- App redirecting too early before session exists

4. Broken auth state management
- `getSession()` not called on app load
- `onAuthStateChange()` missing or incomplete
- auth context/hook not restoring user on refresh
- session persistence not configured properly

5. Wrong verification assumptions
- manually verifying in the wrong way
- relying on incorrect OTP handling for magic links
- not handling redirect hash/session exchange correctly

================================
4. Required outcome
================================

Fix the existing implementation so that all of the following work:

A. Local development
- Magic links work on localhost during development.
- Redirects return to the correct localhost callback route.
- User session is created successfully.

B. Production deployment
- Magic links work on the deployed domain.
- Redirects use the real production URL rather than localhost.
- User session is created successfully.

C. Persistent auth state
- User stays signed in after refresh.
- App knows whether auth is loading, authenticated, or signed out.
- Protected parts of the app can safely rely on `user.id`.

================================
5. Required implementation tasks
================================

Please complete all of the following within the existing codebase.

--------------------------------
Task A — Fix Supabase dashboard configuration
--------------------------------

Give exact instructions and code assumptions for Supabase dashboard configuration.

You must verify and specify:
- Authentication → Providers → Email is enabled
- Authentication → URL Configuration:
  - Site URL
  - Additional Redirect URLs

Support both:
- local development, e.g. `http://localhost:3000`
- production deployment, e.g. `https://your-real-domain.com`

The solution must clearly distinguish:
- what Site URL should be in production
- what Redirect URLs should include for localhost and production
- why incorrect Site URL causes broken magic-link sign-in

--------------------------------
Task B — Fix the frontend sign-in action
--------------------------------

Patch the existing login flow.

Implement or fix the existing `signInWithOtp()` call so that:
- it accepts email input,
- it sends a magic link,
- it passes `options.emailRedirectTo`,
- the redirect target is dynamic and environment-safe.

Use the current browser origin if appropriate, for example:
- `${window.location.origin}/auth/callback`

Also:
- keep the current UI structure if possible,
- improve error handling,
- show useful user feedback:
  - sending
  - sent
  - error

Do not redesign the whole auth screen.

--------------------------------
Task C — Build/fix the `/auth/callback` route
--------------------------------

Create or patch an auth callback route in the existing app.

Requirements:
- When the user lands on `/auth/callback`, the app must:
  1. initialize the Supabase client,
  2. read the current session,
  3. handle auth completion correctly,
  4. wait for session state if needed,
  5. redirect authenticated users into the app.

The callback route must also:
- handle loading state,
- handle missing/invalid session state,
- handle expired or broken links gracefully,
- avoid redirect loops.

Do NOT produce a hand-wavy explanation — provide real implementation logic.

--------------------------------
Task D — Fix session persistence and auth state
--------------------------------

Patch the existing auth state layer.

Implement or fix:
- Supabase client config for persistent sessions
- a `useAuth` hook or auth context that:
  - calls `getSession()` on app load,
  - subscribes to `onAuthStateChange()`,
  - stores `user`, `session`, and `loading`,
  - exposes sign-in and sign-out methods.

The app should:
- know when auth is still loading,
- know when a user is signed in,
- know when no session exists,
- update the UI immediately when magic-link login succeeds.

Do NOT overcomplicate the architecture.
Patch the current one cleanly.

--------------------------------
Task E — Make the authenticated user usable by the rest of the product
--------------------------------

Once sign-in works, ensure the result is usable by the rest of the app.

Specifically:
- authenticated user object must expose `user.id`
- this `user.id` will be used later for:
  - projects
  - uploaded tracks
  - saved animations
  - exports

Add notes in code or architecture about where the rest of the app should wait for auth before syncing user-specific data.

--------------------------------
Task F — Add proper failure handling
--------------------------------

Handle these cases well:
- invalid or expired magic link
- redirect URL mismatch
- session not found after callback
- auth provider disabled
- localhost/prod mismatch
- user closes tab and returns later
- app loads before session is fully restored

Add clear UX behaviour:
- loading message on callback
- failure message with retry action
- success redirect

================================
6. Implementation constraints
================================

- This is NOT a greenfield build.
- Keep the current Next.js/React/TS structure.
- Do not replace working UI unnecessarily.
- Make targeted, minimal, correct patches.
- Prefer clear, production-safe code over clever abstractions.
- Assume project persistence and uploads will rely on this auth layer next, so keep it robust.

================================
7. Deliverables
================================

In your answer, provide all of the following:

1. Diagnosis
- Explain the likely causes of the current broken magic-link flow in this existing app.

2. Supabase dashboard checklist
- Exact settings to verify/update in Supabase dashboard for:
  - Site URL
  - Redirect URLs
  - Email provider

3. Code patches
Provide implementation-ready code or patch-style snippets for:
- Supabase client setup
- login/signInWithOtp action
- `/auth/callback` route/page
- `useAuth` hook or auth context
- sign-out flow if needed

4. Routing/auth flow explanation
- Explain the exact happy path from:
  - entering email
  - receiving link
  - clicking link
  - callback route handling
  - session restoration
  - redirect into the app

5. Failure-state handling
- Show how to handle common errors gracefully.

6. Test plan
Provide a concrete checklist to test:
- localhost dev flow
- deployed production flow
- refresh persistence
- invalid link behaviour
- sign-out and sign-in again

7. Keep it patch-oriented
- Assume existing code already exists.
- Show changes as if patching an existing product, not writing a tutorial from scratch.

================================
8. Technical expectations
================================

Use Supabase best practices for magic-link/passwordless auth:
- `signInWithOtp()`
- `emailRedirectTo`
- correct redirect URL configuration
- `getSession()`
- `onAuthStateChange()`

Do not give vague advice only.
Give code and structured implementation steps that can be applied directly to the existing product.