/**
 * WordPress AJAX API bridge — v12.6-compatible (BrandLock)
 *
 * Reads config injected by versace22-enqueue.php via wp_localize_script.
 *
 * Bridge contract (v12.6):
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

// ===================== ENDPOINT MANIFEST (bridge-driven) =====================
/**
 * The bridge injects `endpoints[group][key] = { action, nonce, nopriv }`.
 * We resolve actions dynamically and fall back to the hardcoded name so the UI
 * keeps working with older bridges.
 */
export function resolveEndpoint(
  group: string,
  key: string,
  fallbackAction: string,
  fallbackNonce: NonceGroup = 'aicpp_chat',
): { action: string; nonce: NonceGroup; available: boolean } {
  const w = window as any;
  const eps = (w.versace22_chat || w.aicppChat)?.endpoints;
  const entry = eps?.[group]?.[key];
  if (entry?.action) {
    return { action: entry.action, nonce: (entry.nonce || fallbackNonce) as NonceGroup, available: true };
  }
  return { action: fallbackAction, nonce: fallbackNonce, available: false };
}

/**
 * Manifest-aware wpAjax: resolves the action + nonce group from the bridge
 * manifest (window.versace22_chat.endpoints) and falls back to the hardcoded
 * action name so older bridges keep working.
 */
async function wpAjaxEp(
  group: string,
  key: string,
  fallbackAction: string,
  params: Record<string, string> = {},
): Promise<any> {
  const ep = resolveEndpoint(group, key, fallbackAction);
  return wpAjax(ep.action, params, ep.nonce);
}

export function hasEndpoint(group: string, key: string): boolean {
  return resolveEndpoint(group, key, '', 'aicpp_chat').available;
}

export function getBridgeInfo() {
  const w = window as any;
  const cfg = w.versace22_chat || w.aicppChat;
  return {
    bridgeVersion: cfg?.bridge_version || '',
    pluginVersion: cfg?.plugin_version || '',
    integrationMode: cfg?.integration_mode || '',
    isAdmin: !!cfg?.is_admin,
    userId: Number(cfg?.user_id || 0),
  };
}

// ===================== CHAT =====================

export interface WPEngineMeta {
  mode?: string;                 // router | council | hybrid
  category?: string;
  model?: string;
  members?: string[];
  judge?: string;
}

export interface WPChatResponse {
  message: string;
  conversation_id?: number;
  tokens?: number;
  engine?: WPEngineMeta | null;
  new_artifacts?: number[];
  open_artifact?: number;
}

async function postChat(
  action: string,
  message: string,
  attachment?: { url: string; type: string; data?: string } | null,
  extra: Record<string, string> = {},
): Promise<WPChatResponse> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const formData = new FormData();
  formData.append('action', action);
  formData.append('nonce', config.nonces['aicpp_chat'] || config.nonce);
  formData.append('message', message);
  formData.append('session_id', config.sessionId);
  for (const [k, v] of Object.entries(extra)) formData.append(k, v);

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
  const d = result.data || {};
  return {
    message: d.message,
    conversation_id: d.conversation_id != null ? Number(d.conversation_id) : undefined,
    tokens: d.tokens != null ? Number(d.tokens) : undefined,
    engine: d.engine || null,
    new_artifacts: Array.isArray(d.new_artifacts) ? d.new_artifacts.map(Number) : [],
    open_artifact: d.open_artifact ? Number(d.open_artifact) : undefined,
  };
}

/** Persona chat — aicpp_chat */
export async function sendMessageToWP(
  message: string,
  attachment?: { url: string; type: string; data?: string } | null,
  personaId?: string | number,
  conversationId?: string | number | null,
): Promise<WPChatResponse> {
  const config = getWPConfig();
  const ep = resolveEndpoint('chat', 'chat', 'aicpp_chat');
  const extra: Record<string, string> = {
    persona_id: String(personaId || config?.personaId || 1),
  };
  if (conversationId) extra.conversation_id = String(conversationId);
  return postChat(ep.action, message, attachment, extra);
}

/** Main Site Character chat — aicpp_chat_main (no persona) */
export async function sendMessageToMainWP(
  message: string,
  attachment?: { url: string; type: string; data?: string } | null,
  conversationId?: string | number | null,
): Promise<WPChatResponse> {
  const ep = resolveEndpoint('chat', 'chat_main', 'aicpp_chat_main');
  const extra: Record<string, string> = {};
  if (conversationId) extra.conversation_id = String(conversationId);
  return postChat(ep.action, message, attachment, extra);
}

