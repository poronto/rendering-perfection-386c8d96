/**
 * WordPress AJAX API bridge
 * Reads config injected by versace22-enqueue.php via wp_localize_script
 */

interface WPConfig {
  ajaxurl: string;
  nonce: string;
  personaId: number;
  sessionId: string;
  loginUrl?: string;
  registerUrl?: string;
  logoutUrl?: string;
}

function getWPConfig(): WPConfig | null {
  const w = window as any;
  if (w.versace22_chat) {
    return {
      ajaxurl: w.versace22_chat.ajaxurl || w.versace22_chat.ajax_url,
      nonce: w.versace22_chat.nonce,
      personaId: parseInt(w.versace22_chat.persona_id, 10) || 1,
      sessionId: w.versace22_chat.session_id || 'sess_' + crypto.randomUUID(),
      loginUrl: w.versace22_chat.login_url,
      registerUrl: w.versace22_chat.register_url,
      logoutUrl: w.versace22_chat.logout_url,
    };
  }
  return null;
}

export function isWordPress(): boolean {
  return getWPConfig() !== null;
}

export function getWPPersonaId(): number {
  return getWPConfig()?.personaId ?? 1;
}

export function getWPSessionId(): string {
  return getWPConfig()?.sessionId ?? '';
}

export function getWPAuthLinks(): { loginUrl: string; registerUrl: string; logoutUrl: string } {
  const config = getWPConfig();
  const origin = window.location.origin;
  const currentUrl = window.location.href;
  return {
    loginUrl: config?.loginUrl || `${origin}/wp-login.php?redirect_to=${encodeURIComponent(currentUrl)}`,
    registerUrl: config?.registerUrl || `${origin}/wp-login.php?action=register`,
    logoutUrl: config?.logoutUrl || `${origin}/wp-login.php?action=logout`,
  };
}

// ===================== CHAT =====================

export async function sendMessageToWP(
  message: string,
  attachment?: { url: string; type: string; data?: string } | null,
  personaId?: string | number,
): Promise<string> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const formData = new FormData();
  formData.append('action', 'aicpp_chat');
  formData.append('nonce', config.nonce);
  formData.append('persona_id', String(personaId || config.personaId));
  formData.append('message', message);
  formData.append('session_id', config.sessionId);
  

  if (attachment) {
    formData.append('has_attachment', '1');
    formData.append('attachment_url', attachment.url);
    formData.append('attachment_type', attachment.type);
    if (attachment.data) formData.append('attachment_data', attachment.data);
  }

  const response = await fetch(config.ajaxurl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.data?.message || 'Chat request failed');
  }

  return result.data.message;
}

// ===================== FILE UPLOAD =====================

export async function uploadFileToWP(file: File): Promise<{
  file_url: string;
  file_name: string;
  file_type: string;
  file_data?: string;
}> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const formData = new FormData();
  formData.append('action', 'aicpp_upload_file');
  formData.append('nonce', config.nonce);
  formData.append('file', file);

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Upload error: ${response.status}`);

  const result = await response.json();
  if (!result.success) throw new Error(result.data?.message || 'Upload failed');

  return result.data;
}

// ===================== AUDIO TRANSCRIPTION =====================

export async function transcribeAudioWP(audioBlob: Blob): Promise<string> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const formData = new FormData();
  formData.append('action', 'aicpp_transcribe_audio');
  formData.append('nonce', config.nonce);
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Transcription error: ${response.status}`);

  const result = await response.json();
  if (!result.success) throw new Error(result.data?.message || 'Transcription failed');

  return result.data.text;
}

// ===================== PERSONAS =====================

export interface WPPersona {
  id: number | string;
  name: string;
  description?: string;
  avatar_initials?: string;
  avatar_color?: string;
  model?: string;
  visibility?: string;
}

export async function getMyPersonasFromWP(): Promise<WPPersona[]> {
  const config = getWPConfig();
  if (!config) return [];

  const formData = new FormData();
  formData.append('action', 'aicpp_get_my_personas');
  formData.append('nonce', config.nonce);

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Persona request failed: ${response.status}`);

  const result = await response.json();
  if (!result.success) throw new Error(result.data?.message || 'Unable to load personas');

  const personas = Array.isArray(result.data?.personas) ? result.data.personas : [];
  return personas;
}

// ===================== CONVERSATIONS =====================

export interface WPConversation {
  id: number;
  title: string;
  persona_id?: number | string | null;
  token_count: number;
  created_at: string;
  updated_at: string;
}

export interface WPMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getConversationsFromWP(): Promise<WPConversation[]> {
  const config = getWPConfig();
  if (!config) return [];

  const formData = new FormData();
  formData.append('action', 'aicpp_get_conversations');
  formData.append('nonce', config.nonce);
  formData.append('session_id', config.sessionId);

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  const result = await response.json();
  return result.success ? result.data.conversations : [];
}

export async function loadConversationFromWP(conversationId: number): Promise<{
  messages: WPMessage[];
  session_id: string;
  persona_id: number;
} | null> {
  const config = getWPConfig();
  if (!config) return null;

  const formData = new FormData();
  formData.append('action', 'aicpp_load_conversation');
  formData.append('nonce', config.nonce);
  formData.append('conversation_id', String(conversationId));

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  const result = await response.json();
  return result.success ? result.data : null;
}

export async function deleteConversationFromWP(conversationId: number): Promise<boolean> {
  const config = getWPConfig();
  if (!config) return false;

  const formData = new FormData();
  formData.append('action', 'aicpp_delete_conversation');
  formData.append('nonce', config.nonce);
  formData.append('conversation_id', String(conversationId));

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  const result = await response.json();
  return result.success;
}

// ===================== USER REGISTRATION =====================

export async function registerUserWP(data: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}): Promise<{ user_id: number; display_name: string }> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const formData = new FormData();
  formData.append('action', 'aicpp_register_user');
  formData.append('nonce', config.nonce);
  formData.append('username', data.username);
  formData.append('email', data.email);
  formData.append('password', data.password);
  if (data.display_name) formData.append('display_name', data.display_name);

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Registration error: ${response.status}`);

  const result = await response.json();
  if (!result.success) throw new Error(result.data?.message || 'Registration failed');

  return result.data;
}

// ===================== WP USER INFO =====================

/** Check if WP user is logged in (cookie-based, detected via localized data) */
export function getWPUserInfo(): { isLoggedIn: boolean; displayName: string } {
  const w = window as any;
  if (w.versace22_chat?.user_logged_in) {
    return {
      isLoggedIn: true,
      displayName: w.versace22_chat.user_display_name || 'User',
    };
  }
  // If we're in WP but not logged in, guests can still chat
  if (w.versace22_chat) {
    return { isLoggedIn: false, displayName: 'Guest' };
  }
  return { isLoggedIn: false, displayName: 'Guest' };
}

export function isWPUserLoggedIn(): boolean {
  const w = window as any;
  return !!w.versace22_chat?.user_logged_in;
}
