import { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, Star, Clock, Archive, FolderKanban } from 'lucide-react';
import { Conversation, Project } from '@/lib/types';
import { useConversationFlags } from '@/hooks/useConversationFlags';

interface ConversationFoldersProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  projects?: Project[];
  assignments?: Record<string, string>;
}

export function ConversationFolders({
  conversations,
  activeConversationId,
  onSelectConversation,
  projects = [],
  assignments = {},
}: ConversationFoldersProps) {
  const [openFolder, setOpenFolder] = useState<string | null>('recent');
  const { isStarred, isArchived } = useConversationFlags();

  const baseFolders = [
    {
      id: 'recent',
      label: 'Recent',
      icon: Clock,
      filter: (c: Conversation) => {
        const dayMs = 7 * 24 * 60 * 60 * 1000;
        return !isArchived(c.id) && new Date(c.updatedAt).getTime() > Date.now() - dayMs;
      },
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: Star,
      filter: (c: Conversation) => isStarred(c.id) && !isArchived(c.id),
    },
    {
      id: 'archived',
      label: 'Archived',
      icon: Archive,
      filter: (c: Conversation) => isArchived(c.id),
    },
  ];

  const projectFolders = projects.map((p) => ({
    id: `project_${p.id}`,
    label: p.name,
    icon: FolderKanban,
    filter: (c: Conversation) =>
      !isArchived(c.id) && (assignments[c.id] === p.id || c.projectId === p.id),
  }));

  const FOLDERS = [...baseFolders, ...projectFolders];

  return (
    <div className="space-y-0.5">
      {FOLDERS.map((folder) => {
        const isOpen = openFolder === folder.id;
        const items = conversations.filter(folder.filter);
        const FolderIcon = folder.icon === FolderKanban ? FolderKanban : isOpen ? FolderOpen : Folder;

        return (
          <div key={folder.id}>
            <button
              onClick={() => setOpenFolder(isOpen ? null : folder.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <FolderIcon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left truncate">{folder.label}</span>
              {items.length > 0 && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
              )}
            </button>

            {isOpen && items.length > 0 && (
              <div className="ml-6 space-y-0.5 mt-0.5">
                {items.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate
                      ${conv.id === activeConversationId
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                      }`}
                  >
                    {conv.title}
                  </button>
                ))}
              </div>
            )}

            {isOpen && items.length === 0 && (
              <p className="ml-9 text-[10px] text-muted-foreground py-1">No conversations</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
