export interface Persona {
  id: string;
  name: string;
  description: string;
  model: string;
  avatar: string;
  isDefault?: boolean;
}

export interface MessageArtifact {
  type: string;
  title: string;
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  persona?: Persona;
  artifacts?: MessageArtifact[];
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  messages: Message[];
  updatedAt: Date;
  pinned?: boolean;
  projectId?: number | null;
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
