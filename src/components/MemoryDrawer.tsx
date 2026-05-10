import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Power } from 'lucide-react';
import {
  WPMemory, getMemoriesWP, addMemoryWP, updateMemoryWP, deleteMemoryWP, toggleMemoryWP,
  getWPUserId, getWPPersonaId, isWPAdmin,
} from '@/lib/wp-api';
import { toast } from 'sonner';

interface MemoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Admin-only memory manager (v12.3 plugin feature).
 * Memory CRUD endpoints require `manage_options` + the admin nonce.
 */
export function MemoryDrawer({ open, onClose }: MemoryDrawerProps) {
  const [memories, setMemories] = useState<WPMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const userId = getWPUserId();

  const refresh = async () => {
    if (!isWPAdmin() || !userId) return;
    setLoading(true);
    try {
      setMemories(await getMemoriesWP(userId));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load memories');
    }
    setLoading(false);
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open]);

  if (!open) return null;
  if (!isWPAdmin()) {
    return (
      <aside className="fixed top-0 right-0 z-50 h-dvh w-full sm:w-[400px] bg-background border-l border-border flex flex-col shadow-2xl">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Memories</h3>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </header>
        <div className="p-6 text-sm text-muted-foreground">
          Memory management is available to administrators only. Ask the site admin to manage your persistent memories from the WordPress dashboard.
        </div>
      </aside>
    );
  }

  const add = async () => {
    const t = draft.trim();
    if (!t) return;
    try {
      await addMemoryWP(userId, getWPPersonaId(), t);
      setDraft('');
      refresh();
      toast.success('Memory saved');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <aside className="fixed top-0 right-0 z-50 h-dvh w-full sm:w-[400px] bg-background border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">🧠 Memories</h3>
        <button onClick={onClose} className="p-2 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
      </header>

      <div className="p-3 border-b border-border shrink-0 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. The user prefers concise answers in Turkish."
          rows={3}
          className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary/40"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add memory
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && memories.length === 0 && (
          <p className="text-xs text-muted-foreground">No memories yet. Add one above.</p>
        )}
        {memories.map(m => (
          <div key={m.id} className={`rounded-md border border-border p-2.5 text-sm ${m.enabled ? '' : 'opacity-50'}`}>
            <textarea
              defaultValue={m.memory_text}
              onBlur={async (e) => {
                if (e.target.value !== m.memory_text) {
                  try { await updateMemoryWP(m.id, e.target.value); refresh(); }
                  catch (err: any) { toast.error(err.message); }
                }
              }}
              rows={2}
              className="w-full bg-transparent text-sm focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-1 mt-1">
              <button
                onClick={async () => { await toggleMemoryWP(m.id); refresh(); }}
                title="Toggle"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={async () => { await deleteMemoryWP(m.id); refresh(); toast.success('Deleted'); }}
                title="Delete"
                className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
