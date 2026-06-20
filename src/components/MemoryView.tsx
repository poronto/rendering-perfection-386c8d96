import { useState } from 'react';
import { ArrowLeft, Brain, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMemory } from '@/hooks/useMemory';

interface MemoryViewProps {
  onBackToChat: () => void;
}

export function MemoryView({ onBackToChat }: MemoryViewProps) {
  const { memories, enabled, setEnabled, addMemory, deleteMemory, clearAll, loading } = useMemory();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (draft.length > 500) {
      toast.error('Each memory must be under 500 characters');
      return;
    }
    setSaving(true);
    try {
      const added = await addMemory(draft);
      if (added) {
        toast.success('Memory saved');
        setDraft('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save memory');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteMemory(id);
    if (ok) toast.success('Memory removed');
  };

  const handleClear = async () => {
    if (!confirm('Clear all memories? This cannot be undone.')) return;
    const ok = await clearAll();
    if (ok) toast.success('All memories cleared');
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
          <Brain className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Memory</h2>
          <p className="text-sm text-muted-foreground">
            Saved facts get added to every conversation so the AI remembers you.
          </p>
        </div>

        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Memory enabled</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? 'Facts are added to your chats' : 'Saved facts are paused'}
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              enabled ? 'bg-primary' : 'bg-muted'
            }`}
            aria-pressed={enabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${
                enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <form onSubmit={handleAdd} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <textarea
            placeholder="Add a fact, preference, or context to remember..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{draft.length}/500</span>
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Saved ({memories.length})
            </span>
            {memories.length > 0 && (
              <button
                onClick={handleClear}
                className="text-[11px] text-destructive hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          {loading && <p className="text-sm text-muted-foreground text-center">Loading...</p>}
          {!loading && memories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">No memories yet.</p>
          )}
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border"
            >
              <p className="flex-1 text-sm text-foreground">{m.content}</p>
              <button
                onClick={() => handleDelete(m.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete memory"
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
