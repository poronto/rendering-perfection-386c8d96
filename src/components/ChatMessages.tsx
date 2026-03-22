import { Message } from '@/lib/types';

interface ChatMessagesProps {
  messages: Message[];
  isTyping?: boolean;
}

export function ChatMessages({ messages, isTyping }: ChatMessagesProps) {
  if (messages.length === 0 && !isTyping) return null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          style={{
            animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
          }}
        >
          {msg.role === 'assistant' && (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center
                            text-[11px] font-bold text-primary mr-2.5 mt-1 shrink-0">
              {msg.persona?.avatar?.charAt(0) || 'A'}
            </div>
          )}
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-chat-user text-foreground rounded-br-md'
                : 'bg-chat-ai text-foreground rounded-bl-md'
              }`}
          >
            <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
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
