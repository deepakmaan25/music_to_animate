import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === 'INITIAL_SESSION') setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Sign in with email + password. Throws on failure. */
  const signInWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  /**
   * Create a new account with email + password.
   * Supabase sends a verification OTP to the email.
   * Returns { needsVerification: true } so the modal can show the OTP step.
   */
  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // If identities is empty, the email is already registered
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    return data;
  };

  /** Send a 6-digit OTP (used as fallback / email verification). */
  const sendOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  };

  /** Verify a 6-digit OTP (signup email confirmation or fallback login). */
  const verifyOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    return data;
  };

  /** Send a password-reset link to the email address. */
  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) throw error;
  };

  /** Set a new password for the currently signed-in user (post-OTP migration). */
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return {
    user, session, loading,
    signInWithPassword, signUpWithPassword,
    sendOtp, verifyOtp,
    sendPasswordReset, updatePassword,
    signOut,
  };
}
