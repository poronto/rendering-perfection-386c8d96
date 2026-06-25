import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MarkdownMessage } from './MarkdownMessage';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

export interface Artifact {
  id: string;
  type: string; // code | image | html | markdown | text | video | json
  title: string;
  language?: string;
  content: string;
}

/** Extract <artifact ...>...</artifact> blocks from an assistant message. */
export function parseArtifacts(content: string): { stripped: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = [];
  const re = /<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/gi;
  const stripped = content.replace(re, (_m, attrs: string, body: string) => {
    const get = (k: string) => {
      const m = attrs.match(new RegExp(`${k}\\s*=\\s*"([^"]*)"`, 'i'));
      return m ? m[1] : '';
    };
    const type = (get('type') || 'text').toLowerCase();
    const title = get('title') || `${type.charAt(0).toUpperCase()}${type.slice(1)} artifact`;
    const language = get('language') || get('lang') || '';
    artifacts.push({
      id: `art_${artifacts.length}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      language,
      content: body.trim(),
    });
    return '';
  }).trim();
  return { stripped, artifacts };
}

interface Props {
  artifact: Artifact | null;
  onClose: () => void;
}

export function ResultArtifactPanel({ artifact, onClose }: Props) {
  if (!artifact) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(artifact.content);
    toast.success('Copied');
  };

  const handleDownload = () => {
    const ext =
      artifact.type === 'image' ? 'png' :
      artifact.type === 'html' ? 'html' :
      artifact.type === 'json' ? 'json' :
      artifact.language || 'txt';
    const isDataUrl = artifact.type === 'image' && /^(data:|https?:)/.test(artifact.content);
    const a = document.createElement('a');
    if (isDataUrl) {
      a.href = artifact.content;
    } else {
      const blob = new Blob([artifact.content], { type: 'text/plain' });
      a.href = URL.createObjectURL(blob);
    }
    a.download = `${artifact.title.replace(/[^\w.-]+/g, '_')}.${ext}`;
    a.click();
  };

  const renderBody = () => {
    switch (artifact.type) {
      case 'image':
        return (
          <img
            src={artifact.content.trim()}
            alt={artifact.title}
            className="max-w-full rounded-md border border-border"
          />
        );
      case 'video':
        return (
          <video src={artifact.content.trim()} controls className="max-w-full rounded-md" />
        );
      case 'html':
        return (
          <iframe
            srcDoc={artifact.content}
            sandbox="allow-scripts"
            className="w-full h-[60vh] rounded-md border border-border bg-white"
            title={artifact.title}
          />
        );
      case 'code':
        return (
          <pre className="text-xs bg-muted/60 border border-border rounded-md p-3 overflow-auto max-h-[60vh]">
            <code>{artifact.content}</code>
          </pre>
        );
      case 'markdown':
        return <MarkdownMessage content={artifact.content} />;
      default:
        return (
          <pre className="text-sm whitespace-pre-wrap break-words bg-muted/40 border border-border rounded-md p-3 max-h-[60vh] overflow-auto">
            {artifact.content}
          </pre>
        );
    }
  };

  return (
    <Dialog open={!!artifact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{artifact.title}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {artifact.type}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {renderBody()}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
