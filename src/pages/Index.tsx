import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessages } from '@/components/ChatMessages';
import { PersonaSelector } from '@/components/PersonaSelector';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { DEFAULT_PERSONAS, SAMPLE_CONVERSATIONS, Message, Conversation, Persona } from '@/lib/types';
import { sendMessageToWP } from '@/lib/wp-api';

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

    // Send message to WordPress plugin backend
    setIsTyping(true);

    let replyContent: string;
    try {
      replyContent = await sendMessageToWP(text);
    } catch (error) {
      console.error('Chat API error:', error);
      replyContent = `⚠️ Error: ${error instanceof Error ? error.message : 'Failed to get response'}. Please check your API settings in WordPress admin.`;
    }

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: replyContent,
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

export default Index;
