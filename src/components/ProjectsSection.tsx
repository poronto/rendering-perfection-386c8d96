import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus, Folder, Trash2 } from 'lucide-react';
import {
  WPProject, getProjectsWP, createProjectWP, deleteProjectWP,
  isWordPress, isWPAdmin,
} from '@/lib/wp-api';
import { toast } from 'sonner';

/**
 * Sidebar section that lists Projects (v12.3 plugin feature).
 * Admin-only because the underlying CRUD endpoints require manage_options.
 */
export function ProjectsSection() {
  const [open, setOpen] = useState(true);
  const [projects, setProjects] = useState<WPProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isWordPress() || !isWPAdmin()) return null;

  const refresh = async () => {
    setLoading(true);
    try { setProjects(await getProjectsWP()); }
    catch (e: any) { toast.error(e.message || 'Failed to load projects'); }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      await createProjectWP(n);
      setName(''); setCreating(false);
      refresh();
      toast.success('Project created');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProjectWP(id);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="aicpp-projects-section px-3 mt-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Projects
        </button>
        <button
          onClick={() => setCreating(true)}
          title="New project"
          className="p-1 rounded hover:bg-sidebar-accent transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {open && (
        <div className="space-y-0.5">
          {creating && (
            <div className="flex items-center gap-1 mb-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setName(''); }
                }}
                placeholder="Project name"
                className="flex-1 px-2 py-1 text-xs bg-sidebar-accent rounded border border-primary/30 focus:outline-none focus:border-primary text-foreground"
              />
            </div>
          )}
          {loading && <p className="px-2 text-[11px] text-muted-foreground">Loading…</p>}
          {!loading && projects.length === 0 && !creating && (
            <p className="px-2 text-[11px] text-muted-foreground">No projects yet.</p>
          )}
          {projects.map(p => (
            <div
              key={p.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            >
              <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{p.name}</span>
              <button
                onClick={() => handleDelete(p.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-all"
                title="Delete project"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
