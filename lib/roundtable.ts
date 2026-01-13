/**
 * Orchestrator for the Roundtable (Multi-turn Discussion) Mode.
 */

import { queryModel } from './openrouter';
import { CHAIRMAN_MODEL } from './config';
import { Message, RoundtableTurn } from './storage';

interface Participant {
  id: string;
  name: string;
  systemPrompt?: string;
}

/**
 * Injects identity and context into the system prompt.
 */
function constructSystemPrompt(
  currentParticipant: Participant,
  allParticipants: Participant[],
  basePrompt?: string
): string {
  const otherParticipants = allParticipants
    .filter((p) => p.id !== currentParticipant.id)
    .map((p) => p.name)
    .join(', ');

  return `你现在正处于一个多方专家圆桌会议中。
你的身份是：${currentParticipant.name} (模型: ${currentParticipant.id})。
会议的其他参与者包括：${otherParticipants}。
你的目标是与其他专家进行深度碰撞，提出互补、修正或批判性的见解。

请遵循以下**极简对话原则**：
1. **内容精炼**：每次发言控制在 100-200 字左右。像真实聊天一样，只说最核心的观点。
2. **拒绝长篇大论**：禁止使用长列表、复杂的 Markdown 结构或冗长的背景介绍。
3. **即时回应**：仔细阅读之前的对话，直接回应其他参与者的具体观点。
4. **自然衔接**：避免空泛的客套，直接切入核心争论点，保持讨论的快节奏。

${basePrompt || currentParticipant.systemPrompt || ''}
`.trim();
}

/**
 * Formats historical messages for a specific model's context.
 */
function formatHistoryForModel(messages: Message[]): { role: string; content: string }[] {
  const formatted: { role: string; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      formatted.push({ role: 'user', content: msg.content || '' });
      continue;
    }

    // Handle standard single messages (like Stage 3 or previous turns)
    if (msg.model_name && msg.content) {
      formatted.push({
        role: 'assistant',
        content: `[${msg.model_name}]: ${msg.content}`,
      });
      continue;
    }

    // Handle merged roundtable turns
    if (msg.roundtable_turns) {
      for (const turn of msg.roundtable_turns) {
        formatted.push({
          role: 'assistant',
          content: `[${turn.model_name}]: ${turn.content}`,
        });
      }
      continue;
    }

    // Fallback
    if (msg.content) {
      formatted.push({ role: msg.role, content: msg.content });
    }
  }

  return formatted;
}

/**
 * Runs a single turn for a specific model in the roundtable.
 */
export async function runRoundtableTurn(
  modelId: string,
  modelName: string,
  history: Message[],
  allParticipants: Participant[],
  customSystemPrompt?: string
): Promise<string | null> {
  const formattedHistory = formatHistoryForModel(history);
  const systemPrompt = constructSystemPrompt(
    { id: modelId, name: modelName, systemPrompt: customSystemPrompt },
    allParticipants,
    customSystemPrompt
  );

  const response = await queryModel(modelId, formattedHistory, {
    systemPrompt,
  });

  return response?.content || null;
}

/**
 * Helper to determine the next speaker (Round-robin for now).
 */
export function getNextSpeaker(
  participants: Participant[],
  lastModelId?: string
): Participant {
  if (!lastModelId) return participants[0];

  const currentIndex = participants.findIndex((p) => p.id === lastModelId);
  const nextIndex = (currentIndex + 1) % participants.length;

  return participants[nextIndex];
}
