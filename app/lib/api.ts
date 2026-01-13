/**
 * API client for the LLM Council backend.
 */

const API_BASE = '/api';

export const api = {
  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetch(`${API_BASE}/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId: string) {
    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Load server-side defaults for council configuration.
   */
  async getConfig() {
    const response = await fetch(`${API_BASE}/config`);
    if (!response.ok) {
      throw new Error('Failed to load configuration');
    }
    return response.json();
  },

  /**
   * Fetch available models from OpenRouter via backend proxy.
   */
  async listModels() {
    const response = await fetch(`${API_BASE}/models`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Failed to load models');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   */
  async sendMessageStream(
    conversationId: string,
    content: string,
    councilModels: Array<{ model: string; systemPrompt?: string }>,
    chairmanModel: string,
    onEvent: (eventType: string, event: any) => void,
    signal?: AbortSignal,
    mode: 'council' | 'roundtable' = 'council'
  ) {
    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, councilModels, chairmanModel, mode }),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },
};

