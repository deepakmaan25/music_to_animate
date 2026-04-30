import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Loader2, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../hooks/useAuth';

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setError(null);
    try {
      await signInWithEmail(email);
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Failed to send magic link');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-6"
            style={{
              background: 'var(--surface-elevated)',
              borderColor: 'var(--surface-glass-border)',
              color: 'var(--text-strong)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
              <button onClick={onClose} className="size-8 rounded-md hover:bg-black/5 flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Sync your projects across devices. We'll send a magic link to your inbox.
            </p>

            {status === 'sent' ? (
              <div className="rounded-lg border p-4 flex items-start gap-3" style={{ borderColor: 'var(--surface-glass-border)', background: 'var(--surface-glass)' }}>
                <Check className="size-5 text-emerald-500 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">Check your inbox</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    We sent a sign-in link to <strong>{email}</strong>.
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--text-muted)' }} />
                  <Input
                    type="email" required placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11"
                  />
                </div>
                {error && <div className="text-xs text-red-500">{error}</div>}
                <Button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full h-11 text-white"
                  style={{ background: 'var(--hero-cta-gradient)' }}
                >
                  {status === 'sending' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Mail className="size-4 mr-2" />}
                  Send magic link
                </Button>
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  By signing in, you agree to keep making cool things.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
