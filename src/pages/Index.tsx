import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Menu, LogOut, FileBox } from 'lucide-react';
import { toast } from 'sonner';
import { ChatSidebar, SidebarView } from '@/components/ChatSidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessages } from '@/components/ChatMessages';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PersonaGallery } from '@/components/PersonaGallery';
import { SpecializedMode, SPECIALIZED_MODES } from '@/components/SpecializedModes';
import { ProfileView, ReferView } from '@/components/SidebarViews';
import { DataSourcesView } from '@/components/DataSourcesView';
import { ProjectsView } from '@/components/ProjectsView';
import { ProjectDetailView } from '@/components/ProjectDetailView';
import { ArtifactsPanel } from '@/components/ArtifactsPanel';

import { MemoryView } from '@/components/MemoryView';
import { ProjectPicker } from '@/components/ProjectPicker';
import { AuthModal } from '@/components/AuthModal';
import { WPAuthModal } from '@/components/WPAuthModal';
import { DEFAULT_PERSONAS, Message, Persona } from '@/lib/types';
import {
  sendMessageToWP,
  sendMessageToMainWP,
  hasMainCharacterEndpoint,
  getWPCapabilities,
  getBridgeInfo,
  isWordPress,
  type WPChatResponse,
} from '@/lib/wp-api';
import { useAuth } from '@/hooks/useAuth';
import { useWPAuth } from '@/hooks/useWPAuth';
import { useConversations } from '@/hooks/useConversations';
import { useWPConversations } from '@/hooks/useWPConversations';
import { useWPPersonas } from '@/hooks/useWPPersonas';
import { useProjects } from '@/hooks/useProjects';
import { useMemory } from '@/hooks/useMemory';

/** Pseudo-persona representing the WordPress "Main Site Character". */
const MAIN_CHARACTER: Persona = {
  id: 'main',
  name: 'Main Character',
  description: 'The default site-wide AI assistant',
  model: 'auto',
  avatar: 'MC',
  isDefault: true,
  visibility: 'public',
};


