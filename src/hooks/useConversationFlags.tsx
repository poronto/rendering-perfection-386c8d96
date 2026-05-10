import { useState, useEffect, useCallback } from 'react';
import { isWordPress, pinConversationWP } from '@/lib/wp-api';

const STAR_KEY = 'versace22_starred_conversations';
const ARCHIVE_KEY = 'versace22_archived_conversations';

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function useConversationFlags() {
  const [starred, setStarred] = useState<Set<string>>(() => readSet(STAR_KEY));
  const [archived, setArchived] = useState<Set<string>>(() => readSet(ARCHIVE_KEY));

  useEffect(() => writeSet(STAR_KEY, starred), [starred]);
  useEffect(() => writeSet(ARCHIVE_KEY, archived), [archived]);

  const toggleStar = useCallback((id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      const willStar = !next.has(id);
      willStar ? next.add(id) : next.delete(id);
      // Sync server-side pin state when running inside WordPress.
      if (isWordPress()) {
        const numId = parseInt(id, 10);
        if (!Number.isNaN(numId)) pinConversationWP(numId, willStar).catch(() => { /* silent */ });
      }
      return next;
    });
  }, []);

  const toggleArchive = useCallback((id: string) => {
    setArchived((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const isStarred = useCallback((id: string) => starred.has(id), [starred]);
  const isArchived = useCallback((id: string) => archived.has(id), [archived]);

  return { starred, archived, toggleStar, toggleArchive, isStarred, isArchived };
}
