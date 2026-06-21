import { useState } from 'react';
import { ArrowLeft, FolderPlus, Trash2, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useProjects';

interface ProjectsViewProps {
  onBackToChat: () => void;
}

export function ProjectsView({ onBackToChat }: ProjectsViewProps) {
  const { projects, createProject, deleteProject, loading } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }
    if (trimmedName.length > 80) {
      toast.error('Name must be under 80 characters');
      return;
    }
    setSaving(true);
    try {
      const p = await createProject({
        name: trimmedName,
        description: description.trim(),
        customInstructions: instructions.trim(),
      });
      if (p) {
        toast.success('Project created');
        setName('');
        setDescription('');
        setInstructions('');
        setShowForm(false);
      } else {
        toast.error('Failed to create project — server returned no project');
      }
    } catch (err: any) {
      // Surface the real server message (e.g. "Project name is required") instead of "error 400".
      const msg = err?.message ? String(err.message).replace(/^aicpp_user_create_project\s+error:\s*/i, '') : 'Failed to create project';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, projectName: string) => {
    if (!confirm(`Delete project "${projectName}"? Conversations stay but lose this assignment.`)) return;
    const ok = await deleteProject(id);
    if (ok) toast.success('Project deleted');
    else toast.error('Failed to delete project');
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <button
        onClick={onBackToChat}
        className="self-start flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Chat
      </button>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <FolderKanban className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Group conversations and give them custom instructions.
          </p>
        </div>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New project
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3 bg-card border border-border rounded-xl p-4">
            <input
              autoFocus
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            />
            <textarea
              placeholder="Custom instructions (optional) — added to every chat in this project"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground text-center">Loading...</p>}
          {!loading && projects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">No projects yet.</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border"
            >
              <FolderKanban className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
                {p.customInstructions && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic line-clamp-1">
                    Custom: {p.customInstructions}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(p.id, p.name)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
