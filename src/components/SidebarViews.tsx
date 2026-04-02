import { useState, useRef } from 'react';
import { Trophy, User, Gift, ArrowLeft, Save, X, Camera, Copy, Check, Share2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useWPConversations } from '@/hooks/useWPConversations';
import { isWordPress } from '@/lib/wp-api';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ViewProps {
  onBackToChat: () => void;
}

function useViewData() {
  const { profile, user } = useAuth();
  const wpMode = isWordPress();
  const supaConv = useConversations();
  const wpConv = useWPConversations();
  const conversations = wpMode ? wpConv.conversations : supaConv.conversations;
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  return { profile, user, conversations, displayName, wpMode };
}

export function LeaderboardView({ onBackToChat }: ViewProps) {
  const { conversations, displayName } = useViewData();

  const userScore = conversations.length * 10;

  const leaders = [
    { rank: 1, name: 'Alex M.', score: 2840, badge: '🥇' },
    { rank: 2, name: 'Sarah K.', score: 2510, badge: '🥈' },
    { rank: 3, name: 'James L.', score: 2200, badge: '🥉' },
    { rank: 4, name: 'Mia R.', score: 1980 },
    { rank: 5, name: displayName, score: userScore, highlight: true },
  ];

  const sorted = [...leaders].sort((a, b) => b.score - a.score).map((l, i) => ({
    ...l,
    rank: i + 1,
    badge: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : undefined,
  }));

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <BackButton onClick={onBackToChat} />
      <div className="w-full max-w-md space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <Trophy className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Leaderboard</h2>
          <p className="text-sm text-muted-foreground">Top community members this month</p>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Your Activity</p>
          <p className="text-2xl font-bold text-primary">{userScore} pts</p>
          <p className="text-xs text-muted-foreground">{conversations.length} conversations · {conversations.length * 10} points earned</p>
        </div>

        <div className="space-y-2">
          {sorted.map((l) => (
            <div
              key={l.name}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                l.highlight
                  ? 'bg-primary/10 border-primary/30 text-primary scale-[1.02]'
                  : 'bg-card border-border hover:border-border/80'
              }`}
            >
              <span className="text-lg font-bold w-8 text-center">{l.badge || `#${l.rank}`}</span>
              <span className="flex-1 font-medium text-foreground">{l.name} {l.highlight && '(you)'}</span>
              <span className="text-sm font-semibold text-muted-foreground">{l.score.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground">Earn 10 points per conversation · 50 points per referral</p>
      </div>
    </div>
  );
}

export function ProfileView({ onBackToChat }: ViewProps) {
  const { user, profile, conversations, displayName, wpMode } = useViewData();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const totalConversations = conversations.length;
  const totalPoints = totalConversations * 10;

  const handleSave = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);

    if (wpMode) {
      // In WP mode, profile editing isn't available server-side yet
      toast.info('Profile editing is managed through your WordPress account settings.');
      setSaving(false);
      setEditing(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName.trim() })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated!');
      window.location.reload();
    }
    setSaving(false);
    setEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    if (wpMode) {
      toast.info('Avatar management is handled through your WordPress profile.');
      return;
    }

    setAvatarUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload avatar');
      setAvatarUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error('Failed to save avatar');
    } else {
      toast.success('Avatar updated!');
      window.location.reload();
    }
    setAvatarUploading(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <BackButton onClick={onBackToChat} />
      <div className="w-full max-w-md space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-3">
          <div className="relative w-20 h-20 mx-auto group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
              </div>
            )}
            {!wpMode && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <Camera className="w-5 h-5 text-foreground" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Your Profile</h2>
          <p className="text-sm text-muted-foreground">{user?.email || displayName}</p>
          {avatarUploading && <p className="text-xs text-primary animate-pulse">Uploading avatar...</p>}
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
              {user?.email && <ProfileField label="Email" value={user.email} />}
              <ProfileField label="Conversations" value={String(totalConversations)} />
              <ProfileField label="Points Earned" value={`${totalPoints} pts`} />
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
  const { user, conversations } = useViewData();
  const [copied, setCopied] = useState(false);

  const referralCode = 'VERSACE-' + (user?.id?.substring(0, 6).toUpperCase() || 'GUEST');
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on VERSACE22 AI',
          text: `Chat with AI personas! Use my referral code: ${referralCode}`,
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy(referralLink);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <BackButton onClick={onBackToChat} />
      <div className="w-full max-w-md space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <Gift className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Refer & Earn</h2>
          <p className="text-sm text-muted-foreground">Share with friends and earn 50 points for every signup</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 text-center space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Your Referral Code</p>
          <p className="text-xl font-bold text-primary tracking-widest">{referralCode}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleCopy(referralCode)}
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={handleShare}
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <RewardStat label="Referred" value="0" />
          <RewardStat label="Earned" value={`${conversations.length * 10} pts`} />
          <RewardStat label="Reward" value="50 pts" subtitle="per invite" />
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              const url = `https://wa.me/?text=${encodeURIComponent(`Join me on VERSACE22 AI! Use code ${referralCode}: ${referralLink}`)}`;
              window.open(url, '_blank');
            }}
            className="w-full py-3 rounded-xl bg-[hsl(142,70%,35%)] text-primary-foreground font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            💬 Share via WhatsApp
          </button>
          <button
            onClick={() => {
              const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Chat with AI personas on VERSACE22 AI! Use code ${referralCode}`)}&url=${encodeURIComponent(referralLink)}`;
              window.open(url, '_blank');
            }}
            className="w-full py-3 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            𝕏 Share on Twitter
          </button>
        </div>
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
