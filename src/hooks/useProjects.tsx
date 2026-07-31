import { useState, useEffect, useCallback } from 'react';
import { Project } from '@/lib/types';
import {
  isWordPress,
  getProjectsFromWP,
  createProjectInWP,
  deleteProjectFromWP,
  assignConversationProjectWP,
} from '@/lib/wp-api';

const PROJECTS_KEY = 'versace22_projects';
const ASSIGN_KEY = 'versace22_conversation_projects';

function readProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map((p) => ({ ...p, createdAt: new Date(p.createdAt) }));
  } catch {
    return [];
  }
}

function writeProjects(list: Project[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readAssignments(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ASSIGN_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAssignments(map: Record<string, string>) {
  try {
    localStorage.setItem(ASSIGN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function useProjects() {
  const wpMode = isWordPress();
  const [projects, setProjects] = useState<Project[]>(() => (wpMode ? [] : readProjects()));
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    wpMode ? {} : readAssignments(),
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wpMode) {
      setProjects(readProjects());
      setAssignments(readAssignments());
      return;
    }
    setLoading(true);
    try {
      const wp = await getProjectsFromWP();
      const mapped: Project[] = wp.map((p) => ({
        id: String(p.id),
        name: p.name,
        description: p.description,
        customInstructions: p.custom_instructions,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
      }));
      setProjects(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [wpMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (data: { name: string; description?: string; customInstructions?: string }) => {
      const trimmed = data.name.trim();
      if (!trimmed) return null;
      if (wpMode) {
        const created = await createProjectInWP({
          name: trimmed,
          description: data.description,
          custom_instructions: data.customInstructions,
        });
        if (!created) return null;
        const project: Project = {
          id: String(created.id),
          name: created.name,
          description: created.description,
          customInstructions: created.custom_instructions,
          createdAt: created.created_at ? new Date(created.created_at) : new Date(),
        };
        setProjects((prev) => [project, ...prev]);
        return project;
      }
      const project: Project = {
        id: 'proj_' + crypto.randomUUID(),
        name: trimmed,
        description: data.description?.trim() || undefined,
        customInstructions: data.customInstructions?.trim() || undefined,
        createdAt: new Date(),
      };
      const next = [project, ...readProjects()];
      writeProjects(next);
      setProjects(next);
      return project;
    },
    [wpMode],
  );

  const updateProject = useCallback(
    async (id: string, data: { name?: string; description?: string; customInstructions?: string }) => {
      const apply = (p: Project): Project => ({
        ...p,
        name: data.name !== undefined ? data.name.trim() || p.name : p.name,
        description: data.description !== undefined ? data.description.trim() || undefined : p.description,
        customInstructions:
          data.customInstructions !== undefined
            ? data.customInstructions.trim() || undefined
            : p.customInstructions,
      });
      if (!wpMode) {
        const next = readProjects().map((p) => (p.id === id ? apply(p) : p));
        writeProjects(next);
        setProjects(next);
        return true;
      }
      setProjects((prev) => prev.map((p) => (p.id === id ? apply(p) : p)));
      return true;
    },
    [wpMode],
  );

  const deleteProject = useCallback(

    async (id: string) => {
      if (wpMode) {
        const ok = await deleteProjectFromWP(id);
        if (!ok) return false;
      } else {
        const next = readProjects().filter((p) => p.id !== id);
        writeProjects(next);
        // clear assignments referring this project
        const a = readAssignments();
        for (const cid of Object.keys(a)) if (a[cid] === id) delete a[cid];
        writeAssignments(a);
        setAssignments({ ...a });
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
      return true;
    },
    [wpMode],
  );

  const assignConversation = useCallback(
    async (conversationId: string, projectId: string | null) => {
      if (wpMode) {
        const ok = await assignConversationProjectWP(conversationId, projectId);
        if (!ok) return false;
      }
      const a = wpMode ? { ...assignments } : readAssignments();
      if (projectId) a[conversationId] = projectId;
      else delete a[conversationId];
      if (!wpMode) writeAssignments(a);
      setAssignments(a);
      return true;
    },
    [wpMode, assignments],
  );

  const getProjectForConversation = useCallback(
    (conversationId: string | null): string | null => {
      if (!conversationId) return null;
      return assignments[conversationId] || null;
    },
    [assignments],
  );

  return {
    projects,
    loading,
    refresh,
    createProject,
    updateProject,
    deleteProject,
    assignConversation,
    getProjectForConversation,
    assignments,
  };
}

