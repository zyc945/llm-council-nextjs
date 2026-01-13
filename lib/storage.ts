/**
 * JSON-based storage for conversations.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './config';

export interface Message {
  role: string;
  content?: string;
  stage1?: any[];
  stage2?: any[];
  stage3?: any;
  metadata?: any;
  // Roundtable fields
  roundtable_turns?: RoundtableTurn[];
  is_intervention?: boolean;
}

export interface RoundtableTurn {
  id: string; // Unique identifier for this turn
  role: 'assistant';
  model_id: string;
  model_name: string;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  title: string;
  messages: Message[];
  mode?: 'council' | 'roundtable';
  config?: any; // To store per-conversation settings
}

export interface ConversationMetadata {
  id: string;
  created_at: string;
  title: string;
  message_count: number;
}

function ensureDataDir() {
  /**
   * Ensure the data directory exists.
   */
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getConversationPath(conversationId: string): string {
  /**
   * Get the file path for a conversation.
   */
  return path.join(DATA_DIR, `${conversationId}.json`);
}

export function createConversation(conversationId: string): Conversation {
  /**
   * Create a new conversation.
   */
  ensureDataDir();

  const conversation: Conversation = {
    id: conversationId,
    created_at: new Date().toISOString(),
    title: 'New Conversation',
    messages: [],
  };

  // Save to file
  const filepath = getConversationPath(conversationId);
  fs.writeFileSync(filepath, JSON.stringify(conversation, null, 2));

  return conversation;
}

export function getConversation(conversationId: string): Conversation | null {
  /**
   * Load a conversation from storage.
   */
  const filepath = getConversationPath(conversationId);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  const data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data);
}

export function saveConversation(conversation: Conversation): void {
  /**
   * Save a conversation to storage.
   */
  ensureDataDir();

  const filepath = getConversationPath(conversation.id);
  fs.writeFileSync(filepath, JSON.stringify(conversation, null, 2));
}

export function listConversations(): ConversationMetadata[] {
  /**
   * List all conversations (metadata only).
   */
  ensureDataDir();

  const conversations: ConversationMetadata[] = [];

  if (!fs.existsSync(DATA_DIR)) {
    return conversations;
  }

  const files = fs.readdirSync(DATA_DIR);

  for (const filename of files) {
    if (filename.endsWith('.json')) {
      const filepath = path.join(DATA_DIR, filename);
      const data = fs.readFileSync(filepath, 'utf-8');
      const conv = JSON.parse(data);

      conversations.push({
        id: conv.id,
        created_at: conv.created_at,
        title: conv.title || 'New Conversation',
        message_count: conv.messages.length,
      });
    }
  }

  // Sort by creation time, newest first
  conversations.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return conversations;
}

export function addUserMessage(conversationId: string, content: string): void {
  /**
   * Add a user message to a conversation.
   */
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.messages.push({
    role: 'user',
    content,
  });

  saveConversation(conversation);
}

export function addAssistantMessage(
  conversationId: string,
  stage1: any[],
  stage2: any[],
  stage3: any,
  metadata: any
): void {
  /**
   * Add an assistant message with all 3 stages to a conversation.
   */
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.messages.push({
    role: 'assistant',
    stage1,
    stage2,
    stage3,
    metadata,
  });

  saveConversation(conversation);
}

export function saveRoundtableMessage(
  conversationId: string,
  turns: RoundtableTurn[]
): void {
  /**
   * Add or replace the last assistant message with complete roundtable turns.
   */
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  // Create the final message block
  const roundtableMessage: Message = {
    role: 'assistant',
    roundtable_turns: turns,
  };

  conversation.messages.push(roundtableMessage);
  saveConversation(conversation);
}

export function updateConversationTitle(
  conversationId: string,
  title: string
): void {
  /**
   * Update the title of a conversation.
   */
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.title = title;
  saveConversation(conversation);
}

