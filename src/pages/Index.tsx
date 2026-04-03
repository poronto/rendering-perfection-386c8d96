import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { ChatSidebar, SidebarView } from '@/components/ChatSidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessages } from '@/components/ChatMessages';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { LeaderboardView, ProfileView, ReferView } from '@/components/SidebarViews';
import { DEFAULT_PERSONAS, Message, Persona } from '@/lib/types';
import { sendMessageToWP, isWordPress } from '@/lib/wp-api';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useWPConversations } from '@/hooks/useWPConversations';

const Index = () => {
  const { user, signOut, profile } = useAuth();
  const wpMode = isWordPress();

  // Use WP conversations hook in WordPress mode, Supabase otherwise
  const supaConv = useConversations();
  const wpConv = useWPConversations();
  const {
    conversations,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
    fetchConversations,
  } = wpMode ? wpConv : supaConv;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<SidebarView>('chat');
  const [personas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(DEFAULT_PERSONAS[0]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
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

  const handleSelectConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(id);
      const msgs = await loadMessages(id);
      setCurrentMessages(msgs);
      const persona = personas.find(p => p.id === conv.personaId);
      if (persona) setSelectedPersona(persona);
    }
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    if (activeConvId === id) {
      setActiveConvId(null);
      setCurrentMessages([]);
    }
  };

  const handleSend = async (
    text: string,
    attachment?: { url: string; type: string; data?: string } | null,
    model?: string
  ) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const newMessages = [...currentMessages, userMsg];
    setCurrentMessages(newMessages);

    let convId = activeConvId;

    if (!convId && !wpMode) {
      const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
      convId = await createConversation(title, selectedPersona.id);
      if (convId) setActiveConvId(convId);
    }

    if (convId && !wpMode) {
      await saveMessage(convId, 'user', text);
    }

    setIsTyping(true);

    let replyContent: string;
    try {
      replyContent = await sendMessageToWP(text, attachment, model);
    } catch (error) {
      console.error('Chat API error:', error);
      replyContent = `⚠️ Error: ${error instanceof Error ? error.message : 'Failed to get response'}. Please check your API settings in WordPress admin.`;
    }

    const aiMsgId = crypto.randomUUID();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: replyContent,
      timestamp: new Date(),
      persona: selectedPersona,
    };

    const updatedMessages = [...newMessages, aiMsg];
    setCurrentMessages(updatedMessages);
    setIsTyping(false);

    // Trigger streaming effect for the new AI message
    setStreamingMessageId(aiMsgId);
    setTimeout(() => setStreamingMessageId(null), Math.max(replyContent.length * 15, 3000));

    if (convId && !wpMode) {
      await saveMessage(convId, 'assistant', replyContent, selectedPersona.id);
    }

    // In WP mode, refresh conversation list after a new message
    if (wpMode) {
      setTimeout(() => fetchConversations(), 500);
    }
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || undefined;

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        personas={personas}
        activeConversationId={activeConvId}
        activeView={activeView}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onViewChange={(view) => { setActiveView(view); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={displayName}
        userInitial={initials}
        avatarUrl={avatarUrl}
        onSignOut={signOut}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1" />
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </button>
        </header>

        {activeView === 'leaderboard' ? (
          <LeaderboardView onBackToChat={() => setActiveView('chat')} />
        ) : activeView === 'profile' ? (
          <ProfileView onBackToChat={() => setActiveView('chat')} />
        ) : activeView === 'refer' ? (
          <ReferView onBackToChat={() => setActiveView('chat')} />
        ) : (
          <>
            {currentMessages.length === 0 ? (
              <WelcomeScreen personaName={selectedPersona.name} onSendSuggestion={handleSend} />
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto">
                  <ChatMessages
                    messages={currentMessages}
                    isTyping={isTyping}
                    streamingMessageId={streamingMessageId}
                  />
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            <div className="shrink-0 pb-4 pt-2">
              <ChatInput onSend={handleSend} disabled={isTyping} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
