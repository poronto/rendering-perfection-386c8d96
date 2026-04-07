import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, LogOut, Star } from 'lucide-react';
import { ChatSidebar, SidebarView } from '@/components/ChatSidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessages } from '@/components/ChatMessages';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PersonaGallery } from '@/components/PersonaGallery';
import { SpecializedModesBar, SpecializedMode, SPECIALIZED_MODES } from '@/components/SpecializedModes';
import { LeaderboardView, ProfileView, ReferView } from '@/components/SidebarViews';
import { DEFAULT_PERSONAS, Message, Persona, MainCharacter } from '@/lib/types';
import {
  sendMessageToWP,
  sendMainChatToWP,
  sendPersonaChatToWP,
  isWordPress,
  getMyPersonasFromWP,
  getWPSessionId,
} from '@/lib/wp-api';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useWPConversations } from '@/hooks/useWPConversations';

const Index = () => {
  const { user, signOut, profile } = useAuth();
  const wpMode = isWordPress();

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
  const [personas, setPersonas] = useState<Persona[]>(wpMode ? [] : DEFAULT_PERSONAS);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(wpMode ? null : DEFAULT_PERSONAS[0]);
  const [mainCharacter, setMainCharacter] = useState<MainCharacter | null>(null);
  const [isMainChatMode, setIsMainChatMode] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<SpecializedMode>(SPECIALIZED_MODES[0]);
  const [sessionId, setSessionId] = useState(() => getWPSessionId() || 'sess_' + crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load personas from WP on mount
  useEffect(() => {
    if (!wpMode) return;
    getMyPersonasFromWP().then(({ personas: wpPersonas, main_character }) => {
      const mapped: Persona[] = wpPersonas.map(p => ({
        id: String(p.id),
        name: p.name,
        description: p.description,
        model: p.model,
        avatar: p.avatar_initials,
        avatarColor: p.avatar_color,
        visibility: p.visibility,
      }));
      setPersonas(mapped);

      if (main_character) {
        setMainCharacter({
          name: main_character.name,
          description: main_character.description,
          avatarInitials: main_character.avatar_initials,
          avatarColor: main_character.avatar_color,
          model: main_character.model,
        });
        // Start in main chat mode
        setIsMainChatMode(true);
        setSelectedPersona(null);
      } else if (mapped.length > 0) {
        setSelectedPersona(mapped[0]);
        setIsMainChatMode(false);
      }
    });
  }, [wpMode]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isTyping, scrollToBottom]);

  const handleNewConversation = () => {
    setActiveConvId(null);
    setCurrentMessages([]);
    setSessionId('sess_' + crypto.randomUUID());
    setSidebarOpen(false);
  };

  const handleSelectConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(id);
      const msgs = await loadMessages(id);
      setCurrentMessages(msgs);

      // Restore chat mode based on conversation type
      if (conv.isMainChat) {
        setIsMainChatMode(true);
        setSelectedPersona(null);
      } else {
        setIsMainChatMode(false);
        const persona = personas.find(p => p.id === conv.personaId);
        if (persona) setSelectedPersona(persona);
      }
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

  const handleSelectPersona = (persona: Persona) => {
    setSelectedPersona(persona);
    setIsMainChatMode(false);
    setActiveView('chat');
    handleNewConversation();
  };

  const handleSelectMainCharacter = () => {
    setIsMainChatMode(true);
    setSelectedPersona(null);
    setActiveView('chat');
    handleNewConversation();
  };

  const handleSend = async (
    text: string,
    attachment?: { url: string; type: string; data?: string } | null,
  ) => {
    const modePrefix = activeMode.systemPrefix;
    const fullText = modePrefix ? `${modePrefix}\n\n${text}` : text;

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
      convId = await createConversation(title, selectedPersona?.id || '1');
      if (convId) setActiveConvId(convId);
    }

    if (convId && !wpMode) {
      await saveMessage(convId, 'user', text);
    }

    setIsTyping(true);

    let replyContent: string;
    try {
      if (wpMode) {
        if (isMainChatMode) {
          const result = await sendMainChatToWP(fullText, sessionId, attachment);
          replyContent = result.message;
        } else if (selectedPersona) {
          const result = await sendPersonaChatToWP(fullText, Number(selectedPersona.id), sessionId, attachment);
          replyContent = result.message;
        } else {
          throw new Error('No persona or main character selected');
        }
      } else {
        replyContent = await sendMessageToWP(fullText, attachment);
      }
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
      persona: selectedPersona || undefined,
    };

    const updatedMessages = [...newMessages, aiMsg];
    setCurrentMessages(updatedMessages);
    setIsTyping(false);

    setStreamingMessageId(aiMsgId);
    setTimeout(() => setStreamingMessageId(null), Math.max(replyContent.length * 15, 3000));

    if (convId && !wpMode) {
      await saveMessage(convId, 'assistant', replyContent, selectedPersona?.id);
    }

    if (wpMode) {
      setTimeout(() => fetchConversations(), 500);
    }
  };

  const handleRegenerate = async (messageIndex: number) => {
    const userMsg = currentMessages.slice(0, messageIndex).reverse().find(m => m.role === 'user');
    if (!userMsg) return;

    const updated = currentMessages.filter((_, i) => i !== messageIndex);
    setCurrentMessages(updated);

    setIsTyping(true);
    let replyContent: string;
    try {
      if (wpMode && isMainChatMode) {
        const result = await sendMainChatToWP(userMsg.content, sessionId);
        replyContent = result.message;
      } else if (wpMode && selectedPersona) {
        const result = await sendPersonaChatToWP(userMsg.content, Number(selectedPersona.id), sessionId);
        replyContent = result.message;
      } else {
        replyContent = await sendMessageToWP(userMsg.content);
      }
    } catch (error) {
      replyContent = `⚠️ Error: ${error instanceof Error ? error.message : 'Failed to regenerate'}`;
    }

    const aiMsgId = crypto.randomUUID();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: replyContent,
      timestamp: new Date(),
      persona: selectedPersona || undefined,
    };

    setCurrentMessages([...updated, aiMsg]);
    setIsTyping(false);
    setStreamingMessageId(aiMsgId);
    setTimeout(() => setStreamingMessageId(null), Math.max(replyContent.length * 15, 3000));
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || undefined;

  const activeChatName = isMainChatMode && mainCharacter
    ? mainCharacter.name
    : selectedPersona?.name || 'AI Assistant';

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

          {/* Main Character quick-switch button (WP mode only) */}
          {wpMode && mainCharacter && (
            <button
              onClick={handleSelectMainCharacter}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0
                ${isMainChatMode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
              <Star className="w-3.5 h-3.5" />
              {mainCharacter.name}
            </button>
          )}

          <div className="flex-1 overflow-x-auto">
            <SpecializedModesBar
              activeMode={activeMode.id}
              onSelectMode={setActiveMode}
            />
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
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
        ) : activeView === 'personas' ? (
          <PersonaGallery
            personas={personas}
            selectedPersona={selectedPersona}
            onSelectPersona={handleSelectPersona}
            mainCharacter={mainCharacter}
            isMainChatMode={isMainChatMode}
            onSelectMainCharacter={handleSelectMainCharacter}
            onBack={() => setActiveView('chat')}
          />
        ) : (
          <>
            {currentMessages.length === 0 ? (
              <WelcomeScreen personaName={activeChatName} onSendSuggestion={handleSend} />
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto">
                  <ChatMessages
                    messages={currentMessages}
                    isTyping={isTyping}
                    streamingMessageId={streamingMessageId}
                    onRegenerate={handleRegenerate}
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
