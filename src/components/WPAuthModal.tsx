import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, X } from 'lucide-react';
import { loginUserWP, registerUserWP } from '@/lib/wp-api';

interface WPAuthModalProps {
  blocking?: boolean;
  onClose?: () => void;
}

export function WPAuthModal({ blocking = true, onClose }: WPAuthModalProps) {
  const [step, setStep] = useState<'choose' | 'login' | 'signup'>('choose');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshAfterAuth = () => window.location.reload();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await loginUserWP({ login, password });
      toast.success('Welcome back!');
      refreshAfterAuth();
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await registerUserWP({ username, email, password, display_name: displayName });
      toast.success('Account created!');
      refreshAfterAuth();
    } catch (error: any) {
      const msg = String(error?.message || 'Registration failed');
      if (/disabled/i.test(msg)) {
        toast.error('Account signups are currently turned off by the site admin.');
      } else {
        toast.error(msg);
      }

      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/20 backdrop-blur-[2px]">
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-7 space-y-5 shadow-2xl" style={{ animation: 'fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
        {!blocking && onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">{step === 'signup' ? 'Create your account' : 'Log in to Versace22.ai'}</h1>
          <p className="text-xs text-muted-foreground">Use your website account to access your assigned personas.</p>
        </div>

        {step === 'choose' && (
          <div className="space-y-3">
            <button onClick={() => setStep('login')} className="w-full flex items-center justify-center gap-3 py-2.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground">
              <Mail className="w-4 h-4" />
              Continue with website account
            </button>
            <button onClick={() => setStep('signup')} className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
              Sign up for free
            </button>
          </div>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="text" autoFocus placeholder="Username or email" value={login} onChange={(e) => setLogin(e.target.value)} required className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50">{loading ? 'Signing in...' : 'Continue'}</button>
            <button type="button" onClick={() => setStep('choose')} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-3">
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <input type="text" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <input type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50">{loading ? 'Creating...' : 'Create account'}</button>
            <button type="button" onClick={() => setStep('choose')} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
          </form>
        )}
      </div>
    </div>
  );
}