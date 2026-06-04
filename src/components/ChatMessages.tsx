import { useState, useRef } from 'react';
import { Copy, Check, RefreshCw, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { Message, MessageArtifact } from '@/lib/types';
import { MarkdownMessage } from './MarkdownMessage';
import { StreamingMessage } from './StreamingMessage';
import { ArtifactCard } from './ArtifactCard';
import { speakTextWP, isWordPress } from '@/lib/wp-api';
import { toast } from 'sonner';

interface ChatMessagesProps {
  messages: Message[];
  isTyping?: boolean;
  streamingMessageId?: string | null;
  onRegenerate?: (messageIndex: number) => void;
  onOpenArtifact?: (artifact: MessageArtifact) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copy message"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ReadAloudButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isWordPress()) return null;

  const toggle = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    try {
      const dataUrl = await speakTextWP(text.slice(0, 2500));
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => { setPlaying(false); toast.error('Playback failed'); };
      await audio.play();
      setPlaying(true);
    } catch (e: any) {
      toast.error(e?.message || 'TTS failed');
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title={playing ? 'Stop reading' : 'Read aloud'}
    >
      {playing ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );
}

function CitationLinks({ content }: { content: string }) {
  const citationRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const citations: { label: string; url: string }[] = [];
  let match;
  while ((match = citationRegex.exec(content)) !== null) {
    if (!citations.some(c => c.url === match![2])) citations.push({ label: match[1], url: match[2] });
  }
  if (citations.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
      {citations.slice(0, 5).map((cite, i) => (
        <a
          key={i}
          href={cite.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                     bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          {cite.label.length > 25 ? cite.label.slice(0, 25) + '…' : cite.label}
        </a>
      ))}
    </div>
  );
}

export function ChatMessages({ messages, isTyping, streamingMessageId, onRegenerate, onOpenArtifact }: ChatMessagesProps) {
  if (messages.length === 0 && !isTyping) return null;
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          style={{ animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both` }}
        >
          {msg.role === 'assistant' && (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center
                            text-[11px] font-bold text-primary mr-2.5 mt-1 shrink-0">
              {msg.persona?.avatar?.charAt(0) || 'A'}
            </div>
          )}
          <div className="flex flex-col max-w-[75%]">
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-chat-user text-foreground rounded-br-md'
                  : 'bg-chat-ai text-foreground rounded-bl-md'
                }`}
            >
              {msg.role === 'assistant' && msg.id === streamingMessageId ? (
                <StreamingMessage content={msg.content} />
              ) : msg.role === 'assistant' ? (
                <>
                  <MarkdownMessage content={msg.content} />
                  <CitationLinks content={msg.content} />
                </>
              ) : (
                <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
              )}
            </div>

            {/* Artifact cards */}
            {msg.role === 'assistant' && msg.artifacts && msg.artifacts.length > 0 && (
              <div className="mt-1 space-y-2">
                {msg.artifacts.map((a, idx) => (
                  <ArtifactCard key={idx} artifact={a} onOpen={() => onOpenArtifact?.(a)} />
                ))}
              </div>
            )}

            {/* Toolbar */}
            {msg.role === 'assistant' && msg.id !== streamingMessageId && (
              <div
                className="flex items-center gap-1 mt-1 ml-1 opacity-0 transition-opacity"
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <CopyButton text={msg.content} />
                <ReadAloudButton text={msg.content} />
                {onRegenerate && (
                  <button
                    onClick={() => onRegenerate(i)}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Regenerate response"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="flex justify-start" style={{ animation: 'fade-up 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center
                          text-[11px] font-bold text-primary mr-2.5 mt-1 shrink-0">
            A
          </div>
          <div className="bg-chat-ai rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-muted-foreground"
                style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
