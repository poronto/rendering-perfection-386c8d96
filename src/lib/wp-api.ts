/**
 * WordPress AJAX API bridge — v12.3 compatible.
 * Reads config injected by versace22-enqueue.php via wp_localize_script.
 *
 * Endpoints covered:
 *  - Chat / upload / transcribe / speak (TTS)
 *  - Conversations: list / load / delete / pin / search / assign-to-project
 *  - Artifacts: list / get / save / delete (+ regex extraction from AI replies)
 *  - Admin (requires manage_options + admin_nonce): Memories CRUD, Projects CRUD,
 *    OpenRouter free models list/refresh.
 */

interface WPConfig {
  ajaxurl: string;
  nonce: string;         // aicpp_chat
  adminNonce: string;    // aicpp (admin-only)
  registerNonce: string;
  loginNonce: string;
  personaId: number;
  sessionId: string;
  userId: number;
  isAdmin: boolean;
  isSettingsPage: boolean;
}

function getWPConfig(): WPConfig | null {
  const w = window as any;
  if (!w.versace22_chat) return null;
  const c = w.versace22_chat;
  return {
    ajaxurl: c.ajaxurl,
    nonce: c.nonce,
    adminNonce: c.admin_nonce || '',
    registerNonce: c.register_nonce || '',
    loginNonce: c.login_nonce || '',
    personaId: parseInt(c.persona_id, 10) || 1,
    sessionId: c.session_id || 'sess_' + crypto.randomUUID(),
    userId: parseInt(c.user_id, 10) || 0,
    isAdmin: !!c.is_admin,
    isSettingsPage: !!c.is_settings_page ||
      (typeof document !== 'undefined' && document.body?.classList?.contains('aicpp-settings-page')),
  };
}

export function isWordPress(): boolean {
  return getWPConfig() !== null;
}
export function isWPAdmin(): boolean {
  return !!getWPConfig()?.isAdmin;
}
export function isWPSettingsPage(): boolean {
  return !!getWPConfig()?.isSettingsPage;
}
export function getWPPersonaId(): number {
  return getWPConfig()?.personaId ?? 1;
}
export function getWPSessionId(): string {
  return getWPConfig()?.sessionId ?? '';
}
export function getWPUserId(): number {
  return getWPConfig()?.userId ?? 0;
}

async function wpFetch(action: string, fields: Record<string, string | Blob | number>, useAdminNonce = false) {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');
  const fd = new FormData();
  fd.append('action', action);
  fd.append('nonce', useAdminNonce ? config.adminNonce : config.nonce);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    fd.append(k, typeof v === 'number' ? String(v) : (v as any));
  }
  const r = await fetch(config.ajaxurl, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Server error: ${r.status}`);
  const j = await r.json();
  if (!j.success) throw new Error(j.data?.message || `${action} failed`);
  return j.data;
}

// ===================== ARTIFACT EXTRACTION =====================

export interface ParsedArtifact {
  type: string;
  title: string;
  content: string;
}

/**
 * Extracts <artifact type="..." title="...">...</artifact> blocks from an AI reply.
 * Mirrors the backend regex in extract_and_save_artifacts().
 */
export function extractArtifacts(reply: string): { cleanText: string; artifacts: ParsedArtifact[] } {
  const artifacts: ParsedArtifact[] = [];
  if (!reply) return { cleanText: reply, artifacts };

  // 1. <artifact type="..." title="...">...</artifact>
  const tagRe = /<artifact\s+type="([a-zA-Z0-9_-]+)"(?:\s+title="([^"]*)")?>([\s\S]+?)<\/artifact>/gi;
  let cleanText = reply.replace(tagRe, (_m, type: string, title: string | undefined, content: string) => {
    const t = (type || 'code').toLowerCase();
    const ti = (title || 'Artifact').trim();
    artifacts.push({ type: t, title: ti, content: content.trim() });
    return `\n\n🎨 _Artifact: ${ti} (${t})_\n\n`;
  });

  // 2. Fenced code blocks with renderable types: html, svg, markdown, react, jsx, tsx
  const FENCE_TYPES = new Set(['html', 'svg', 'markdown', 'md', 'react', 'jsx', 'tsx']);
  const fenceRe = /```([a-zA-Z0-9_+-]+)\s*\n([\s\S]+?)```/g;
  let idx = 1;
  cleanText = cleanText.replace(fenceRe, (match, lang: string, body: string) => {
    const t = lang.toLowerCase();
    if (!FENCE_TYPES.has(t)) return match;
    const normalized = t === 'md' ? 'markdown' : (t === 'jsx' || t === 'tsx' ? 'react' : t);
    const title = `${normalized.toUpperCase()} snippet ${idx++}`;
    artifacts.push({ type: normalized, title, content: body.trim() });
    return `\n\n🎨 _Artifact: ${title} (${normalized})_\n\n`;
  });

  return { cleanText, artifacts };
}

// ===================== CHAT =====================

export interface ChatReply {
  message: string;
  cleanText: string;
  artifacts: ParsedArtifact[];
  tokens?: number;
  conversationId?: number;
}

export async function sendMessageToWP(
  message: string,
  attachment?: { url: string; type: string; data?: string } | null,
): Promise<ChatReply> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const fd = new FormData();
  fd.append('action', 'aicpp_chat');
  fd.append('nonce', config.nonce);
  fd.append('persona_id', String(config.personaId));
  fd.append('message', message);
  fd.append('session_id', config.sessionId);

  if (attachment) {
    fd.append('has_attachment', '1');
    fd.append('attachment_url', attachment.url);
    fd.append('attachment_type', attachment.type);
    if (attachment.data) fd.append('attachment_data', attachment.data);
  }

  const r = await fetch(config.ajaxurl, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Server error: ${r.status}`);
  const j = await r.json();
  if (!j.success) throw new Error(j.data?.message || 'Chat request failed');

  const raw = j.data.message as string;
  const { cleanText, artifacts } = extractArtifacts(raw);
  return {
    message: raw,
    cleanText,
    artifacts,
    tokens: j.data.tokens,
    conversationId: j.data.conversation_id,
  };
}

