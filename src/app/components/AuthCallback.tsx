import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, CheckCircle, XCircle, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';

type Phase = 'loading' | 'success' | 'error';

/**
 * AuthCallback — safety-net page at /auth/callback.
 *
 * Primary auth is now OTP (6-digit code entered in the modal).
 * This page is kept as a fallback for any stale magic-link emails
 * that may still be in flight or cached in users' inboxes.
 *
 * If Supabase does exchange a valid code from the URL (detectSessionInUrl: true),
 * the user is silently signed in and redirected home — same good outcome.
 * If the link is expired/consumed, they see a clear message and can use
 * the OTP flow instead.
 */
export function AuthCallback() {
  const [phase, setPhase]     = useState<Phase>('loading');
  const [message, setMessage] = useState('Signing you in…');
  const [detail, setDetail]   = useState('');
  const resolvedRef = useRef(false);

  useEffect(() => {
    // Check for error params Supabase appends on failure:
    // e.g. /auth/callback?error=access_denied&error_description=Email+link+is+invalid
    const url  = new URL(window.location.href);
    const code = url.searchParams.get('error');
    const desc = url.searchParams.get('error_description');

    if (code) {
      resolvedRef.current = true;
      setPhase('error');
      setMessage('Sign-in link expired');
      setDetail(
        desc
          ? decodeURIComponent(desc.replace(/\+/g, ' '))
          : 'This link has already been used or has expired.'
      );
      return;
    }

    // Subscribe to auth state — detectSessionInUrl: true in supabase.ts
    // means the client auto-exchanges a ?code= query param if present.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolvedRef.current) return;

      if (event === 'SIGNED_IN' && session) {
        resolvedRef.current = true;
        setMessage('Signed in!');
        setPhase('success');
        setTimeout(() => window.location.replace('/'), 1200);

      } else if (event === 'INITIAL_SESSION' && !session) {
        // Code already consumed or link is invalid — guide user to OTP.
        resolvedRef.current = true;
        setPhase('error');
        setMessage('Link expired or already used');
        setDetail(
          'Sign-in links can only be used once and expire quickly. ' +
          'Use the 6-digit code from your email instead — it works even after the link stops working.'
        );
      }
    });

    // Timeout fallback (network issues, etc.)
    const timeout = setTimeout(() => {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setPhase('error');
        setMessage('Sign-in timed out');
        setDetail(
          'Could not verify the link. Try signing in with a code from your email.'
        );
      }
    }, 15_000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const goHome = () => window.location.replace('/');

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--hero-bg-gradient)' }}
    >
      {/* ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 size-[500px] rounded-full blur-[120px] opacity-25 pointer-events-none"
        style={{ background: 'var(--hero-cta-gradient)' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{
          background:    'var(--surface-elevated)',
          borderColor:   'var(--surface-glass-border)',
          backdropFilter:'blur(20px)',
          color:         'var(--text-strong)',
        }}
      >
        {/* logo mark */}
        <div
          className="size-8 rounded-lg mx-auto mb-6"
          style={{ background: 'var(--hero-cta-gradient)', boxShadow: 'var(--accent-glow)' }}
        />

        {/* icon */}
        <motion.div
          key={phase}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="flex justify-center mb-4"
        >
          {phase === 'loading' && (
            <Loader2 className="size-10 animate-spin" style={{ color: 'var(--text-muted)' }} />
          )}
          {phase === 'success' && (
            <CheckCircle className="size-10 text-emerald-500" />
          )}
          {phase === 'error' && (
            <XCircle className="size-10 text-red-400" />
          )}
        </motion.div>

        {/* heading */}
        <motion.h2
          key={message}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-semibold tracking-tight mb-2"
        >
          {message}
        </motion.h2>

        {/* body */}
        {phase === 'loading' && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Verifying your link…
          </p>
        )}

        {phase === 'success' && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Redirecting you to the app…
          </p>
        )}

        {phase === 'error' && (
          <>
            {detail && (
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
                {detail}
              </p>
            )}

            {/* Tip: use the code */}
            <div
              className="rounded-lg border p-3 mb-4 text-left flex items-start gap-2.5"
              style={{ borderColor: 'var(--surface-glass-border)', background: 'var(--surface-glass)' }}
            >
              <Hash className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-strong)' }}>Tip:</strong> check the same email for a <strong style={{ color: 'var(--text-strong)' }}>6-digit code</strong>. 
                Enter it in the sign-in dialog — it works even when the link doesn't.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={goHome}
                className="w-full text-white"
                style={{ background: 'var(--hero-cta-gradient)' }}
              >
                Sign in with a code
              </Button>
              <button
                onClick={goHome}
                className="text-xs py-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Back to app
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