const Index = () => {
  const wpMode = isWordPress();
  const standaloneAuth = useAuth();
  const wpAuth = useWPAuth();
  const { user, signOut, profile, loading: authLoading } = wpMode ? wpAuth : standaloneAuth;
  const [showAuth, setShowAuth] = useState(false);

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
  const [standalonePersonas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const { personas: wpPersonas } = useWPPersonas(wpMode);
  const caps = useMemo(() => getWPCapabilities(), []);
  const bridge = useMemo(() => getBridgeInfo(), []);
  const mainCharacterAvailable = wpMode && hasMainCharacterEndpoint();
  const personas = useMemo(
    () =>
      wpMode
        ? (mainCharacterAvailable ? [MAIN_CHARACTER, ...wpPersonas] : wpPersonas)
        : standalonePersonas,
    [wpMode, mainCharacterAvailable, wpPersonas, standalonePersonas],
  );
  const [selectedPersona, setSelectedPersona] = useState<Persona>(DEFAULT_PERSONAS[0]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<SpecializedMode>(SPECIALIZED_MODES[0]);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [artifactsRefresh, setArtifactsRefresh] = useState(0);
  const [pendingArtifactId, setPendingArtifactId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const {
    projects,
    assignments: projectAssignments,
    assignConversation,
    getProjectForConversation,
    updateProject,
    deleteProject,
    refresh: refreshProjects,
  } = useProjects();
  const memory = useMemory();
  // Project page currently open (ChatGPT-style project workspace)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  // Project a brand-new chat should be created inside
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const assignedProjectId = getProjectForConversation(activeConvId);
  const activeProjectId = activeConvId ? assignedProjectId : pendingProjectId;
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const openProject = projects.find((p) => p.id === openProjectId) || null;
  const projectConversations = conversations.filter(
    (c) => (projectAssignments[c.id] || c.projectId) === openProjectId,
  );


  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (personas.length > 0 && !personas.some((persona) => persona.id === selectedPersona.id)) {
      setSelectedPersona(personas[0]);
    }
  }, [personas, selectedPersona.id]);

  const handleNewConversation = () => {
    setActiveConvId(null);
    setCurrentMessages([]);
    setPendingProjectId(null);
    setSidebarOpen(false);
  };

  const handleSelectConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(id);
      setPendingProjectId(null);
      const msgs = await loadMessages(id);
      setCurrentMessages(msgs);
      const persona = personas.find(p => p.id === conv.personaId);
      if (persona) setSelectedPersona(persona);
    }
    setActiveView('chat');
    setSidebarOpen(false);
  };

  const handleOpenProject = async (id: string) => {
    await refreshProjects();
    setOpenProjectId(id);
    setActiveView('projects');
    setSidebarOpen(false);
  };

  const handleNewChatInProject = (projectId: string) => {
    setActiveConvId(null);
    setCurrentMessages([]);
    setPendingProjectId(projectId);
    setActiveView('chat');
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
    setActiveView('chat');
    handleNewConversation();
  };

  /** Route to the Main Character endpoint or the persona endpoint. */
  const dispatchChat = useCallback(
    async (
      text: string,
      attachment?: { url: string; type: string; data?: string } | null,
      convId?: string | null,
    ): Promise<WPChatResponse> => {
      if (wpMode && selectedPersona.id === MAIN_CHARACTER.id) {
        return sendMessageToMainWP(text, attachment, convId ?? null);
      }
      return sendMessageToWP(text, attachment, wpMode ? selectedPersona.id : undefined, convId ?? null);
    },
    [wpMode, selectedPersona.id],
  );

  const handleSend = async (
    text: string,
    attachment?: { url: string; type: string; data?: string } | null,
  ) => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    // In WordPress mode the plugin injects memories server-side ("## WHAT YOU
    // REMEMBER ABOUT THE USER"), so the client preamble is skipped to avoid
    // duplicated/conflicting memory context.
    const memoryPreamble = wpMode ? '' : memory.buildPreamble();
    const projectInstructions = activeProject?.customInstructions
      ? `Project context "${activeProject.name}":\n${activeProject.customInstructions}`
      : '';
    const modePrefix = activeMode.systemPrefix;
    const fullText = [memoryPreamble, projectInstructions, modePrefix, text]
      .filter(Boolean)
      .join('\n\n');

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
      if (convId) {
        setActiveConvId(convId);
        if (pendingProjectId) {
          await assignConversation(convId, pendingProjectId);
          setPendingProjectId(null);
        }
      }
    }

    if (convId && !wpMode) {
      await saveMessage(convId, 'user', text);
    }

    setIsTyping(true);

    let reply: WPChatResponse;
    try {
      reply = await dispatchChat(fullText, attachment, convId);
    } catch (error) {
      console.error('Chat API error:', error);
      reply = {
        message: `⚠️ Error: ${error instanceof Error ? error.message : 'Failed to get response'}.`,
        engine: null,
      };
    }

    const replyContent = reply.message || '';

    // WordPress creates/returns the conversation id with every reply — use it
    // immediately instead of guessing from the refreshed list.
    if (wpMode && reply.conversation_id) {
      const wpConvId = String(reply.conversation_id);
      if (activeConvId !== wpConvId) setActiveConvId(wpConvId);
      convId = wpConvId;
      if (pendingProjectId) {
        await assignConversation(wpConvId, pendingProjectId);
        setPendingProjectId(null);
      }
    }

    const aiMsgId = crypto.randomUUID();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: replyContent,
      timestamp: new Date(),
      persona: selectedPersona,
      engine: reply.engine || null,
      artifactIds: reply.new_artifacts || [],
    };

    setCurrentMessages([...newMessages, aiMsg]);
    setIsTyping(false);

    setStreamingMessageId(aiMsgId);
    setTimeout(() => setStreamingMessageId(null), Math.max(replyContent.length * 15, 3000));

    if (convId && !wpMode) {
      await saveMessage(convId, 'assistant', replyContent, selectedPersona.id);
    }

    if (wpMode) {
      if (reply.new_artifacts && reply.new_artifacts.length > 0) {
        setArtifactsRefresh((n) => n + 1);
        setPendingArtifactId(reply.open_artifact || reply.new_artifacts[reply.new_artifacts.length - 1]);
      }
      fetchConversations();
    }
  };

  const handleRegenerate = async (messageIndex: number) => {
    const userMsg = currentMessages.slice(0, messageIndex).reverse().find(m => m.role === 'user');
    if (!userMsg) return;

    const updated = currentMessages.filter((_, i) => i !== messageIndex);
    setCurrentMessages(updated);

    setIsTyping(true);
    let reply: WPChatResponse;
    try {
      reply = await dispatchChat(userMsg.content, null, activeConvId);
    } catch (error) {
      reply = {
        message: `⚠️ Error: ${error instanceof Error ? error.message : 'Failed to regenerate'}`,
        engine: null,
      };
    }

    const aiMsgId = crypto.randomUUID();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: reply.message || '',
      timestamp: new Date(),
      persona: selectedPersona,
      engine: reply.engine || null,
      artifactIds: reply.new_artifacts || [],
    };

    setCurrentMessages([...updated, aiMsg]);
    setIsTyping(false);
    setStreamingMessageId(aiMsgId);
    setTimeout(() => setStreamingMessageId(null), Math.max((reply.message || '').length * 15, 3000));
  };


  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || undefined;

  const handleAssignProject = async (projectId: string | null) => {
    if (!activeConvId) {
      // No conversation yet — remember the project for the next chat (ChatGPT behaviour).
      setPendingProjectId(projectId);
      return;
    }
    await assignConversation(activeConvId, projectId);
  };

  const handleDeleteOpenProject = async () => {
    if (!openProject) return;
    if (!confirm(`Delete project "${openProject.name}"? Chats stay but lose this project.`)) return;
    await deleteProject(openProject.id);
    setOpenProjectId(null);
  };


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
        projects={projects}
        projectAssignments={projectAssignments}
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
          <ProjectPicker
            projects={projects}
            selectedProjectId={activeProjectId}
            onSelect={handleAssignProject}
          />

          {wpMode && caps.artifacts && (
            <button
              onClick={() => {
                if (!activeConvId) {
                  toast.info('Start a chat first — artifacts are saved per conversation.');
                  return;
                }
                setArtifactsOpen(true);
              }}
              className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
              title={`Artifacts${bridge?.version ? ` · bridge ${bridge.version}` : ''}`}
            >
              <FileBox className="w-4 h-4 text-muted-foreground" />
            </button>
          )}



          {user ? (
            <button
              onClick={signOut}
              className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAuth(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:bg-muted transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => setShowAuth(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Sign up
              </button>
            </div>
          )}
        </header>

        {activeView === 'datasources' ? (
          <DataSourcesView onBackToChat={() => setActiveView('chat')} />
        ) : activeView === 'profile' ? (
          <ProfileView onBackToChat={() => setActiveView('chat')} />
        ) : activeView === 'refer' ? (
          <ReferView onBackToChat={() => setActiveView('chat')} />
        ) : activeView === 'personas' ? (
          <PersonaGallery
            personas={personas}
            selectedPersona={selectedPersona}
            onSelectPersona={handleSelectPersona}
            onBack={() => setActiveView('chat')}
          />
        ) : activeView === 'projects' ? (
          openProject ? (
            <ProjectDetailView
              project={openProject}
              conversations={projectConversations}
              activeConversationId={activeConvId}
              onBack={() => setOpenProjectId(null)}
              onNewChatInProject={() => handleNewChatInProject(openProject.id)}
              onSelectConversation={handleSelectConversation}
              onRemoveFromProject={(cid) => assignConversation(cid, null)}
              onUpdateProject={(data) => updateProject(openProject.id, data)}
              onDeleteProject={handleDeleteOpenProject}
            />
          ) : (
            <ProjectsView
              onBackToChat={() => setActiveView('chat')}
              onOpenProject={handleOpenProject}
            />
          )

        ) : activeView === 'memory' ? (
          <MemoryView onBackToChat={() => setActiveView('chat')} />
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

      {!wpMode && !authLoading && (!user || showAuth) && (
        <AuthModal
          blocking={!user}
          onClose={user ? () => setShowAuth(false) : undefined}
        />
      )}
      {wpMode && (!user || showAuth) && (
        <WPAuthModal
          blocking={!user}
          onClose={user ? () => setShowAuth(false) : undefined}
        />
      )}
    </div>
  );
};

export default Index;
