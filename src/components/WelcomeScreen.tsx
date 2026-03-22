interface WelcomeScreenProps {
  personaName: string;
  onSendSuggestion: (text: string) => void;
}

const suggestions = [
  'What can you help me with today?',
  'Tell me about your expertise',
  'Help me brainstorm an idea',
];

export function WelcomeScreen({ personaName, onSendSuggestion }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
      <div
        className="text-center space-y-4"
        style={{ animation: 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold tracking-widest uppercase text-primary">
          VERSACE22 ai
        </h1>
        <h2
          className="text-lg sm:text-xl font-semibold text-foreground tracking-tight leading-tight"
          style={{ textWrap: 'balance' } as React.CSSProperties}
        >
          World's smartest AIs,
          <br />
          <span className="text-primary">side-by-side</span> with you
        </h2>
      </div>

      <div
        className="mt-8 flex flex-wrap justify-center gap-2"
        style={{ animation: 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both' }}
      >
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSendSuggestion(s)}
            className="px-4 py-2 rounded-full text-sm bg-secondary text-secondary-foreground
                       border border-border hover:bg-muted hover:border-primary/20
                       transition-all duration-200 active:scale-[0.97]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
