import { useRef, useState } from 'react';
import { ArrowUp, Lock, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const MODELS = ['GPT-4o', 'Claude 3.7', 'Gemini 2.0'];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = MODELS[selectedModelIndex];

  const handleSend = () => {
    if (disabled) return;

    const cleanMessage = message.trim();
    if (!cleanMessage && !attachedFile) {
      toast.error('Type a message or attach a file first');
      return;
    }

    const payload = [
      isPrivateMode ? '[Private mode enabled]' : '',
      isAutoMode ? '[Model: Auto]' : `[Model: ${selectedModel}]`,
      cleanMessage,
      attachedFile ? `[Attachment: ${attachedFile.name}]` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    onSend(payload);
    setMessage('');
    setAttachedFile(null);

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
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleChooseModel = () => {
    setIsAutoMode(false);
    setSelectedModelIndex((prev) => (prev + 1) % MODELS.length);
    toast.success(`Model switched to ${MODELS[(selectedModelIndex + 1) % MODELS.length]}`);
  };

  const handleToggleAuto = () => {
    setIsAutoMode((prev) => {
      const next = !prev;
      toast.success(next ? 'Auto mode enabled' : `Manual mode: ${selectedModel}`);
      return next;
    });
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAttachedFile(file);
    if (file) toast.success(`Attached: ${file.name}`);
  };

  const handleTogglePrivate = () => {
    setIsPrivateMode((prev) => {
      const next = !prev;
      toast.success(next ? 'Private mode enabled' : 'Private mode disabled');
      return next;
    });
  };

  return (
    <div className="w-full max-w-[720px] mx-auto px-4">
      <div
        className="bg-chat-input border border-border rounded-2xl overflow-hidden
                   shadow-lg shadow-black/20 transition-shadow focus-within:shadow-xl focus-within:border-primary/20"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

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

        {attachedFile && (
          <div className="px-3 pb-1">
            <p className="text-xs text-muted-foreground truncate">Attached: {attachedFile.name}</p>
          </div>
        )}

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleChooseModel}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAutoMode ? 'Choose models' : selectedModel}
            </button>

            <button
              type="button"
              onClick={handleToggleAuto}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${isAutoMode
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              Auto
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAttachClick}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleTogglePrivate}
              className={`p-2 rounded-lg transition-colors
                ${isPrivateMode
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              <Lock className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={disabled}
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
