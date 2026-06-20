import { useEffect, useRef, useState } from 'react';
import { FolderKanban, Check, ChevronDown, X } from 'lucide-react';
import { Project } from '@/lib/types';

interface ProjectPickerProps {
  projects: Project[];
  selectedProjectId: string | null;
  disabled?: boolean;
  onSelect: (projectId: string | null) => void;
}

export function ProjectPicker({ projects, selectedProjectId, disabled, onSelect }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? 'Start a conversation first' : 'Assign to a project'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors
          ${selected
            ? 'bg-primary/15 text-primary border-primary/30'
            : 'bg-secondary/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'}
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <FolderKanban className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{selected ? selected.name : 'No project'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1 max-h-80 overflow-y-auto">
          <button
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors text-left"
          >
            <X className="w-3.5 h-3.5" />
            <span className="flex-1">No project</span>
            {!selectedProjectId && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No projects yet.</p>
          ) : (
            <>
              <div className="border-t border-border my-1" />
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors text-left"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-primary" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.id === selectedProjectId && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
