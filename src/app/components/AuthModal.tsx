import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Loader2, CheckCircle, ArrowLeft, RotateCcw, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../hooks/useAuth';

const OTP_LENGTH     = 6;
const RESEND_SECONDS = 60;

type Step =
  | 'email'          // enter email
  | 'password'       // returning user: enter password
  | 'signup'         // new user: create password
  | 'otp'            // verify email after signup (or OTP fallback)
  | 'reset_sent'     // password reset email sent
  | 'success';       // signed in

function friendlyError(err: any): string {
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'Incorrect password. Try again or use a code instead.';
  if (msg.includes('email not confirmed')) return 'Email not verified yet. Check your inbox for the code.';
  if (msg.includes('expired') || msg.includes('invalid') && msg.includes('token')) return 'That code has expired or is incorrect. Request a new one.';
  if (msg.includes('rate') || msg.includes('too many')) return 'Too many attempts. Please wait a moment.';
  if (msg.includes('already registered') || msg.includes('already exists')) return 'This email is already registered. Sign in instead.';
  if (msg.includes('password') && msg.includes('short')) return 'Password must be at least 6 characters.';
  return err?.message || 'Something went wrong. Please try again.';
}

// ─── OTP digit box (unchanged) ───────────────────────────────────────────────
interface DigitBoxProps {
  idx: number; value: string; disabled: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (idx: number, val: string) => void;
  onKeyDown: (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}
function DigitBox({ idx, value, disabled, inputRef, onChange, onKeyDown, onPaste }: DigitBoxProps) {
  return (
    <input ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*"
      maxLength={OTP_LENGTH} autoComplete={idx === 0 ? 'one-time-code' : 'off'}
      value={value} disabled={disabled}
      onChange={(e) => onChange(idx, e.target.value)}
      onKeyDown={(e) => onKeyDown(idx, e)} onPaste={onPaste}
      onFocus={(e) => e.target.select()} aria-label={`Digit ${idx + 1}`}
      className="size-12 text-center text-lg font-semibold rounded-xl border-2 transition-all outline-none focus:border-purple-500 disabled:opacity-40"
      style={{ background: 'var(--surface-glass)', borderColor: value ? 'rgb(168,85,247)' : 'var(--surface-glass-border)', color: 'var(--text-strong)' }}
    />
  );
}

// ─── Password input with show/hide toggle ─────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Password'} autoComplete={autoComplete ?? 'current-password'}
        className="pl-9 pr-10 h-11" />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center"
        style={{ color: 'var(--text-muted)' }} tabIndex={-1}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signInWithPassword, signUpWithPassword, sendOtp, verifyOtp, sendPasswordReset } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP state
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('email'); setEmail(''); setPassword(''); setConfirm('');
        setLoading(false); setError(null);
        setDigits(Array(OTP_LENGTH).fill('')); setVerifying(false); setVerifyError(null);
        verifyingRef.current = false; setCooldown(0);
        if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const startCooldown = () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    setCooldown(RESEND_SECONDS);
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(cooldownTimer.current!); return 0; } return c - 1; });
    }, 1000);
  };

  // ── Step 1: email ──────────────────────────────────────────────────────────
  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setStep('password');
  };

  // ── Step 2a: sign in with password ────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true); setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      setStep('success');
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: sign up with password ────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    try {
      await signUpWithPassword(email.trim(), password);
      // Supabase will email a verification OTP automatically
      setDigits(Array(OTP_LENGTH).fill(''));
      setVerifyError(null); verifyingRef.current = false;
      startCooldown();
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 320);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── OTP fallback login (for users without a password) ─────────────────────
  const handleSendOtp = async () => {
    setLoading(true); setError(null);
    try {
      await sendOtp(email.trim());
      setDigits(Array(OTP_LENGTH).fill(''));
      setVerifyError(null); verifyingRef.current = false;
      startCooldown();
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 320);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verify ─────────────────────────────────────────────────────────────
  const handleVerify = async (code: string) => {
    if (code.length !== OTP_LENGTH || verifyingRef.current) return;
    verifyingRef.current = true; setVerifying(true); setVerifyError(null);
    try {
      await verifyOtp(email, code);
      setStep('success');
      setTimeout(onClose, 1400);
    } catch (err: any) {
      verifyingRef.current = false; setVerifying(false);
      setVerifyError(friendlyError(err));
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    setLoading(true); setError(null);
    try {
      await sendPasswordReset(email.trim());
      setStep('reset_sent');
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── OTP digit handlers (unchanged logic) ──────────────────────────────────
  const onDigitChange = (idx: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < Math.min(clean.length, OTP_LENGTH); i++) next[i] = clean[i];
      setDigits(next);
      inputRefs.current[Math.min(clean.length, OTP_LENGTH - 1)]?.focus();
      if (clean.length >= OTP_LENGTH) handleVerify(clean.slice(0, OTP_LENGTH));
      return;
    }
    const next = [...digits]; next[idx] = clean; setDigits(next);
    if (clean && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
    const code = next.join('');
    if (code.length === OTP_LENGTH && next.every(Boolean)) handleVerify(code);
  };
  const onDigitKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };
  const onDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (pasted.length === OTP_LENGTH) handleVerify(pasted);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: 'var(--surface-elevated)', borderColor: 'var(--surface-glass-border)',
    color: 'var(--text-strong)', backdropFilter: 'blur(20px)',
  };
  const slideIn  = { initial: { opacity: 0, x: -16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 16 }, transition: { duration: 0.18 } };
  const slideOut = { initial: { opacity: 0, x: 16 },  animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 }, transition: { duration: 0.18 } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={step !== 'success' ? onClose : undefined}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }} transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-6 overflow-hidden" style={cardStyle}>
            <AnimatePresence mode="wait" initial={false}>

              {/* ── STEP: email ───────────────────────────────────────── */}
              {step === 'email' && (
                <motion.div key="email" {...slideIn}>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-semibold tracking-tight">Welcome</h2>
                    <button onClick={onClose} className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center"><X className="size-4" /></button>
                  </div>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Enter your email to sign in or create an account.</p>
                  <form onSubmit={handleEmailContinue} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                      <Input type="email" required placeholder="you@example.com" autoComplete="email" autoFocus
                        value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" />
                    </div>
                    <Button type="submit" className="w-full h-11 text-white" style={{ background: 'var(--hero-cta-gradient)' }}>
                      Continue →
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ── STEP: password (sign in) ──────────────────────────── */}
              {step === 'password' && (
                <motion.div key="password" {...slideOut}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <button onClick={() => { setStep('email'); setError(null); }}
                      className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center shrink-0"><ArrowLeft className="size-4" /></button>
                    <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
                    <button onClick={onClose} className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center ml-auto shrink-0"><X className="size-4" /></button>
                  </div>
                  <p className="text-sm mb-5 pl-9" style={{ color: 'var(--text-muted)' }}>
                    Signing in as <strong style={{ color: 'var(--text-strong)' }}>{email}</strong>
                  </p>
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
                    {error && <p className="text-xs text-red-400 px-1">{error}</p>}
                    <Button type="submit" disabled={loading || !password} className="w-full h-11 text-white" style={{ background: 'var(--hero-cta-gradient)' }}>
                      {loading ? <><Loader2 className="size-4 animate-spin mr-2" />Signing in…</> : 'Sign in'}
                    </Button>
                  </form>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: 'var(--surface-glass-border)' }}>
                    <button onClick={() => { setStep('signup'); setPassword(''); setConfirm(''); setError(null); }}
                      className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
                      New user? Create account
                    </button>
                    <div className="flex items-center gap-3">
                      <button onClick={handleForgotPassword} disabled={loading}
                        className="text-xs hover:underline disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
                        Forgot password?
                      </button>
                      <span style={{ color: 'var(--surface-glass-border)' }}>·</span>
                      <button onClick={handleSendOtp} disabled={loading}
                        className="text-xs hover:underline disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
                        Use a code
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP: signup (create password) ───────────────────── */}
              {step === 'signup' && (
                <motion.div key="signup" {...slideOut}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <button onClick={() => { setStep('password'); setError(null); }}
                      className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center shrink-0"><ArrowLeft className="size-4" /></button>
                    <h2 className="text-xl font-semibold tracking-tight">Create account</h2>
                    <button onClick={onClose} className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center ml-auto shrink-0"><X className="size-4" /></button>
                  </div>
                  <p className="text-sm mb-5 pl-9" style={{ color: 'var(--text-muted)' }}>
                    Account for <strong style={{ color: 'var(--text-strong)' }}>{email}</strong>
                  </p>
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <PasswordInput value={password} onChange={setPassword} placeholder="Create a password (min 6 chars)" autoComplete="new-password" />
                    <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm password" autoComplete="new-password" />
                    {error && <p className="text-xs text-red-400 px-1">{error}</p>}
                    <Button type="submit" disabled={loading || !password || !confirm} className="w-full h-11 text-white" style={{ background: 'var(--hero-cta-gradient)' }}>
                      {loading ? <><Loader2 className="size-4 animate-spin mr-2" />Creating account…</> : 'Create account'}
                    </Button>
                  </form>
                  <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                    We'll email you a verification code to confirm your address.
                  </p>
                </motion.div>
              )}

              {/* ── STEP: OTP (verify email or fallback login) ────────── */}
              {step === 'otp' && (
                <motion.div key="otp" {...slideOut}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <button onClick={() => { setStep('password'); setError(null); }}
                      className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center shrink-0"><ArrowLeft className="size-4" /></button>
                    <h2 className="text-xl font-semibold tracking-tight">Check your inbox</h2>
                    <button onClick={onClose} className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center ml-auto shrink-0"><X className="size-4" /></button>
                  </div>
                  <p className="text-sm mb-6 pl-9" style={{ color: 'var(--text-muted)' }}>
                    We sent a 6-digit code to <strong style={{ color: 'var(--text-strong)' }}>{email}</strong>.
                  </p>
                  <div className="flex gap-2 justify-center mb-3">
                    {digits.map((d, i) => (
                      <DigitBox key={i} idx={i} value={d} disabled={verifying}
                        inputRef={(el) => { inputRefs.current[i] = el; }}
                        onChange={onDigitChange} onKeyDown={onDigitKeyDown} onPaste={onDigitPaste} />
                    ))}
                  </div>
                  <div className="min-h-[22px] flex items-center justify-center mb-2">
                    <AnimatePresence mode="wait">
                      {verifying && (
                        <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <Loader2 className="size-3.5 animate-spin" /> Verifying…
                        </motion.div>
                      )}
                      {verifyError && (
                        <motion.p key="e" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-400 text-center px-2">{verifyError}</motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <button onClick={async () => {
                      if (cooldown > 0 || loading) return;
                      setLoading(true);
                      try { await sendOtp(email); startCooldown(); setDigits(Array(OTP_LENGTH).fill('')); setVerifyError(null); verifyingRef.current = false; }
                      catch {} finally { setLoading(false); }
                    }} disabled={cooldown > 0 || loading}
                      className="flex items-center gap-1.5 text-xs disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
                      {loading ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                    <span style={{ color: 'var(--surface-glass-border)' }}>·</span>
                    <button onClick={() => setStep('email')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Use different email
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP: reset sent ──────────────────────────────────── */}
              {step === 'reset_sent' && (
                <motion.div key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center">
                  <div className="size-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(168,85,247,0.12)' }}>
                    <Mail className="size-7 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1">Check your inbox</h2>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    We sent a password reset link to <strong>{email}</strong>.
                  </p>
                  <button onClick={() => { setStep('password'); setError(null); }}
                    className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
                    ← Back to sign in
                  </button>
                </motion.div>
              )}

              {/* ── STEP: success ─────────────────────────────────────── */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
                  <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.08 }}
                    className="flex justify-center mb-4">
                    <div className="size-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <CheckCircle className="size-8 text-emerald-500" />
                    </div>
                  </motion.div>
                  <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                    className="text-xl font-semibold mb-1">You're in!</motion.h2>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }}
                    className="text-sm" style={{ color: 'var(--text-muted)' }}>Your projects are now syncing.</motion.p>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-1.5 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <ShieldCheck className="size-3.5 text-emerald-500" /> Secured with Supabase Auth
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
