export interface Persona {
  id: string;
  name: string;
  description: string;
  model: string;
  avatar: string;
  isDefault?: boolean;
  visibility?: 'public' | 'private';
}

/** Smart Model Engine metadata returned by the plugin with each reply. */
export interface EngineMeta {
  mode?: string;      // router | council | hybrid
  category?: string;
  model?: string;
  members?: string[];
  judge?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  persona?: Persona;
  engine?: EngineMeta | null;
  artifactIds?: number[];
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  messages: Message[];
  updatedAt: Date;
  projectId?: string | null;
}


export interface Project {
  id: string;
  name: string;
  description?: string;
  customInstructions?: string;
  createdAt: Date;
}

export interface MemoryItem {
  id: string;
  content: string;
  enabled?: boolean;
  createdAt: Date;
}

export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: '1',
    name: 'Dr. Mark',
    description: 'Experienced physician with decades of clinical practice',
    model: 'gpt-4',
    avatar: 'DM',
    isDefault: true,
  },
  {
    id: '2',
    name: 'General Assistant',
    description: 'Helpful AI assistant for any task',
    model: 'gpt-4',
    avatar: 'GA',
  },
  {
    id: '3',
    name: 'Code Wizard',
    description: 'Expert programmer and software architect',
    model: 'gpt-4',
    avatar: 'CW',
  },
  {
    id: '4',
    name: 'Creative Writer',
    description: 'Storyteller and content creator',
    model: 'claude-3-opus',
    avatar: 'CR',
  },
];

export const SAMPLE_CONVERSATIONS: Conversation[] = [];
