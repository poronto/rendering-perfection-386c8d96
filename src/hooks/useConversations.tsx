import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Message, Conversation, Persona } from '@/lib/types';

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('conversations')
      .select('id, title, persona_id, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (data) {
      setConversations(data.map(c => ({
        id: c.id,
        title: c.title,
        personaId: c.persona_id,
        messages: [],
        updatedAt: new Date(c.updated_at),
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const loadMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    const { data } = await supabase
      .from('messages')
      .select('id, role, content, persona_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!data) return [];
    return data.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: new Date(m.created_at),
    }));
  }, []);

  const createConversation = useCallback(async (title: string, personaId: string): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title, persona_id: personaId })
      .select('id')
      .single();

    if (error || !data) return null;

    setConversations(prev => [{
      id: data.id,
      title,
      personaId,
      messages: [],
      updatedAt: new Date(),
    }, ...prev]);

    return data.id;
  }, [user]);

  const saveMessage = useCallback(async (conversationId: string, role: 'user' | 'assistant', content: string, personaId?: string) => {
    if (!user) return;
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role,
      content,
      persona_id: personaId || null,
    });

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }, [user]);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from('conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  /** Local-only pin toggle (standalone mode has no server pin column). */
  const togglePin = useCallback(async (id: string) => {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  }, []);

  return {
    conversations,
    loading,
    fetchConversations,
    togglePin,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
  };
}
