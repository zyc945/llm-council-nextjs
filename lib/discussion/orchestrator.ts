/**
 * Discussion Orchestrator - manages multi-agent collaborative discussions
 *
 * Uses pi-agent-core for agent runtime with event streaming.
 */

import { Agent } from '@mariozechner/pi-agent-core';
import { getModel, Context, stream } from '@mariozechner/pi-ai';
import { AgentRole, buildSystemPrompt, DEFAULT_ROLES } from '../roles';
import { v4 as uuidv4 } from 'uuid';
import { detectConsensusByHeuristics } from './consensus';

/**
 * Discussion message structure
 */
export interface DiscussionMessage {
  id: string;
  round: number;
  speakerId: string;
  speakerName: string;
  speakerNameEn: string;
  speakerAvatar: string;
  speakerColor: string;
  content: string;
  timestamp: number;
  sentiment?: 'agree' | 'disagree' | 'neutral' | 'question';
}

/**
 * User intervention types
 */
export type InterventionType = 'redirect' | 'correction' | 'deep_dive' | 'terminate';

export interface UserIntervention {
  id: string;
  type: InterventionType;
  content: string;
  insertedAt: number; // Message index where this was inserted
  timestamp: number;
}

/**
 * Discussion status
 */
export type DiscussionStatus = 'running' | 'paused' | 'completed' | 'terminated';

/**
 * Discussion configuration
 */
export interface DiscussionConfig {
  topic: string;
  roles: AgentRole[];
  maxRounds: number;          // Default: 20
  consensusThreshold: number; // Default: 0.85
}

/**
 * Discussion state
 */
export interface DiscussionState {
  id: string;
  config: DiscussionConfig;
  currentRound: number;
  currentSpeakerIndex: number;
  messages: DiscussionMessage[];
  status: DiscussionStatus;
  consensusDetected: boolean;
  userInterventions: UserIntervention[];
  createdAt: number;
  completedAt?: number;
}

/**
 * SSE Event types for discussion streaming
 */
export type DiscussionEventType =
  | 'discussion_start'
  | 'discussion_complete'
  | 'discussion_terminated'
  | 'round_start'
  | 'round_complete'
  | 'agent_thinking'
  | 'agent_speaking'
  | 'message_delta'
  | 'message_complete'
  | 'consensus_check'
  | 'user_intervention'
  | 'error';

export interface DiscussionEvent {
  type: DiscussionEventType;
  state?: DiscussionState;
  message?: DiscussionMessage;
  round?: number;
  speakerId?: string;
  intervention?: UserIntervention;
  error?: string;
  reason?: 'max_rounds' | 'consensus' | 'user_terminated';
}

/**
 * Discussion Orchestrator Class
 *
 * Manages the lifecycle of a multi-agent discussion:
 * - Initializes agents with different roles
 * - Controls turn order (round-robin)
 * - Detects consensus
 * - Handles user interventions
 * - Streams events via SSE
 */
export class DiscussionOrchestrator {
  public state: DiscussionState;
  private agents: Map<string, Agent>;
  private currentAbortController: AbortController | null = null;
  private consensusHistory: string[] = [];

  constructor(config: DiscussionConfig) {
    this.state = {
      id: uuidv4(),
      config,
      currentRound: 1,
      currentSpeakerIndex: 0,
      messages: [],
      status: 'running',
      consensusDetected: false,
      userInterventions: [],
      createdAt: Date.now()
    };

    this.agents = new Map();
    this.initializeAgents(config.roles, config.topic);
  }

  /**
   * Initialize agents for each role
   */
  private initializeAgents(roles: AgentRole[], topic: string): void {
    for (const role of roles) {
      const systemPrompt = buildSystemPrompt(role, topic);

      const agent = new Agent({
        initialState: {
          systemPrompt,
          model: getModel(role.modelProvider as any, role.modelName),
        },
      });

      this.agents.set(role.id, agent);
    }
  }

  /**
   * Start the discussion and stream events
   */
  async *start(): AsyncGenerator<DiscussionEvent> {
    yield { type: 'discussion_start', state: this.state };

    while (this.state.status === 'running') {
      // Check termination conditions
      if (this.state.currentRound > this.state.config.maxRounds) {
        this.state.status = 'completed';
        this.state.completedAt = Date.now();
        yield { type: 'discussion_complete', reason: 'max_rounds' };
        break;
      }

      // Check consensus
      if (this.checkConsensus()) {
        this.state.consensusDetected = true;
        this.state.status = 'completed';
        this.state.completedAt = Date.now();
        yield { type: 'discussion_complete', reason: 'consensus' };
        break;
      }

      // Get current speaker
      const currentRole = this.state.config.roles[this.state.currentSpeakerIndex];
      const agent = this.agents.get(currentRole.id);

      if (!agent) {
        yield {
          type: 'error',
          error: `Agent not found for role: ${currentRole.id}`
        };
        break;
      }

      yield {
        type: 'round_start',
        round: this.state.currentRound,
        speakerId: currentRole.id
      };

      // Build conversation history as prompt
      const conversationHistory = this.buildConversationHistory();

      // Subscribe to agent events for streaming
      const unsubscribe = agent.subscribe((event) => {
        this.handleAgentEvent(event, currentRole);
      });

      try {
        // Prompt the agent
        await agent.prompt(conversationHistory);
      } catch (error: any) {
        yield { type: 'error', error: error.message };
      } finally {
        unsubscribe();
      }

      // Move to next speaker
      this.state.currentSpeakerIndex =
        (this.state.currentSpeakerIndex + 1) % this.state.config.roles.length;

      // Increment round when we complete a full cycle
      if (this.state.currentSpeakerIndex === 0) {
        yield { type: 'round_complete', round: this.state.currentRound };
        this.state.currentRound++;
      }
    }
  }

