import { ArrowLeft, Sparkles, Star } from 'lucide-react';
import { Persona, MainCharacter } from '@/lib/types';

interface PersonaGalleryProps {
  personas: Persona[];
  selectedPersona: Persona | null;
  onSelectPersona: (persona: Persona) => void;
  mainCharacter?: MainCharacter | null;
  isMainChatMode?: boolean;
  onSelectMainCharacter?: () => void;
  onBack: () => void;
}

export function PersonaGallery({
  personas,
  selectedPersona,
  onSelectPersona,
  mainCharacter,
  isMainChatMode,
  onSelectMainCharacter,
  onBack,
}: PersonaGalleryProps) {
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

        {/* Main Character Card */}
        {mainCharacter && onSelectMainCharacter && (
          <button
            onClick={onSelectMainCharacter}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200
                       bg-gradient-to-br from-primary/10 to-primary/5
                       ${isMainChatMode
                         ? 'border-primary ring-2 ring-primary/30 shadow-lg scale-[1.01]'
                         : 'border-primary/20 hover:border-primary/40 hover:shadow-md'
                       }`}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: mainCharacter.avatarColor }}
              >
                {mainCharacter.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{mainCharacter.name}</h3>
                  {isMainChatMode && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">ACTIVE</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{mainCharacter.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">🌟 Main Character · {mainCharacter.model}</p>
              </div>
            </div>
          </button>
        )}

        {/* Persona Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {personas.map((persona) => {
            const isSelected = !isMainChatMode && selectedPersona?.id === persona.id;

            return (
              <button
                key={persona.id}
                onClick={() => onSelectPersona(persona)}
                className={`text-left p-4 rounded-xl border transition-all duration-200
                           bg-card hover:bg-accent/50
                           ${isSelected
                             ? 'ring-2 ring-primary border-primary scale-[1.02] shadow-lg'
                             : 'border-border hover:scale-[1.01] hover:shadow-md'
                           }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: persona.avatarColor || 'hsl(var(--primary))' }}
                  >
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
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{persona.model}</p>
                      {persona.visibility && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          persona.visibility === 'public'
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                        }`}>
                          {persona.visibility === 'public' ? '🌍 PUBLIC' : '🔒 PRIVATE'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {personas.length === 0 && !mainCharacter && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No personas available. Contact your administrator.
          </div>
        )}
      </div>
    </div>
  );
}
