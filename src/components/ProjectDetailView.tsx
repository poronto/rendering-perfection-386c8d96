import { useState } from 'react';
import { ArrowLeft, FolderKanban, MessageSquarePlus, Settings2, Trash2, MessageCircle, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, Project } from '@/lib/types';

interface ProjectDetailViewProps {
  project: Project;
  conversations: Conversation[];
  activeConversationId: string | null;
  onBack: () => void;
  onNewChatInProject: () => void;
  onSelectConversation: (id: string) => void;
  onRemoveFromProject: (conversationId: string) => void;
  onUpdateProject: (data: { name?: string; description?: string; customInstructions?: string }) => Promise<unknown>;
  onDeleteProject: () => void;
}

export function ProjectDetailView({
  project,
  conversations,
  activeConversationId,
  onBack,
  onNewChatInProject,
  onSelectConversation,
  onRemoveFromProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectDetailViewProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [instructions, setInstructions] = useState(project.customInstructions || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await onUpdateProject({ name, description, customInstructions: instructions });
      toast.success('Project updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 -ml-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All projects
        </button>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <FolderKanban className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Project settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDeleteProject}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onNewChatInProject}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New chat in this project
        </button>

        {/* Instructions */}
        <section className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Project instructions</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-primary hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Project name"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              />
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="How should the AI behave in every chat inside this project?"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setName(project.name);
                    setDescription(project.description || '');
                    setInstructions(project.customInstructions || '');
                    setEditing(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {project.customInstructions || 'No instructions yet. Every chat in this project will use them automatically.'}
            </p>
          )}
        </section>

        {/* Chats in project */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            Chats in this project{conversations.length > 0 ? ` (${conversations.length})` : ''}
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No chats yet — start one above and it stays inside this project.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  c.id === activeConversationId
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card border-border hover:bg-muted/50'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                <button
                  onClick={() => onSelectConversation(c.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm text-foreground truncate">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleString()}
                  </p>
                </button>
                <button
                  onClick={() => onRemoveFromProject(c.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove from project"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
