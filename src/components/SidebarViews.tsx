import { useState } from 'react';
import { Trophy, User, Gift, ArrowLeft, Save, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ViewProps {
  onBackToChat: () => void;
}

export function LeaderboardView({ onBackToChat }: ViewProps) {
  const { profile } = useAuth();
  const displayName = profile?.display_name || 'You';

  const leaders = [
    { rank: 1, name: 'Alex M.', score: 2840, badge: '🥇' },
    { rank: 2, name: 'Sarah K.', score: 2510, badge: '🥈' },
    { rank: 3, name: 'James L.', score: 2200, badge: '🥉' },
    { rank: 4, name: 'Mia R.', score: 1980 },
    { rank: 5, name: displayName, score: 450, highlight: true },
  ];

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <BackButton onClick={onBackToChat} />
      <div className="w-full max-w-md space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <Trophy className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Leaderboard</h2>
          <p className="text-sm text-muted-foreground">Top community members this month</p>
          <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary">BETA</span>
        </div>
        <div className="space-y-2">
          {leaders.map((l) => (
            <div
              key={l.rank}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                l.highlight
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-card border-border'
              }`}
            >
              <span className="text-lg font-bold w-8 text-center">{l.badge || `#${l.rank}`}</span>
              <span className="flex-1 font-medium text-foreground">{l.name}</span>
              <span className="text-sm font-semibold text-muted-foreground">{l.score.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground">Earn points by chatting and referring friends</p>
      </div>
    </div>
  );
}

export function ProfileView({ onBackToChat }: ViewProps) {
  const { user, profile } = useAuth();
  const { conversations } = useConversations();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const totalConversations = conversations.length;

  const handleSave = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName.trim() })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated!');
      // Refresh the page to pick up new profile data
      window.location.reload();
    }
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <BackButton onClick={onBackToChat} />
      <div className="w-full max-w-md space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-primary mx-auto flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Your Profile</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Display Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-card border-border"
                placeholder="Enter your name"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setNewName(profile?.display_name || ''); }}
                className="px-4 py-3 rounded-xl bg-muted text-muted-foreground font-semibold hover:bg-muted/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <ProfileField label="Display Name" value={displayName} />
              <ProfileField label="Email" value={user?.email || '—'} />
              <ProfileField label="Conversations" value={String(totalConversations)} />
              <ProfileField label="Member Since" value={memberSince} />
            </div>
            <button
              onClick={() => { setEditing(true); setNewName(profile?.display_name || displayName); }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Edit Profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card rounded-xl border border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground truncate ml-4 max-w-[200px]">{value}</span>
    </div>
  );
}

export function ReferView({ onBackToChat }: ViewProps) {
  const { user } = useAuth();
  const referralCode = 'VERSACE-' + (user?.id?.substring(0, 6).toUpperCase() || 'GUEST');

  const handleCopy = () => {
    navigator.clipboard?.writeText(referralCode);
    toast.success('Referral code copied!');
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <BackButton onClick={onBackToChat} />
      <div className="w-full max-w-md space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <Gift className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Refer & Earn</h2>
          <p className="text-sm text-muted-foreground">Share with friends and earn rewards for every signup</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 text-center space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Your Referral Code</p>
          <p className="text-xl font-bold text-primary tracking-widest">{referralCode}</p>
          <button
            onClick={handleCopy}
            className="px-5 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            Copy Code
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <RewardStat label="Referred" value="0" />
          <RewardStat label="Earned" value="0 pts" />
          <RewardStat label="Reward" value="50 pts" subtitle="per invite" />
        </div>

        <button
          onClick={() => {
            const url = `https://wa.me/?text=Join%20me%20on%20Versace22%20AI!%20Use%20code%20${referralCode}`;
            window.open(url, '_blank');
          }}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Share via WhatsApp
        </button>
      </div>
    </div>
  );
}

function RewardStat({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="self-start flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Chat
    </button>
  );
}
