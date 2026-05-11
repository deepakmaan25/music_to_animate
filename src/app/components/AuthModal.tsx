import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Loader2, CheckCircle, ArrowLeft, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../hooks/useAuth';

// ─── constants ───────────────────────────────────────────────────────────────
const OTP_LENGTH     = 6;
const RESEND_SECONDS = 60; // Supabase rate-limits to ~1 email per 60 s

// ─── types ───────────────────────────────────────────────────────────────────
type Step         = 'email' | 'otp' | 'success';
type SendStatus   = 'idle' | 'sending' | 'sent' | 'error';
type VerifyStatus = 'idle' | 'verifying' | 'error';

// ─── helpers ─────────────────────────────────────────────────────────────────
function friendlyVerifyError(err: any): string {
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('expired') || msg.includes('invalid')) {
    return 'That code has expired or is incorrect. Request a new one below.';
  }
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a moment, then request a new code.';
  }
  return err?.message || 'Verification failed. Please try again.';
}

// ─── OTP digit box ───────────────────────────────────────────────────────────
interface DigitBoxProps {
  idx:      number;
  value:    string;
  disabled: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (idx: number, val: string) => void;
  onKeyDown:(idx: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste:  (e: React.ClipboardEvent<HTMLInputElement>) => void;
}
function DigitBox({ idx, value, disabled, inputRef, onChange, onKeyDown, onPaste }: DigitBoxProps) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={OTP_LENGTH} // allow paste across a single box
      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(idx, e.target.value)}
      onKeyDown={(e) => onKeyDown(idx, e)}
      onPaste={onPaste}
      onFocus={(e) => e.target.select()}
      aria-label={`Digit ${idx + 1}`}
      className="size-12 text-center text-lg font-semibold rounded-xl border-2 transition-all outline-none focus:border-purple-500 disabled:opacity-40 select-all"
      style={{
        background:   'var(--surface-glass)',
        borderColor:  value ? 'rgb(168,85,247)' : 'var(--surface-glass-border)',
        color:        'var(--text-strong)',
        caretColor:   'rgb(168,85,247)',
      }}
    />
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendOtp, verifyOtp } = useAuth();

  // Step
  const [step, setStep] = useState<Step>('email');

  // Email
  const [email, setEmail]         = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendError, setSendError]   = useState<string | null>(null);

  // OTP digits
  const [digits, setDigits]           = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [verifyError, setVerifyError]   = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyingRef = useRef(false); // prevent double-submit race

  // Resend cooldown
  const [cooldown, setCooldown]     = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── reset on close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Delay reset until after exit animation finishes
      const t = setTimeout(() => {
        setStep('email');
        setEmail('');
        setSendStatus('idle');
        setSendError(null);
        setDigits(Array(OTP_LENGTH).fill(''));
        setVerifyStatus('idle');
        setVerifyError(null);
        verifyingRef.current = false;
        setCooldown(0);
        if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── cooldown ticker ─────────────────────────────────────────────────────
  const startCooldown = () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    setCooldown(RESEND_SECONDS);
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownTimer.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── send / resend ────────────────────────────────────────────────────────
  const doSend = async (targetEmail: string): Promise<boolean> => {
    setSendStatus('sending');
    setSendError(null);
    try {
      await sendOtp(targetEmail);
      setSendStatus('sent');
      return true;
    } catch (err: any) {
      setSendStatus('error');
      setSendError(err?.message || 'Failed to send code. Please try again.');
      return false;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sendStatus === 'sending') return;
    const ok = await doSend(email.trim());
    if (ok) {
      setDigits(Array(OTP_LENGTH).fill(''));
      setVerifyError(null);
      verifyingRef.current = false;
      setVerifyStatus('idle');
      startCooldown();
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 320); // after slide animation
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || sendStatus === 'sending') return;
    setDigits(Array(OTP_LENGTH).fill(''));
    setVerifyError(null);
    verifyingRef.current = false;
    setVerifyStatus('idle');
    const ok = await doSend(email);
    if (ok) {
      startCooldown();
      setTimeout(() => inputRefs.current[0]?.focus(), 80);
    }
  };

  const goBackToEmail = () => {
    setStep('email');
    setSendStatus('idle');
    setSendError(null);
    setDigits(Array(OTP_LENGTH).fill(''));
    setVerifyError(null);
    verifyingRef.current = false;
    setVerifyStatus('idle');
  };

  // ── verify ───────────────────────────────────────────────────────────────
  const handleVerify = async (code: string) => {
    if (code.length !== OTP_LENGTH || verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifyStatus('verifying');
    setVerifyError(null);
    try {
      await verifyOtp(email, code);
      // onAuthStateChange in useAuth fires SIGNED_IN automatically.
      setStep('success');
      setTimeout(() => onClose(), 1600);
    } catch (err: any) {
      verifyingRef.current = false;
      setVerifyStatus('error');
      setVerifyError(friendlyVerifyError(err));
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    }
  };

  // ── digit box handlers ───────────────────────────────────────────────────
  const onDigitChange = (idx: number, raw: string) => {
    // Strip non-digits; allow multi-char only when it came from paste
    // (the onPaste handler fires first for actual pastes, but
    // some Android IMEs still arrive here as onChange with multiple chars)
    const clean = raw.replace(/\D/g, '');

    if (clean.length > 1) {
      // Treat as paste
      const next = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < Math.min(clean.length, OTP_LENGTH); i++) {
        next[i] = clean[i];
      }
      setDigits(next);
      const focusIdx = Math.min(clean.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      if (clean.length >= OTP_LENGTH) handleVerify(clean.slice(0, OTP_LENGTH));
      return;
    }

    const next = [...digits];
    next[idx] = clean;
    setDigits(next);

    if (clean && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }

    const code = next.join('');
    if (code.length === OTP_LENGTH && next.every(Boolean)) {
      handleVerify(code);
    }
  };

  const onDigitKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0)             inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const onDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === OTP_LENGTH) handleVerify(pasted);
  };

  // ── render ───────────────────────────────────────────────────────────────
  const cardStyle = {
    background:    'var(--surface-elevated)',
    borderColor:   'var(--surface-glass-border)',
    color:         'var(--text-strong)',
    backdropFilter:'blur(20px)',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={step !== 'success' ? onClose : undefined}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1,   opacity: 1, y: 0 }}
            exit={{   scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-6 overflow-hidden"
            style={cardStyle}
          >
            <AnimatePresence mode="wait" initial={false}>

              {/* ── STEP 1: email ─────────────────────────────────────── */}
              {step === 'email' && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{   opacity: 0, x:  16 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
                    <button
                      onClick={onClose}
                      className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center"
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                    Enter your email and we'll send a 6-digit sign-in code.
                  </p>

                  <form onSubmit={handleEmailSubmit} className="space-y-3">
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <Input
                        type="email"
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 h-11"
                      />
                    </div>

                    {sendError && (
                      <p className="text-xs text-red-400 px-1">{sendError}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={sendStatus === 'sending'}
                      className="w-full h-11 text-white"
                      style={{ background: 'var(--hero-cta-gradient)' }}
                    >
                      {sendStatus === 'sending'
                        ? <><Loader2 className="size-4 animate-spin mr-2" />Sending…</>
                        : <><Mail className="size-4 mr-2" />Send code</>
                      }
                    </Button>

                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                      By signing in, you agree to keep making cool things.
                    </p>
                  </form>
                </motion.div>
              )}

              {/* ── STEP 2: OTP entry ─────────────────────────────────── */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{   opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <button
                      onClick={goBackToEmail}
                      className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center shrink-0"
                      aria-label="Back"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    <h2 className="text-xl font-semibold tracking-tight">Check your inbox</h2>
                    <button
                      onClick={onClose}
                      className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center ml-auto shrink-0"
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <p className="text-sm mb-6 pl-9" style={{ color: 'var(--text-muted)' }}>
                    We sent a 6-digit code to{' '}
                    <strong style={{ color: 'var(--text-strong)' }}>{email}</strong>.
                  </p>

                  {/* 6 digit boxes */}
                  <div className="flex gap-2 justify-center mb-3" role="group" aria-label="One-time code">
                    {digits.map((d, i) => (
                      <DigitBox
                        key={i}
                        idx={i}
                        value={d}
                        disabled={verifyStatus === 'verifying'}
                        inputRef={(el) => { inputRefs.current[i] = el; }}
                        onChange={onDigitChange}
                        onKeyDown={onDigitKeyDown}
                        onPaste={onDigitPaste}
                      />
                    ))}
                  </div>

                  {/* Verify status feedback */}
                  <div className="min-h-[22px] flex items-center justify-center mb-2">
                    <AnimatePresence mode="wait">
                      {verifyStatus === 'verifying' && (
                        <motion.div
                          key="verifying"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-sm"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Loader2 className="size-3.5 animate-spin" />
                          Verifying…
                        </motion.div>
                      )}
                      {verifyStatus === 'error' && verifyError && (
                        <motion.p
                          key="error"
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="text-xs text-red-400 text-center px-2"
                        >
                          {verifyError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Resend + change email row */}
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <button
                      onClick={handleResend}
                      disabled={cooldown > 0 || sendStatus === 'sending'}
                      className="flex items-center gap-1.5 text-xs transition-opacity disabled:opacity-40"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {sendStatus === 'sending'
                        ? <Loader2 className="size-3 animate-spin" />
                        : <RotateCcw className="size-3" />
                      }
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>

                    <span className="text-xs" style={{ color: 'var(--surface-glass-border)' }}>·</span>

                    <button
                      onClick={goBackToEmail}
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Use different email
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: success ───────────────────────────────────── */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.08 }}
                    className="flex justify-center mb-4"
                  >
                    <div
                      className="size-16 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(16,185,129,0.12)' }}
                    >
                      <CheckCircle className="size-8 text-emerald-500" />
                    </div>
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="text-xl font-semibold tracking-tight mb-1"
                  >
                    You're in!
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.26 }}
                    className="text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Your projects are now syncing.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-1.5 mt-4 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    Secured with Supabase Auth
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
