import { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Sparkles,
  HelpCircle,
  LogOut,
  Keyboard,
  Palette,
  Download,
  Crown,
  FileText,
  Bell,
} from 'lucide-react';
import { SettingsModal, SettingsTab } from './SettingsModal';

interface UserAccountMenuProps {
  open: boolean;
  onClose: () => void;
  onSignOut?: () => void;
  userName: string;
  userEmail?: string;
  avatarUrl?: string;
  userInitial: string;
}

export function UserAccountMenu({
  open,
  onClose,
  onSignOut,
  userName,
  userEmail,
  avatarUrl,
  userInitial,
}: UserAccountMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const openSettings = (tab: SettingsTab) => {
    setSettingsTab(tab);
    onClose();
  };

  const exportAllData = () => {
    try {
      const data = {
        starred: localStorage.getItem('versace22_starred_conversations'),
        archived: localStorage.getItem('versace22_archived_conversations'),
        customInstructions: localStorage.getItem('versace22_custom_instructions'),
        settings: localStorage.getItem('versace22_settings'),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `versace22-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  return (
    <>
      {open && (
        <div
          ref={ref}
          className="absolute bottom-full left-3 right-3 mb-2 z-50 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {/* Account header */}
          <div className="flex items-center gap-3 px-3 py-3 border-b border-border">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                {userInitial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-popover-foreground truncate">{userName}</div>
              {userEmail && (
                <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
              )}
            </div>
          </div>

          {/* Upgrade banner */}
          <button
            onClick={() => openSettings('plan')}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left border-b border-border"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-popover-foreground">Upgrade plan</div>
              <div className="text-xs text-muted-foreground">More access to top models</div>
            </div>
          </button>

          {/* Menu items */}
          <div className="py-1">
            <MenuItem icon={Sparkles} label="Customize Versace22" onClick={() => openSettings('customize')} />
            <MenuItem icon={FileText} label="Custom instructions" onClick={() => openSettings('instructions')} />
            <MenuItem icon={Settings} label="Settings" onClick={() => openSettings('general')} />
            <MenuItem icon={Palette} label="Appearance" onClick={() => openSettings('appearance')} />
            <MenuItem icon={Bell} label="Notifications" onClick={() => openSettings('notifications')} />
            <MenuItem icon={Keyboard} label="Keyboard shortcuts" onClick={() => openSettings('shortcuts')} />
            <MenuItem icon={Download} label="Export data" onClick={exportAllData} />
            <MenuItem icon={HelpCircle} label="Help & FAQ" onClick={() => openSettings('help')} />
          </div>

          {onSignOut && (
            <div className="border-t border-border py-1">
              <MenuItem
                icon={LogOut}
                label="Log out"
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
              />
            </div>
          )}
        </div>
      )}

      {settingsTab && (
        <SettingsModal
          initialTab={settingsTab}
          onClose={() => setSettingsTab(null)}
          userName={userName}
          userEmail={userEmail}
          onSignOut={onSignOut}
        />
      )}
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors text-left"
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1">{label}</span>
    </button>
  );
}
