/**
 * WordPress AJAX API bridge — v12.5.1-compatible
 *
 * Reads config injected by versace22-enqueue.php via wp_localize_script.
 *
 * Bridge contract (v12.5.1):
 *  - window.versace22_chat (+ window.aicppChat alias)
 *  - nonces: per-group bundle { aicpp_chat, aicpp_login, aicpp_register, aicpp }
 *  - endpoints: action manifest grouped by feature
 *  - can: capability flags
 *  - Data sources: notion + jira only, credentials required, NO OAuth start endpoint
 *  - Memory: per-persona, columns memory_text + enabled
 *  - Projects: list/create/update/delete + assign_conversation_project
 */

// ===================== CONFIG =====================

interface WPConfig {
  ajaxurl: string;
  nonce: string;                       // chat-group nonce — default for most calls
  nonces: Record<string, string>;      // full bundle keyed by group
  personaId: number;
  sessionId: string;
  loginUrl?: string;
  registerUrl?: string;
  logoutUrl?: string;
  loginNonce?: string;
  registerNonce?: string;
}

function getWPConfig(): WPConfig | null {
  const w = window as any;
  const cfg = w.versace22_chat || w.aicppChat; // bridge sets both globals
  if (!cfg) return null;
  const nonces = (cfg.nonces && typeof cfg.nonces === 'object') ? cfg.nonces : {};
  const chatNonce = nonces.aicpp_chat || cfg.nonce || '';
  return {
    ajaxurl: cfg.ajaxurl || cfg.ajax_url,
    nonce: chatNonce,
    nonces,
    personaId: parseInt(cfg.persona_id, 10) || 1,
    sessionId: cfg.session_id || 'sess_' + crypto.randomUUID(),
    loginUrl: cfg.login_url,
    registerUrl: cfg.register_url,
    logoutUrl: cfg.logout_url,
    loginNonce: nonces.aicpp_login || cfg.login_nonce,
    registerNonce: nonces.aicpp_register || cfg.register_nonce,
  };
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

// ===================== CAPABILITY FLAGS =====================

export function getWPCapabilities() {
  const w = window as any;
  const can = (w.versace22_chat || w.aicppChat)?.can || {};
  return {
    canChat: can.chat !== false,
    canUpload: can.upload !== false,
    canVoice: can.voice !== false,
    canHistory: can.history !== false,
    canMemories: !!can.memories,
    canCreateProject: !!can.create_project,
    canArtifacts: !!can.artifacts,
    canReferrals: !!can.referrals,
    canLeaderboard: !!can.leaderboard,
    isAdmin: !!can.admin,
    canLogin: !!can.login,
    canRegister: !!can.register,
  };
}

// ===================== GENERIC AJAX HELPER =====================

type NonceGroup = 'aicpp_chat' | 'aicpp_login' | 'aicpp_register' | 'aicpp';

async function wpAjax(
  action: string,
  params: Record<string, string> = {},
  nonceGroup: NonceGroup = 'aicpp_chat',
) {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');
  const nonce = config.nonces[nonceGroup] || config.nonce;
  const formData = new FormData();
  formData.append('action', action);
  formData.append('nonce', nonce);
  for (const [k, v] of Object.entries(params)) formData.append(k, v);
  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`${action} error: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.data?.message || `${action} failed`);
  return result.data;
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

  const response = await fetch(config.ajaxurl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.data?.message || 'Chat request failed');
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
  return Array.isArray(result.data?.personas) ? result.data.personas : [];
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

// ===================== AUTH (group-specific nonces) =====================

export async function registerUserWP(data: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}): Promise<{ user_id: number; display_name: string }> {
  return wpAjax(
    'aicpp_register_user',
    {
      username: data.username,
      email: data.email,
      password: data.password,
      ...(data.display_name ? { display_name: data.display_name } : {}),
    },
    'aicpp_register',
  );
}

export async function loginUserWP(data: {
  login: string;
  password: string;
}): Promise<{ user_id: number; display_name: string }> {
  return wpAjax(
    'aicpp_login_user',
    { login: data.login, password: data.password },
    'aicpp_login',
  );
}

// ===================== WP USER INFO =====================

export function getWPUserInfo(): { isLoggedIn: boolean; displayName: string } {
  const w = window as any;
  const cfg = w.versace22_chat || w.aicppChat;
  if (cfg?.user_logged_in) {
    return { isLoggedIn: true, displayName: cfg.user_display_name || 'User' };
  }
  return { isLoggedIn: false, displayName: 'Guest' };
}

export function isWPUserLoggedIn(): boolean {
  const w = window as any;
  return !!(w.versace22_chat || w.aicppChat)?.user_logged_in;
}

// ===================== PROJECTS (user-scoped) =====================

export interface WPProject {
  id: number | string;
  name: string;
  description?: string;
  custom_instructions?: string;
  created_at?: string;
}

export async function getProjectsFromWP(): Promise<WPProject[]> {
  if (!isWordPress()) return [];
  try {
    const data = await wpAjax('aicpp_user_list_projects');
    return Array.isArray(data?.projects) ? data.projects : [];
  } catch (err) {
    console.error('getProjectsFromWP failed:', err);
    return [];
  }
}

export async function createProjectInWP(project: {
  name: string;
  description?: string;
  custom_instructions?: string;
}): Promise<WPProject | null> {
  const data = await wpAjax('aicpp_user_create_project', {
    name: project.name,
    description: project.description || '',
    custom_instructions: project.custom_instructions || '',
  });
  return data?.id
    ? {
        id: data.id,
        name: project.name,
        description: project.description || '',
        custom_instructions: project.custom_instructions || '',
      }
    : null;
}

export async function updateProjectInWP(p: {
  id: string | number;
  name: string;
  description?: string;
  custom_instructions?: string;
}): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_update_project', {
      project_id: String(p.id),
      name: p.name,
      description: p.description || '',
      custom_instructions: p.custom_instructions || '',
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteProjectFromWP(id: string | number): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_delete_project', { project_id: String(id) });
    return true;
  } catch {
    return false;
  }
}

export async function assignConversationProjectWP(
  conversationId: string | number,
  projectId: string | number | null,
): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_assign_conversation_project', {
      conversation_id: String(conversationId),
      project_id: projectId === null ? '' : String(projectId),
    });
    return true;
  } catch {
    return false;
  }
}

// ===================== MEMORY (user-scoped, per-persona) =====================

export interface WPMemoryItem {
  id: number | string;
  content: string;
  enabled?: boolean;
  created_at?: string;
}

export async function getMemoriesFromWP(): Promise<WPMemoryItem[]> {
  if (!isWordPress()) return [];
  try {
    const data = await wpAjax('aicpp_user_get_memories');
    const raw = Array.isArray(data?.memories) ? data.memories : [];
    // PHP rows use `memory_text` + `enabled`; normalize for the React layer.
    return raw.map((m: any) => ({
      id: m.id,
      content: m.content ?? m.memory_text ?? '',
      enabled: m.enabled == null ? true : !!Number(m.enabled),
      created_at: m.created_at,
    }));
  } catch (err) {
    console.error('getMemoriesFromWP failed:', err);
    return [];
  }
}

export async function addMemoryToWP(content: string): Promise<WPMemoryItem | null> {
  const personaId = getWPPersonaId();
  // PHP handler requires `memory_text` (422 otherwise). Scope to the active persona.
  const data = await wpAjax('aicpp_user_add_memory', {
    memory_text: content,
    content,
    persona_id: String(personaId),
  });
  return data?.id ? { id: data.id, content } : null;
}

export async function updateMemoryInWP(id: string | number, content: string): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_update_memory', { memory_id: String(id), memory_text: content });
    return true;
  } catch {
    return false;
  }
}

export async function toggleMemoryInWP(id: string | number): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_toggle_memory', { memory_id: String(id) });
    return true;
  } catch {
    return false;
  }
}

export async function deleteMemoryFromWP(id: string | number): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_delete_memory', { memory_id: String(id) });
    return true;
  } catch {
    return false;
  }
}

/** No server "clear all" endpoint in v12.5.1 — loop-delete the current ids. */
export async function clearMemoriesInWP(): Promise<boolean> {
  try {
    const items = await getMemoriesFromWP();
    await Promise.all(items.map((m) => deleteMemoryFromWP(m.id)));
    return true;
  } catch {
    return false;
  }
}

// ===================== DATA SOURCES (user-scoped) =====================
// v12.5.1 bridge: notion + jira ONLY, credentials REQUIRED, NO OAuth start endpoint.

export const SUPPORTED_DATA_SOURCE_PROVIDERS = [
  { id: 'notion', label: 'Notion' },
  { id: 'jira', label: 'Jira' },
] as const;

export type SupportedProvider = typeof SUPPORTED_DATA_SOURCE_PROVIDERS[number]['id'];

export interface WPDataSource {
  id: number | string;
  provider: string;
  label: string;
  status?: string;
  created_at?: string;
}

export async function listDataSourcesWP(): Promise<WPDataSource[]> {
  if (!isWordPress()) return [];
  try {
    const d = await wpAjax('aicpp_user_list_data_sources');
    return Array.isArray(d?.data_sources) ? d.data_sources : [];
  } catch (e) {
    console.error('listDataSourcesWP', e);
    return [];
  }
}

export async function connectDataSourceWP(p: {
  provider: SupportedProvider;
  label?: string;
  credentials: string; // REQUIRED by v12.5.1 — no OAuth bypass
}): Promise<WPDataSource> {
  if (!p.credentials || !p.credentials.trim()) {
    throw new Error('Credentials are required for Notion / Jira in this version.');
  }
  const d = await wpAjax('aicpp_user_connect_data_source', {
    provider: p.provider,
    label: p.label || '',
    credentials: p.credentials,
  });
  if (!d?.id) throw new Error('Connection was not saved by the server.');
  return { id: d.id, provider: p.provider, label: p.label || p.provider, status: 'connected' };
}

export async function disconnectDataSourceWP(id: string | number): Promise<boolean> {
  try {
    await wpAjax('aicpp_user_disconnect_data_source', { data_source_id: String(id) });
    return true;
  } catch {
    return false;
  }
}

// NOTE: startDataSourceAuthWP intentionally REMOVED — the v12.5.1 bridge has
// no aicpp_user_start_data_source_auth endpoint. Re-adding it will 400.

// ===================== SMART ENGINE RATING =====================

export async function rateEngineResponse(
  rating: number,
  context?: { conversation_id?: string | number; message_id?: string | number; model?: string },
): Promise<boolean> {
  if (!isWordPress()) return false;
  try {
    const params: Record<string, string> = { rating: String(rating) };
    if (context?.conversation_id != null) params.conversation_id = String(context.conversation_id);
    if (context?.message_id != null) params.message_id = String(context.message_id);
    if (context?.model) params.model = context.model;
    await wpAjax('aicpp_engine_rate', params);
    return true;
  } catch (e) {
    console.error('rateEngineResponse failed:', e);
    return false;
  }
}
