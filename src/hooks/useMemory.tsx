import { useState, useEffect, useCallback } from 'react';
import { MemoryItem } from '@/lib/types';
import {
  isWordPress,
  getMemoriesFromWP,
  addMemoryToWP,
  deleteMemoryFromWP,
  clearMemoriesInWP,
} from '@/lib/wp-api';

const MEMORY_KEY = 'versace22_memories';
const MEMORY_ENABLED_KEY = 'versace22_memory_enabled';

function readMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
  } catch {
    return [];
  }
}

function writeMemories(list: MemoryItem[]) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readEnabled(): boolean {
  const raw = localStorage.getItem(MEMORY_ENABLED_KEY);
  return raw === null ? true : raw === 'true';
}

export function useMemory() {
  const wpMode = isWordPress();
  const [memories, setMemories] = useState<MemoryItem[]>(() => (wpMode ? [] : readMemories()));
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wpMode) {
      setMemories(readMemories());
      return;
    }
    setLoading(true);
    try {
      const wp = await getMemoriesFromWP();
      setMemories(
        wp.map((m) => ({
          id: String(m.id),
          content: m.content,
          createdAt: m.created_at ? new Date(m.created_at) : new Date(),
        })),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [wpMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(MEMORY_ENABLED_KEY, String(v));
    setEnabledState(v);
  }, []);

  const addMemory = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return null;
      if (wpMode) {
        const created = await addMemoryToWP(trimmed);
        if (!created) return null;
        const item: MemoryItem = {
          id: String(created.id),
          content: created.content,
          createdAt: created.created_at ? new Date(created.created_at) : new Date(),
        };
        setMemories((prev) => [item, ...prev]);
        return item;
      }
      const item: MemoryItem = {
        id: 'mem_' + crypto.randomUUID(),
        content: trimmed,
        createdAt: new Date(),
      };
      const next = [item, ...readMemories()];
      writeMemories(next);
      setMemories(next);
      return item;
    },
    [wpMode],
  );

  const deleteMemory = useCallback(
    async (id: string) => {
      if (wpMode) {
        const ok = await deleteMemoryFromWP(id);
        if (!ok) return false;
        await refresh();
        return true;
      }
      const next = readMemories().filter((m) => m.id !== id);
      writeMemories(next);
      setMemories(next);
      return true;
    },
    [wpMode, refresh],
  );

  const clearAll = useCallback(async () => {
    if (wpMode) {
      const ok = await clearMemoriesInWP();
      if (!ok) return false;
    } else {
      writeMemories([]);
    }
    setMemories([]);
    return true;
  }, [wpMode]);

  const buildPreamble = useCallback((): string => {
    if (!enabled || memories.length === 0) return '';
    const lines = memories.map((m) => `- ${m.content}`).join('\n');
    return `Known facts about the user:\n${lines}`;
  }, [enabled, memories]);

  return {
    memories,
    enabled,
    setEnabled,
    loading,
    addMemory,
    deleteMemory,
    clearAll,
    refresh,
    buildPreamble,
  };
}
