import { useState } from 'react';
import { X, Copy, Check, Download, Eye, Code2 } from 'lucide-react';
import { ParsedArtifact } from '@/lib/wp-api';
import { toast } from 'sonner';

interface ArtifactCanvasProps {
  artifact: ParsedArtifact | null;
  onClose: () => void;
}

export function ArtifactCanvas({ artifact, onClose }: ArtifactCanvasProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  if (!artifact) return null;

  const copy = () => {
    navigator.clipboard?.writeText(artifact.content);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const ext = ({ html: 'html', css: 'css', js: 'js', svg: 'svg', markdown: 'md', react: 'jsx', code: 'txt' } as any)[artifact.type] || 'txt';
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title || 'artifact'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderPreview = () => {
    switch (artifact.type) {
      case 'html':
        return (
          <iframe
            title={artifact.title}
            sandbox="allow-scripts"
            srcDoc={artifact.content}
            className="w-full h-full bg-white rounded-lg border border-border"
          />
        );
      case 'svg':
        return (
          <div className="w-full h-full overflow-auto p-4 bg-white rounded-lg" dangerouslySetInnerHTML={{ __html: artifact.content }} />
        );
      case 'markdown':
        return (
          <div className="w-full h-full overflow-auto p-4 prose prose-sm prose-invert max-w-none">
            <pre className="whitespace-pre-wrap">{artifact.content}</pre>
          </div>
        );
      default:
        return (
          <pre className="w-full h-full overflow-auto p-4 bg-muted/30 rounded-lg text-xs font-mono text-foreground whitespace-pre-wrap">
            {artifact.content}
          </pre>
        );
    }
  };

  return (
    <aside className="fixed top-0 right-0 z-50 h-dvh w-full sm:w-[480px] bg-background border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{artifact.title}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{artifact.type}</div>
        </div>
        <button onClick={copy} className="p-2 rounded-md hover:bg-muted transition-colors" title="Copy">
          {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
        <button onClick={download} className="p-2 rounded-md hover:bg-muted transition-colors" title="Download">
          <Download className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={onClose} className="p-2 rounded-md hover:bg-muted transition-colors" title="Close">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </header>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={() => setTab('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'preview' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button
          onClick={() => setTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'code' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Code
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        {tab === 'preview' ? (
          renderPreview()
        ) : (
          <pre className="w-full h-full overflow-auto p-4 bg-muted/30 rounded-lg text-xs font-mono text-foreground whitespace-pre-wrap">
            {artifact.content}
          </pre>
        )}
      </div>
    </aside>
  );
}
