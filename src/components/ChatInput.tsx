import { useState, useRef } from 'react';
import { ArrowUp, Plus, Lock, Sparkles } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  return (
    <div className="w-full max-w-[720px] mx-auto px-4">
      <div className="bg-chat-input border border-border rounded-2xl overflow-hidden
                      shadow-lg shadow-black/20 transition-shadow focus-within:shadow-xl focus-within:border-primary/20">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask your AI personas anything"
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground
                     px-4 pt-4 pb-2 text-sm resize-none focus:outline-none
                     disabled:opacity-50 min-h-[44px] max-h-[200px]"
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                               text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              Choose models
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                               text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Auto
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Lock className="w-4 h-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              className="p-2 rounded-full bg-primary text-primary-foreground
                         hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100
                         transition-all duration-150 active:scale-95"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