// Backwards-compat helper for callers that only need the text.
export async function sendMessageToWPText(
  message: string,
  attachment?: { url: string; type: string; data?: string } | null,
): Promise<string> {
  return (await sendMessageToWP(message, attachment)).message;
}

// ===================== FILE UPLOAD =====================

export async function uploadFileToWP(file: File): Promise<{
  file_url: string;
  file_name: string;
  file_type: string;
  file_data?: string;
}> {
  return wpFetch('aicpp_upload_file', { file });
}

// ===================== AUDIO TRANSCRIPTION =====================

export async function transcribeAudioWP(audioBlob: Blob): Promise<string> {
  const data = await wpFetch('aicpp_transcribe_audio', { audio: new File([audioBlob], 'recording.webm') });
  return data.text;
}

// ===================== TEXT-TO-SPEECH =====================

export async function speakTextWP(text: string, voice = 'alloy'): Promise<string> {
  const data = await wpFetch('aicpp_speak', { text, voice });
  return data.audio as string; // data:audio/mpeg;base64,...
}

// ===================== CONVERSATIONS =====================

export interface WPConversation {
  id: number;
  title: string;
  token_count: number;
  created_at: string;
  updated_at: string;
  pinned?: number;
  project_id?: number | null;
}

export interface WPMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getConversationsFromWP(): Promise<WPConversation[]> {
  const config = getWPConfig();
  if (!config) return [];
  const data = await wpFetch('aicpp_get_conversations', { session_id: config.sessionId });
  return data.conversations || [];
}

export async function loadConversationFromWP(conversationId: number): Promise<{
  messages: WPMessage[];
  session_id: string;
  persona_id: number;
} | null> {
  try {
    return await wpFetch('aicpp_load_conversation', { conversation_id: conversationId });
  } catch {
    return null;
  }
}

export async function deleteConversationFromWP(conversationId: number): Promise<boolean> {
  try {
    await wpFetch('aicpp_delete_conversation', { conversation_id: conversationId });
    return true;
  } catch {
    return false;
  }
}

export async function pinConversationWP(conversationId: number, pinned?: boolean): Promise<{ conversation_id: number; pinned: number }> {
  const fields: Record<string, number> = { conversation_id: conversationId };
  if (pinned !== undefined) fields.pinned = pinned ? 1 : 0;
  return wpFetch('aicpp_pin_conversation', fields);
}

export interface WPSearchHit {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  title: string;
}

export async function searchMessagesWP(query: string): Promise<WPSearchHit[]> {
  if (query.trim().length < 2) return [];
  const data = await wpFetch('aicpp_search_messages', { query });
  return data.results || [];
}

export async function assignConversationProjectWP(conversationId: number, projectId: number): Promise<void> {
  await wpFetch('aicpp_assign_conversation_project', {
    conversation_id: conversationId,
    project_id: projectId,
  });
}

// ===================== ARTIFACTS =====================

export interface WPArtifact {
  id: number;
  title: string;
  artifact_type: string;
  content?: string;
  version: number;
  updated_at: string;
}

export async function listArtifactsWP(conversationId: number): Promise<WPArtifact[]> {
  const data = await wpFetch('aicpp_list_artifacts', { conversation_id: conversationId });
  return data.artifacts || [];
}

