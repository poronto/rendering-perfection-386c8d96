import { FileCode2 } from 'lucide-react';
import { ParsedArtifact } from '@/lib/wp-api';

interface ArtifactCardProps {
  artifact: ParsedArtifact;
  onOpen: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  svg: 'SVG',
  markdown: 'Markdown',
  react: 'React',
  code: 'Code',
};

export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
  const label = TYPE_LABELS[artifact.type] || artifact.type.toUpperCase();
  return (
    <button
      onClick={onOpen}
      className="group mt-2 w-full max-w-md flex items-center gap-3 rounded-xl border border-primary/30
                 bg-primary/5 hover:bg-primary/10 transition-colors px-3.5 py-2.5 text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        <FileCode2 className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{artifact.title}</div>
        <div className="text-[11px] text-muted-foreground">
          {label} · {Math.min(artifact.content.length, 99999)} chars · click to open
        </div>
      </div>
      <span className="text-[10px] font-semibold tracking-wider text-primary opacity-70 group-hover:opacity-100">
        OPEN →
      </span>
    </button>
  );
}