export function hasMainCharacterEndpoint(): boolean {
  return hasEndpoint('chat', 'chat_main');
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
  pinned?: number | boolean;
  is_pinned?: number | boolean;
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
    const data = await wpAjaxEp('user_projects','list','aicpp_user_list_projects');
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
  const data = await wpAjaxEp('user_projects','create','aicpp_user_create_project', {
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
    await wpAjaxEp('user_projects','update','aicpp_user_update_project', {
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
    await wpAjaxEp('user_projects','delete','aicpp_user_delete_project', { project_id: String(id) });
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
    await wpAjaxEp('user_projects','assign_conversation','aicpp_user_assign_conversation_project', {
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
    const data = await wpAjaxEp('user_memories','list','aicpp_user_get_memories');
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
  const data = await wpAjaxEp('user_memories','add','aicpp_user_add_memory', {
    memory_text: content,
    content,
    persona_id: String(personaId),
  });
  return data?.id ? { id: data.id, content } : null;
}

export async function updateMemoryInWP(id: string | number, content: string): Promise<boolean> {
  try {
    await wpAjaxEp('user_memories','update','aicpp_user_update_memory', { memory_id: String(id), memory_text: content });
    return true;
  } catch {
    return false;
  }
}

export async function toggleMemoryInWP(id: string | number): Promise<boolean> {
  try {
    await wpAjaxEp('user_memories','toggle','aicpp_user_toggle_memory', { memory_id: String(id) });
    return true;
  } catch {
    return false;
  }
}

export async function deleteMemoryFromWP(id: string | number): Promise<boolean> {
  try {
    await wpAjaxEp('user_memories','delete','aicpp_user_delete_memory', { memory_id: String(id) });
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
    const d = await wpAjaxEp('data_sources','list','aicpp_user_list_data_sources');
    // Bridge returns `data_sources`; the projects-memory fallback owner returns
    // `sources`. Accept either so the list never silently renders empty.
    const list = d?.data_sources ?? d?.sources;
    return Array.isArray(list) ? list : [];
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
  const d = await wpAjaxEp('data_sources','connect','aicpp_user_connect_data_source', {
    provider: p.provider,
    label: p.label || '',
    credentials: p.credentials,
  });
  if (!d?.id) throw new Error('Connection was not saved by the server.');
  return { id: d.id, provider: p.provider, label: p.label || p.provider, status: 'connected' };
}

export async function disconnectDataSourceWP(id: string | number): Promise<boolean> {
  try {
    // `data_source_id` is the bridge contract; `source_id` keeps the fallback
    // owner working. Sending both is harmless on either side.
    await wpAjaxEp('data_sources','disconnect','aicpp_user_disconnect_data_source', {
      data_source_id: String(id),
      source_id: String(id),
    });
    return true;
  } catch {
    return false;
  }
}

// NOTE: startDataSourceAuthWP intentionally REMOVED — the v12.5.1 bridge has
// no aicpp_user_start_data_source_auth endpoint. Re-adding it will 400.

// ===================== SMART ENGINE (rating) =====================
// v12.6 contract: aicpp_engine_rate expects model_id + category + rating (1..5).

export async function rateEngineResponse(
  liked: boolean,
  context?: { model?: string; category?: string },
): Promise<boolean> {
  if (!isWordPress()) return false;
  if (!context?.model) return false; // server rejects ratings without a known model
  try {
    const ep = resolveEndpoint('engine', 'rate', 'aicpp_engine_rate');
    await wpAjax(
      ep.action,
      {
        model_id: context.model,
        category: context.category || 'general',
        rating: liked ? '5' : '1',
      },
      ep.nonce,
    );
    return true;
  } catch (e: any) {
    // v12.6 rejects ratings for models that have no card row. Surface the real
    // cause so it isn't mistaken for a broken rating button.
    if (String(e?.message || '').toLowerCase().includes('unknown model')) {
      console.warn(
        'Engine rating rejected: model card missing. Run "Seed / refresh default cards" in the plugin admin.',
      );
    } else {
      console.error('rateEngineResponse failed:', e);
    }
    return false;
  }
}

// ===================== ARTIFACTS =====================

export interface WPArtifact {
  id: number;
  title: string;
  artifact_type: string;
  version?: number;
  updated_at?: string;
  content?: string;
  conversation_id?: number;
}

export async function listArtifactsWP(conversationId: string | number): Promise<WPArtifact[]> {
  if (!isWordPress() || !conversationId) return [];
  try {
    const ep = resolveEndpoint('artifacts', 'list', 'aicpp_list_artifacts');
    const d = await wpAjax(ep.action, { conversation_id: String(conversationId) }, ep.nonce);
    return Array.isArray(d?.artifacts) ? d.artifacts : [];
  } catch (e) {
    console.error('listArtifactsWP failed:', e);
    return [];
  }
}

export async function getArtifactWP(id: string | number): Promise<WPArtifact | null> {
  try {
    const ep = resolveEndpoint('artifacts', 'get', 'aicpp_get_artifact');
    const d = await wpAjax(ep.action, { artifact_id: String(id) }, ep.nonce);
    return d ? (d as WPArtifact) : null;
  } catch (e) {
    console.error('getArtifactWP failed:', e);
    return null;
  }
}

export async function saveArtifactWP(a: {
  id?: string | number;
  conversationId?: string | number | null;
  title: string;
  type: string;
  content: string;
}): Promise<number | null> {
  try {
    const ep = resolveEndpoint('artifacts', 'save', 'aicpp_save_artifact');
    const d = await wpAjax(
      ep.action,
      {
        artifact_id: a.id ? String(a.id) : '0',
        conversation_id: a.conversationId ? String(a.conversationId) : '0',
        title: a.title,
        artifact_type: a.type,
        content: a.content,
      },
      ep.nonce,
    );
    return d?.id ? Number(d.id) : null;
  } catch (e) {
    console.error('saveArtifactWP failed:', e);
    return null;
  }
}

export async function deleteArtifactWP(id: string | number): Promise<boolean> {
  try {
    const ep = resolveEndpoint('artifacts', 'delete', 'aicpp_delete_artifact');
    await wpAjax(ep.action, { artifact_id: String(id) }, ep.nonce);
    return true;
  } catch {
    return false;
  }
}

// ===================== REWARDS (referrals + leaderboard) =====================

export interface WPReferralData {
  referral_code: string;
  referral_link: string;
  referred_count: number;
  points: number;
}

export interface WPLeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  points: number;
  badge: string;
  avatar?: string;
}

export async function getReferralDataWP(): Promise<WPReferralData | null> {
  if (!isWordPress() || !isWPUserLoggedIn()) return null;
  try {
    const ep = resolveEndpoint('rewards', 'referrals', 'aicpp_get_referral_data');
    const d = await wpAjax(ep.action, {}, ep.nonce);
    return {
      referral_code: d?.referral_code || '',
      referral_link: d?.referral_link || '',
      referred_count: Number(d?.referred_count || 0),
      points: Number(d?.points || 0),
    };
  } catch (e) {
    console.error('getReferralDataWP failed:', e);
    return null;
  }
}

export async function getLeaderboardWP(): Promise<WPLeaderboardEntry[]> {
  if (!isWordPress()) return [];
  try {
    const ep = resolveEndpoint('rewards', 'leaderboard', 'aicpp_get_leaderboard');
    const d = await wpAjax(ep.action, {}, ep.nonce);
    return Array.isArray(d?.leaderboard) ? d.leaderboard : [];
  } catch (e) {
    console.error('getLeaderboardWP failed:', e);
    return [];
  }
}


// ===================== v12.6: SPEAK / SEARCH / PIN =====================

export type WPVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/**
 * Text-to-speech via the plugin's `aicpp_speak` endpoint (OpenAI TTS).
 * Returns a data: URL with the MP3 payload, or null when unavailable.
 */
export async function speakTextWP(text: string, voice: WPVoice = 'alloy'): Promise<string | null> {
  if (!isWordPress()) return null;
  try {
    const d = await wpAjaxEp('chat', 'speak', 'aicpp_speak', {
      text: text.slice(0, 2500),
      voice,
    });
    return d?.audio || null;
  } catch (e) {
    console.error('speakTextWP failed:', e);
    throw e;
  }
}

export interface WPMessageSearchResult {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  title: string;
}

/** Full-text (LIKE) search across the user's messages — `aicpp_search_messages`. */
export async function searchMessagesWP(query: string): Promise<WPMessageSearchResult[]> {
  if (!isWordPress() || query.trim().length < 2) return [];
  try {
    const d = await wpAjaxEp('chat', 'search_messages', 'aicpp_search_messages', { query: query.trim() });
    return Array.isArray(d?.results) ? d.results : [];
  } catch (e) {
    console.error('searchMessagesWP failed:', e);
    return [];
  }
}

/** Toggle (or explicitly set) the pinned flag on a conversation — `aicpp_pin_conversation`. */
export async function pinConversationWP(
  conversationId: string | number,
  pinned?: boolean,
): Promise<boolean | null> {
  if (!isWordPress()) return null;
  try {
    const params: Record<string, string> = { conversation_id: String(conversationId) };
    if (pinned !== undefined) params.pinned = pinned ? '1' : '0';
    const d = await wpAjaxEp('conversations', 'pin', 'aicpp_pin_conversation', params);
    return Number(d?.pinned) === 1;
  } catch (e) {
    console.error('pinConversationWP failed:', e);
    return null;
  }
}