export async function getArtifactWP(artifactId: number): Promise<WPArtifact | null> {
  try {
    return await wpFetch('aicpp_get_artifact', { artifact_id: artifactId });
  } catch {
    return null;
  }
}

export async function saveArtifactWP(payload: {
  id?: number;
  title: string;
  type: string;
  content: string;
  conversationId?: number;
}): Promise<number> {
  const data = await wpFetch('aicpp_save_artifact', {
    artifact_id: payload.id ?? 0,
    title: payload.title,
    artifact_type: payload.type,
    content: payload.content,
    conversation_id: payload.conversationId ?? 0,
  });
  return data.id as number;
}

export async function deleteArtifactWP(artifactId: number): Promise<void> {
  await wpFetch('aicpp_delete_artifact', { artifact_id: artifactId });
}

// ===================== MEMORIES (admin only) =====================

export interface WPMemory {
  id: number;
  persona_id: number;
  memory_text: string;
  enabled: number;
}

export async function getMemoriesWP(userId: number): Promise<WPMemory[]> {
  const data = await wpFetch('aicpp_get_memories', { user_id: userId }, true);
  return data.memories || [];
}
export async function addMemoryWP(userId: number, personaId: number, text: string): Promise<number> {
  const data = await wpFetch('aicpp_add_memory', { user_id: userId, persona_id: personaId, memory_text: text }, true);
  return data.id as number;
}
export async function updateMemoryWP(memoryId: number, text: string): Promise<void> {
  await wpFetch('aicpp_update_memory', { memory_id: memoryId, memory_text: text }, true);
}
export async function deleteMemoryWP(memoryId: number): Promise<void> {
  await wpFetch('aicpp_delete_memory', { memory_id: memoryId }, true);
}
export async function toggleMemoryWP(memoryId: number): Promise<void> {
  await wpFetch('aicpp_toggle_memory', { memory_id: memoryId }, true);
}

// ===================== PROJECTS (admin only) =====================

export interface WPProject {
  id: number;
  name: string;
  description: string;
  custom_instructions: string;
}

export async function getProjectsWP(): Promise<WPProject[]> {
  const data = await wpFetch('aicpp_get_projects', {}, true);
  return data.projects || [];
}
export async function createProjectWP(name: string, description = '', customInstructions = ''): Promise<number> {
  const data = await wpFetch('aicpp_create_project', { name, description, custom_instructions: customInstructions }, true);
  return data.id as number;
}
export async function updateProjectWP(id: number, fields: Partial<WPProject>): Promise<void> {
  await wpFetch('aicpp_update_project', { project_id: id, ...fields as any }, true);
}
export async function deleteProjectWP(id: number): Promise<void> {
  await wpFetch('aicpp_delete_project', { project_id: id }, true);
}
export async function attachProjectFileWP(projectId: number, fileName: string, contentExcerpt: string): Promise<number> {
  const data = await wpFetch('aicpp_attach_project_file', {
    project_id: projectId,
    file_name: fileName,
    content_excerpt: contentExcerpt,
  }, true);
  return data.id as number;
}
export async function detachProjectFileWP(fileId: number): Promise<void> {
  await wpFetch('aicpp_detach_project_file', { file_id: fileId }, true);
}

// ===================== OPENROUTER FREE MODELS (admin settings) =====================

export interface WPORModel {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt: string; completion: string };
}

export async function getORFreeModelsWP(): Promise<WPORModel[]> {
  const data = await wpFetch('aicpp_or_free_models', {}, true);
  return data.models || [];
}
export async function refreshORFreeModelsWP(): Promise<WPORModel[]> {
  const data = await wpFetch('aicpp_or_refresh_free', {}, true);
  return data.models || [];
}

// ===================== USER REGISTRATION / WP USER INFO =====================

export async function registerUserWP(data: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}): Promise<{ user_id: number; display_name: string }> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');
  const fd = new FormData();
  fd.append('action', 'aicpp_register_user');
  fd.append('nonce', config.registerNonce || config.nonce);
  fd.append('username', data.username);
  fd.append('email', data.email);
  fd.append('password', data.password);
  if (data.display_name) fd.append('display_name', data.display_name);
  const r = await fetch(config.ajaxurl, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Registration error: ${r.status}`);
  const j = await r.json();
  if (!j.success) throw new Error(j.data?.message || 'Registration failed');
  return j.data;
}

export function getWPUserInfo(): { isLoggedIn: boolean; displayName: string } {
  const w = window as any;
  if (w.versace22_chat?.user_logged_in) {
    return { isLoggedIn: true, displayName: w.versace22_chat.user_display_name || 'User' };
  }
  if (w.versace22_chat) return { isLoggedIn: false, displayName: 'Guest' };
  return { isLoggedIn: false, displayName: 'Guest' };
}
