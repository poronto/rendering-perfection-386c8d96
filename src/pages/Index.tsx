import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessages } from '@/components/ChatMessages';
import { PersonaSelector } from '@/components/PersonaSelector';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { DEFAULT_PERSONAS, SAMPLE_CONVERSATIONS, Message, Conversation, Persona } from '@/lib/types';

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [personas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(DEFAULT_PERSONAS[0]);
  const [conversations, setConversations] = useState<Conversation[]>(SAMPLE_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isTyping, scrollToBottom]);

  const handleNewConversation = () => {
    setActiveConvId(null);
    setCurrentMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(id);
      setCurrentMessages(conv.messages);
      const persona = personas.find(p => p.id === conv.personaId);
      if (persona) setSelectedPersona(persona);
    }
    setSidebarOpen(false);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setCurrentMessages([]);
    }
  };

  const handleSend = async (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const newMessages = [...currentMessages, userMsg];
    setCurrentMessages(newMessages);

    // Create or update conversation
    if (!activeConvId) {
      const newConv: Conversation = {
        id: crypto.randomUUID(),
        title: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
        personaId: selectedPersona.id,
        messages: newMessages,
        updatedAt: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(newConv.id);
    }

    // Simulate AI response
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: getSimulatedResponse(text, selectedPersona),
      timestamp: new Date(),
      persona: selectedPersona,
    };

    const updatedMessages = [...newMessages, aiMsg];
    setCurrentMessages(updatedMessages);
    setIsTyping(false);

    // Update conversation
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConvId
          ? { ...c, messages: updatedMessages, updatedAt: new Date() }
          : c
      )
    );
  };

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        personas={personas}
        activeConversationId={activeConvId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <PersonaSelector
            personas={personas}
            selectedPersona={selectedPersona}
            onSelect={setSelectedPersona}
          />
        </header>

        {/* Messages or welcome */}
        {currentMessages.length === 0 ? (
          <WelcomeScreen personaName={selectedPersona.name} onSendSuggestion={handleSend} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[720px] mx-auto">
              <ChatMessages messages={currentMessages} isTyping={isTyping} />
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 pb-4 pt-2">
          <ChatInput onSend={handleSend} disabled={isTyping} />
        </div>
      </main>
    </div>
  );
};

function getSimulatedResponse(input: string, persona: Persona): string {
  const responses: Record<string, string[]> = {
    'Dr. Mark': [
      `In my years of practice, I've seen many patients with similar concerns. Let me share some insights about "${input.slice(0, 30)}...".\n\nFirst, it's important to understand the underlying factors. I'd recommend starting with a thorough evaluation and we can discuss the best approach for your situation.`,
      `That's a great question. Based on my clinical experience, I'd approach this systematically. Let me break it down for you step by step.`,
    ],
    'General Assistant': [
      `I'd be happy to help with that! Here's what I can tell you about "${input.slice(0, 30)}...":\n\n1. Let's start with the fundamentals\n2. Then we can explore the details\n3. Finally, I'll provide actionable next steps\n\nWould you like me to elaborate on any of these points?`,
    ],
    'Code Wizard': [
      `Great question! Let me break down the technical approach:\n\n\`\`\`\n// Here's a clean solution\nfunction solve() {\n  // Implementation details\n  return result;\n}\n\`\`\`\n\nThe key considerations here are performance and maintainability. Want me to dive deeper?`,
    ],
    'Creative Writer': [
      `What a fascinating prompt! Let me paint a picture for you...\n\nThe words flow like a river of consciousness, each sentence building upon the last, creating a tapestry of meaning that speaks to the heart of your question.`,
    ],
  };

  const pool = responses[persona.name] || responses['General Assistant'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default Index;
