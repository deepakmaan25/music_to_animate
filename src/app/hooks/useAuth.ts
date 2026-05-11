import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * useAuth — single source of truth for Supabase auth state.
 *
 * Auth flow: email OTP (not magic-link).
 *
 *   WHY OTP INSTEAD OF MAGIC LINK?
 *   Email security scanners (Google, Microsoft Defender, Proofpoint, corporate proxies)
 *   pre-fetch every link in an email to check for phishing. Supabase magic links are
 *   single-use tokens — the scanner consumes the token before the user can click it,
 *   causing "link already used" errors. An OTP code entered manually is immune to this
 *   because the code is never embedded in a URL that a scanner would follow.
 *
 * Loading behaviour (Supabase v2):
 *   - loading=true  until INITIAL_SESSION event fires.
 *   - Supabase fires INITIAL_SESSION once auth state is resolved:
 *       • immediately (sync) if a valid session is already in localStorage, OR
 *       • after the session is fully established from verifyOtp().
 *   - Gate all user-specific data sync behind `!loading`.
 *
 * ============================================================
 * SUPABASE DASHBOARD SETUP (do this once — takes ~2 minutes)
 * ============================================================
 *
 * 1. Authentication → Providers → Email
 *    - Enable Email provider = ON
 *    - "Confirm email" = ON  (OTP verification counts as confirmation)
 *
 * 2. Authentication → Email Templates → select "Magic Link"
 *    Change the template so users see the 6-digit code.
 *    Recommended subject: "Your sign-in code"
 *    Recommended body (HTML):
 *
 *      <p>Your sign-in code is:</p>
 *      <h1 style="letter-spacing:0.25em;font-size:2rem;">{{ .Token }}</h1>
 *      <p>This code expires in 10 minutes. Do not share it with anyone.</p>
 *
 *    ⚠ Keep {{ .Token }} — that is the 6-digit code.
 *    You can optionally remove {{ .ConfirmationURL }}; it is no longer needed.
 *
 * 3. Authentication → URL Configuration
 *    - Site URL: https://your-production-domain.com
 *    - Redirect URLs: not required for OTP flow (no URL redirect happens)
 *
 * 4. (Optional) Authentication → Rate Limits / OTP Expiry
 *    Default OTP lifetime is 3600s. Tighten to 600s (10 min) for better security.
 *    Dashboard → Authentication → General → OTP Expiry = 600
 * ============================================================
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe BEFORE anything else so we never miss an event.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      // INITIAL_SESSION fires exactly once with the resolved starting auth state.
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Step 1 — send a 6-digit OTP to the user's email.
   *
   * signInWithOtp() with NO emailRedirectTo instructs Supabase to send
   * the OTP token ({{ .Token }}) which the user types manually.
   * This bypasses the magic-link URL entirely.
   */
  const sendOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // No emailRedirectTo — the user enters the code in-app, not via URL.
      },
    });
    if (error) throw error;
  };

  /**
   * Step 2 — verify the 6-digit code the user typed.
   * On success, Supabase creates a persisted session and onAuthStateChange
   * fires SIGNED_IN — the user/session state updates automatically.
   */
  const verifyOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email', // matches signInWithOtp email flow
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    /** Authenticated Supabase user — exposes user.id for project/upload keying. */
    user,
    /** Full session object (access_token, refresh_token, expires_at, etc.). */
    session,
    /** true while the initial auth state is being resolved — gate data sync here. */
    loading,
    sendOtp,
    verifyOtp,
    signOut,
  };
}
