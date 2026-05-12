import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Trophy, User, Gift, Globe, ChevronDown, Search, Plus, X, LogOut, Sun, Moon, Sparkles, MoreVertical, Star, Archive, Trash2, Brain } from 'lucide-react';
import { ProjectsSection } from './ProjectsSection';
import { isWordPress, isWPAdmin } from '@/lib/wp-api';
import { Conversation, Persona } from '@/lib/types';
import { ConversationFolders } from './ConversationFolders';
import { useTheme } from '@/hooks/useTheme';
import { useConversationFlags } from '@/hooks/useConversationFlags';

export type SidebarView = 'chat' | 'leaderboard' | 'profile' | 'refer' | 'personas';

interface ChatSidebarProps {
  conversations: Conversation[];
  personas: Persona[];
  activeConversationId: string | null;
  activeView: SidebarView;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onViewChange: (view: SidebarView) => void;
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userInitial?: string;
  avatarUrl?: string;
  onSignOut?: () => void;
  onOpenMemories?: () => void;
}

const navItems = [
  { icon: MessageCircle, label: 'Chat', action: 'chat' },
  { icon: Sparkles, label: 'Personas', action: 'personas' },
  { icon: Trophy, label: 'Leaderboard', badge: 'BETA', action: 'leaderboard' },
  { icon: User, label: 'Profile', action: 'profile' },
  { icon: Gift, label: 'Refer for rewards', action: 'refer' },
  { icon: Globe, label: 'Contact us', expandable: true, action: 'findus' },
];

export function ChatSidebar({
  conversations,
  activeConversationId,
  activeView,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onViewChange,
  isOpen,
  onClose,
  userName = 'User',
  userInitial = 'U',
  avatarUrl,
  onSignOut,
  onOpenMemories,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [findUsOpen, setFindUsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { toggleStar, toggleArchive, isStarred, isArchived } = useConversationFlags();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  // Active conversations: not archived, matches search
  const visible = conversations.filter(
    (c) => !isArchived(c.id) && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNavClick = (action: string) => {
    if (action === 'findus') {
      setFindUsOpen((prev) => !prev);
      return;
    }
    onViewChange(action as SidebarView);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[280px]
          bg-sidebar border-r border-sidebar-border
          flex flex-col
          transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-end px-5 pt-5 pb-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors lg:hidden"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <nav className="px-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.action)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${activeView === item.action
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }
              `}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                  {item.badge}
                </span>
              )}
              {item.expandable && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${findUsOpen ? 'rotate-180' : ''}`} />}
            </button>
          ))}
          {findUsOpen && (
            <div className="pl-10 space-y-1 py-1">
              <a href="https://wa.me/12262272288" target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 text-sm text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors">💬 WhatsApp</a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 text-sm text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors">Twitter</a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 text-sm text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors">Discord</a>
            </div>
          )}
        </nav>

        {/* Projects (admin-only, top of sidebar above conversations) */}
        <ProjectsSection />

        {/* Search */}
        <div className="px-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-sidebar-accent rounded-lg
                         text-foreground placeholder:text-muted-foreground
                         border border-transparent focus:border-primary/30 focus:outline-none
                         transition-colors"
            />
          </div>
        </div>

        {/* Conversation Folders */}
        <div className="px-3 mt-3">
          <ConversationFolders
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
          />
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-3 mt-2 space-y-1">
          <div className="flex items-center gap-1">
            <button
              onClick={onNewConversation}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                         text-primary hover:bg-primary/10 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>
            {isWordPress() && isWPAdmin() && onOpenMemories && (
              <button
                onClick={onOpenMemories}
                title="Memories"
                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              >
                <Brain className="w-4 h-4" />
              </button>
            )}
          </div>

          {visible.map((conv) => {
            const starred = isStarred(conv.id);
            const isActive = conv.id === activeConversationId;
            const menuOpen = openMenuId === conv.id;

            return (
              <div key={conv.id} className="relative group">
                <div
                  className={`
                    flex items-center gap-1 pr-1 rounded-lg text-sm transition-all duration-150
                    ${isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }
                  `}
                >
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
                  >
                    {starred && <Star className="w-3 h-3 text-primary fill-primary shrink-0" />}
                    <span className="truncate flex-1">{conv.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(menuOpen ? null : conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded hover:bg-sidebar-accent transition-all"
                    title="More options"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>

                {menuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 z-50 w-44 bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1"
                  >
                    <button
                      onClick={() => {
                        toggleStar(conv.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Star className={`w-3.5 h-3.5 ${starred ? 'fill-primary text-primary' : ''}`} />
                      {starred ? 'Unstar' : 'Star'}
                    </button>
                    <button
                      onClick={() => {
                        toggleArchive(conv.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        onDeleteConversation(conv.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between px-3">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                {userInitial}
              </div>
            )}
            <span className="text-sm font-medium text-foreground flex-1 truncate">{userName}</span>
            {onSignOut && (
              <button onClick={onSignOut} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors" title="Sign out">
                <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
