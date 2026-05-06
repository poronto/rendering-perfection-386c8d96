import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, X, Phone } from 'lucide-react';

interface AuthModalProps {
  /** When true, modal blocks the chat (no close button). When false, user can dismiss. */
  blocking?: boolean;
  onClose?: () => void;
}

export function AuthModal({ blocking = true, onClose }: AuthModalProps) {
  const [step, setStep] = useState<'choose' | 'email' | 'password' | 'signup' | 'forgot'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  const handleContinueEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStep('password');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      toast.success('Account created! You can now sign in.');
      setStep('password');
    } catch (err: any) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent!');
      setStep('choose');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
      <div
        className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-7 space-y-5 shadow-2xl"
        style={{ animation: 'fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {!blocking && onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            {step === 'signup' ? 'Create your account' : step === 'forgot' ? 'Reset password' : 'Log in or sign up'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {step === 'choose' && "You'll get smarter responses and can upload files, images, and more."}
            {step === 'email' && 'Enter your email to continue.'}
            {step === 'password' && `Welcome back, ${email}`}
            {step === 'signup' && 'Just a few details to get started.'}
            {step === 'forgot' && 'Enter your email to receive reset instructions.'}
          </p>
        </div>

        {step === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => setStep('email')}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground"
            >
              <Mail className="w-4 h-4" />
              Continue with email
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-[11px] text-muted-foreground uppercase tracking-wider">or</span>
              </div>
            </div>

            <button
              onClick={() => setStep('signup')}
              className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Sign up for free
            </button>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleContinueEmail} className="space-y-3">
            <input
              type="email"
              autoFocus
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="password"
              autoFocus
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setStep('forgot')} className="text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </button>
              <button type="button" onClick={() => setStep('choose')} className="text-muted-foreground hover:text-foreground transition-colors">
                ← Back
              </button>
            </div>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password (min 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create account'}
            </button>
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {step === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-3">
            <input
              type="email"
              autoFocus
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
          By continuing, you agree to VERSACE22 ai's Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