  /**
   * Build conversation history for agent context
   */
  private buildConversationHistory(): string {
    if (this.state.messages.length === 0) {
      return `The discussion is just starting. Please share your initial perspective on the topic.`;
    }

    const history: string[] = [];
    history.push(`Discussion Topic: "${this.state.config.topic}"\n`);
    history.push(`Previous messages:\n`);

    // Show last 10 messages for context window management
    const recentMessages = this.state.messages.slice(-10);

    for (const msg of recentMessages) {
      history.push(`[${msg.speakerNameEn}]: ${msg.content}\n`);
    }

    const lastMessage = recentMessages[recentMessages.length - 1];
    if (lastMessage) {
      history.push(`\nPlease respond to the discussion above, particularly addressing points from ${lastMessage.speakerNameEn} when relevant.`);
    }

    return history.join('');
  }

  /**
   * Handle agent streaming events
   */
  private handleAgentEvent(event: any, role: AgentRole): void {
    // We need to translate pi-agent events to our discussion events
    // This is a simplified version - full implementation would handle all event types

    if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
      // Streaming content
      // In a full implementation, we'd track partial content here
    }
  }

  /**
   * Check if consensus has been reached
   */
  private checkConsensus(): boolean {
    const messages = this.state.messages;

    // Need at least 6 messages to check consensus
    if (messages.length < 6) {
      return false;
    }

    // Use the heuristic-based consensus detection
    const result = detectConsensusByHeuristics(messages, this.state.config.consensusThreshold);
    return result.detected;
  }

  /**
   * Intervene in the discussion
   */
  async intervene(type: InterventionType, content: string): Promise<void> {
    const intervention: UserIntervention = {
      id: uuidv4(),
      type,
      content,
      insertedAt: this.state.messages.length,
      timestamp: Date.now()
    };

    this.state.userInterventions.push(intervention);

    // Get current agent and steer it
    const currentRole = this.state.config.roles[this.state.currentSpeakerIndex];
    const agent = this.agents.get(currentRole.id);

    if (agent) {
      const interventionTypeText = {
        redirect: 'Discussion Moderator',
        correction: 'Fact Checker',
        deep_dive: 'Discussion Moderator',
        terminate: 'System'
      }[type];

      agent.steer({
        role: 'user',
        content: `[${interventionTypeText}]: ${content}`,
        timestamp: Date.now()
      });

      // Yield event (caller should be listening)
      return Promise.resolve();
    }
  }

  /**
   * Terminate the discussion early
   */
  terminate(): void {
    this.state.status = 'terminated';
    this.state.completedAt = Date.now();

    // Abort all agents
    this.agents.forEach(agent => agent.abort());
    this.currentAbortController?.abort();
  }

  /**
   * Get current state snapshot
   */
  getState(): DiscussionState {
    return { ...this.state };
  }

  /**
   * Add a message to the discussion (called after agent completes)
   */
  addMessage(message: DiscussionMessage): void {
    this.state.messages.push(message);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.agents.forEach(agent => {
      agent.abort();
      agent.clearMessages();
    });
    this.agents.clear();
  }
}

/**
 * Active discussions registry (in-memory, for single-server deployment)
 * For production, use Redis or similar for distributed state
 */
const activeDiscussions = new Map<string, DiscussionOrchestrator>();

/**
 * Get or create a discussion orchestrator
 */
export function getOrCreateDiscussion(
  id: string,
  config?: DiscussionConfig
): DiscussionOrchestrator | undefined {
  if (config) {
    const orchestrator = new DiscussionOrchestrator(config);
    activeDiscussions.set(id, orchestrator);
    return orchestrator;
  }
  return activeDiscussions.get(id);
}

/**
 * Remove a discussion from the registry
 */
export function removeDiscussion(id: string): void {
  const discussion = activeDiscussions.get(id);
  if (discussion) {
    discussion.cleanup();
  }
  activeDiscussions.delete(id);
}

/**
 * Get all active discussions
 */
export function getActiveDiscussions(): Map<string, DiscussionOrchestrator> {
  return activeDiscussions;
}
