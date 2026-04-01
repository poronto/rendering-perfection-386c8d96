/**
 * WordPress AJAX API bridge
 * Reads config injected by versace22-enqueue.php via wp_localize_script
 */

interface WPConfig {
  ajaxurl: string;
  nonce: string;
  personaId: number;
  sessionId: string;
}

function getWPConfig(): WPConfig | null {
  const w = window as any;
  if (w.versace22_chat) {
    return {
      ajaxurl: w.versace22_chat.ajaxurl,
      nonce: w.versace22_chat.nonce,
      personaId: parseInt(w.versace22_chat.persona_id, 10) || 1,
      sessionId: w.versace22_chat.session_id || 'sess_' + crypto.randomUUID(),
    };
  }
  return null;
}

export function isWordPress(): boolean {
  return getWPConfig() !== null;
}

export async function sendMessageToWP(
  message: string,
  attachment?: { url: string; type: string; data?: string } | null
): Promise<string> {
  const config = getWPConfig();
  if (!config) throw new Error('WordPress config not available');

  const formData = new FormData();
  formData.append('action', 'aicpp_chat');
  formData.append('nonce', config.nonce);
  formData.append('persona_id', String(config.personaId));
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

export async function getConversationsFromWP() {
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

export async function loadConversationFromWP(conversationId: number) {
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

export async function deleteConversationFromWP(conversationId: number) {
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
