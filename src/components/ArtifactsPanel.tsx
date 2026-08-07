import { useCallback, useEffect, useState } from 'react';
import { X, FileBox, Save, Trash2, RefreshCw, Eye, Code2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listArtifactsWP,
  getArtifactWP,
  saveArtifactWP,
  deleteArtifactWP,
  type WPArtifact,
} from '@/lib/wp-api';
import { MarkdownMessage } from './MarkdownMessage';

interface Props {
  conversationId: string | null;
  open: boolean;
  onClose: () => void;
  /** bump this number to force a refresh (e.g. after a reply produced artifacts) */
  refreshKey?: number;
  openArtifactId?: number | null;
}

type Tab = 'preview' | 'code';

export function ArtifactsPanel({ conversationId, open, onClose, refreshKey, openArtifactId }: Props) {
  const [items, setItems] = useState<WPArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<WPArtifact | null>(null);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<Tab>('preview');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setItems(await listArtifactsWP(conversationId));
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load, refreshKey]);

  const openItem = useCallback(async (id: number | string) => {
    const full = await getArtifactWP(id);
    if (!full) {
      toast.error('Artifact could not be loaded');
      return;
    }
    setActive(full);
    setDraft(full.content || '');
    setTab('preview');
  }, []);

  useEffect(() => {
    if (open && openArtifactId) openItem(openArtifactId);
  }, [open, openArtifactId, openItem]);

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    const id = await saveArtifactWP({
      id: active.id,
      conversationId,
      title: active.title,
      type: active.artifact_type,
      content: draft,
    });
    setSaving(false);
    if (id) {
      toast.success('Artifact saved');
      load();
    } else {
      toast.error('Could not save artifact');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this artifact?')) return;
    const ok = await deleteArtifactWP(id);
    if (ok) {
      toast.success('Artifact deleted');
      if (active?.id === id) setActive(null);
      load();
    } else {
      toast.error('Could not delete artifact');
    }
  };

  if (!open) return null;

  const type = (active?.artifact_type || '').toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="w-full sm:w-[460px] h-full bg-card border-l border-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <FileBox className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground flex-1">Artifacts</h2>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </header>

        {!active ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-10">
                No artifacts saved for this chat yet.
              </p>
            )}
            {items.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-background"
              >
                <button onClick={() => openItem(a.id)} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.artifact_type} · v{a.version ?? 1} · {a.updated_at || ''}
                  </p>
                </button>
                <button
                  onClick={() => handleDelete(Number(a.id))}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <button
                onClick={() => setActive(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <span className="text-xs font-medium text-foreground truncate flex-1">{active.title}</span>
              <button
                onClick={() => setTab('preview')}
                className={`p-1.5 rounded-lg ${tab === 'preview' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                title="Preview"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTab('code')}
                className={`p-1.5 rounded-lg ${tab === 'code' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                title="Edit code"
              >
                <Code2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {tab === 'preview' ? (
                type === 'html' || type === 'svg' ? (
                  <iframe
                    title={active.title}
                    srcDoc={draft}
                    sandbox=""
                    className="w-full h-[70vh] rounded-lg border border-border bg-white"
                  />
                ) : type === 'markdown' ? (
                  <MarkdownMessage content={draft} />
                ) : (
                  <pre className="text-xs whitespace-pre-wrap break-words text-foreground">{draft}</pre>
                )
              ) : (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  className="w-full h-[70vh] rounded-lg border border-border bg-background p-3 text-xs font-mono text-foreground outline-none focus:border-primary"
                />
              )}
            </div>

            <footer className="flex items-center gap-2 px-3 py-3 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => handleDelete(Number(active.id))}
                className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
