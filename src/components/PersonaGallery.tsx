import { ArrowLeft, Sparkles } from 'lucide-react';
import { Persona } from '@/lib/types';

interface PersonaGalleryProps {
  personas: Persona[];
  selectedPersona: Persona;
  onSelectPersona: (persona: Persona) => void;
  onBack: () => void;
}

const PERSONA_COLORS = [
  'from-orange-500/20 to-red-500/20 border-orange-500/30',
  'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  'from-violet-500/20 to-purple-500/20 border-violet-500/30',
  'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
  'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
  'from-pink-500/20 to-rose-500/20 border-pink-500/30',
];

export function PersonaGallery({ personas, selectedPersona, onSelectPersona, onBack }: PersonaGalleryProps) {
  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Chat
      </button>

      <div className="w-full max-w-lg space-y-6" style={{ animation: 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="text-center space-y-2">
          <Sparkles className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Persona Gallery</h2>
          <p className="text-sm text-muted-foreground">Choose an AI persona to chat with</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {personas.map((persona, idx) => {
            const isSelected = selectedPersona.id === persona.id;
            const colorClass = PERSONA_COLORS[idx % PERSONA_COLORS.length];

            return (
              <button
                key={persona.id}
                onClick={() => onSelectPersona(persona)}
                className={`text-left p-4 rounded-xl border transition-all duration-200
                           bg-gradient-to-br ${colorClass}
                           ${isSelected
                             ? 'ring-2 ring-primary scale-[1.02] shadow-lg'
                             : 'hover:scale-[1.01] hover:shadow-md'
                           }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {persona.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm">{persona.name}</h3>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{persona.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">VERSACE22 ai</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
