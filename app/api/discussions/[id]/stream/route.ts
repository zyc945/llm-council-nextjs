/**
 * API route for multi-agent discussion streaming.
 *
 * Endpoints:
 * - POST /api/discussions/[id]/stream - Start a discussion
 * - PATCH /api/discussions/[id]/stream - User intervention
 * - DELETE /api/discussions/[id]/stream - Terminate discussion
 */

import { NextRequest } from 'next/server';
import {
  getConversation,
  saveConversation,
} from '@/lib/storage';
import {
  DiscussionOrchestrator,
  DiscussionConfig,
  DiscussionMessage,
  getOrCreateDiscussion,
  removeDiscussion,
} from '@/lib/discussion/orchestrator';
import { DEFAULT_ROLES, AgentRole } from '@/lib/roles';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_MAX_ROUNDS = 20;
const DEFAULT_CONSENSUS_THRESHOLD = 0.7;

// POST - Start a new discussion
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { topic, roles, maxRounds, consensusThreshold } = body;

    if (!topic || topic.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id } = await params;
    const conversationId = id;

    // Validate conversation exists
    const conversation = getConversation(conversationId);
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use provided roles or defaults
    const discussionRoles: AgentRole[] = roles && roles.length > 0
      ? roles
      : DEFAULT_ROLES;

    // Create discussion config
    const config: DiscussionConfig = {
      topic: topic.trim(),
      roles: discussionRoles,
      maxRounds: maxRounds || DEFAULT_MAX_ROUNDS,
      consensusThreshold: consensusThreshold || DEFAULT_CONSENSUS_THRESHOLD,
    };

    // Create or get orchestrator
    const orchestrator = getOrCreateDiscussion(conversationId, config);
    if (!orchestrator) {
      return new Response(
        JSON.stringify({ error: 'Failed to create discussion orchestrator' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Add user message to conversation (the topic)
    const userMessage = {
      role: 'user',
      content: topic,
      is_intervention: false,
    };
    conversation.messages.push(userMessage);
    saveConversation(conversation);

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data?: any) => {
          const event = data ? { type, ...data } : { type };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        };

        try {
          for await (const event of orchestrator.start()) {
            sendEvent(event.type, {
              round: event.round,
              speakerId: event.speakerId,
              state: event.state,
              reason: event.reason,
              error: event.error,
            });

            // When a message is complete from an agent, we need to capture it
            // This requires subscribing to agent events in the orchestrator
          }

          // Save final discussion state to conversation
          const finalState = orchestrator.getState();
          conversation.messages.push({
            role: 'assistant',
            content: 'Discussion completed',
            discussion_state: finalState,
          });
          saveConversation(conversation);

          // Clean up
          removeDiscussion(conversationId);

          sendEvent('discussion_complete', { reason: finalState.status });
          controller.close();
        } catch (error) {
          console.error('Discussion stream error:', error);
          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in discussion stream endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PATCH - User intervention
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { content, type } = body;

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Intervention content is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id } = await params;
    const conversationId = id;

    const orchestrator = getOrCreateDiscussion(conversationId);
    if (!orchestrator) {
      return new Response(
        JSON.stringify({ error: 'Discussion not found or already completed' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validTypes = ['redirect', 'correction', 'deep_dive', 'terminate'];
    const interventionType = validTypes.includes(type) ? type : 'redirect';

    // Apply intervention
    await orchestrator.intervene(interventionType, content);

    // Add intervention to conversation
    const conversation = getConversation(conversationId);
    if (conversation) {
      conversation.messages.push({
        role: 'user',
        content,
        is_intervention: true,
        intervention_type: type,
      });
      saveConversation(conversation);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in intervention endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// DELETE - Terminate discussion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = id;

    const orchestrator = getOrCreateDiscussion(conversationId);
    if (!orchestrator) {
      return new Response(
        JSON.stringify({ error: 'Discussion not found or already completed' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Terminate
    orchestrator.terminate();

    // Clean up
    removeDiscussion(conversationId);

    // Update conversation
    const conversation = getConversation(conversationId);
    if (conversation) {
      conversation.messages.push({
        role: 'system',
        content: 'Discussion terminated by user',
      });
      saveConversation(conversation);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in terminate endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
