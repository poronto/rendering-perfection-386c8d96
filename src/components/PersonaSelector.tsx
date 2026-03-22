import { Persona } from '@/lib/types';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface PersonaSelectorProps {
  personas: Persona[];
  selectedPersona: Persona;
  onSelect: (persona: Persona) => void;
}

export function PersonaSelector({ personas, selectedPersona, onSelect }: PersonaSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-secondary text-secondary-foreground hover:bg-secondary/80
                   border border-border transition-all duration-150
                   active:scale-[0.97]"
      >
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
          {selectedPersona.avatar.charAt(0)}
        </div>
        {selectedPersona.name}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-xl
                        shadow-2xl shadow-black/40 overflow-hidden z-50"
             style={{ animation: 'fade-up 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="p-2 space-y-0.5">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150
                  ${p.id === selectedPersona.id
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${p.id === selectedPersona.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {p.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
