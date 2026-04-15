import { useState, useEffect, useCallback } from 'react';
import {
  getConversationsFromWP,
  loadConversationFromWP,
  deleteConversationFromWP,
  WPConversation,
} from '@/lib/wp-api';
import { Message, Conversation } from '@/lib/types';

/**
 * Conversations hook for WordPress mode.
 * Uses WP AJAX endpoints instead of Supabase.
 * In WP mode, the plugin manages conversations — we don't need to "create" them
 * (the plugin auto-creates on first chat message via handle_chat).
 */
export function useWPConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const wpConvs = await getConversationsFromWP();
      setConversations(
        wpConvs.map((c: WPConversation) => ({
          id: String(c.id),
          title: c.title || `Conversation #${c.id}`,
          personaId: '',
          messages: [],
          updatedAt: new Date(c.updated_at),
        }))
      );
    } catch (err) {
      console.error('Failed to fetch WP conversations:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const loadMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    try {
      const data = await loadConversationFromWP(Number(conversationId));
      if (!data) return [];
      return data.messages.map((m, idx) => ({
        id: `wp-msg-${conversationId}-${idx}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(),
      }));
    } catch (err) {
      console.error('Failed to load WP conversation:', err);
      return [];
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const success = await deleteConversationFromWP(Number(id));
    if (success) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  // In WP mode, conversations are auto-created by the plugin when sending the first message.
  // We don't need to explicitly create them.
  const createConversation = useCallback(async (_title: string, _personaId: string): Promise<string | null> => {
    // The WP plugin creates conversations automatically on first chat message.
    // Return null — the conversation ID will come back from the chat response.
    return null;
  }, []);

  const saveMessage = useCallback(async (_conversationId: string, _role: 'user' | 'assistant', _content: string, _personaId?: string) => {
    // Messages are saved server-side by the WP plugin's handle_chat.
    // No client-side action needed.
  }, []);

  return {
    conversations,
    loading,
    fetchConversations,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
  };
}
