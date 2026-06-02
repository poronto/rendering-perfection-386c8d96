export interface Persona {
  id: string;
  name: string;
  description: string;
  model: string;
  avatar: string;
  avatarColor?: string;
  visibility?: 'public' | 'private';
  isDefault?: boolean;
}

export interface MainCharacter {
  name: string;
  description: string;
  avatarInitials: string;
  avatarColor: string;
  model: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  persona?: Persona;
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  personaName?: string;
  avatarInitials?: string;
  avatarColor?: string;
  isMainChat?: boolean;
  messages: Message[];
  updatedAt: Date;
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
