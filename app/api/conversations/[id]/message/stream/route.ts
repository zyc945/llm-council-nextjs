/**
 * API route for streaming message responses.
 */

import { NextRequest } from 'next/server';
import {
  getConversation,
  addUserMessage,
  addAssistantMessage,
  updateConversationTitle,
  saveRoundtableMessage,
  RoundtableTurn,
} from '@/lib/storage';
import {
  stage1CollectResponses,
  stage2CollectRankings,
  stage3SynthesizeFinal,
  calculateAggregateRankings,
  generateConversationTitle,
  CouncilModelConfig,
} from '@/lib/council';
import { runRoundtableTurn, getNextSpeaker } from '@/lib/roundtable';
import { RESOLVED_COUNCIL_MODEL_CONFIGS } from '@/lib/config';
import { z } from 'zod';

// POST /api/conversations/[id]/message/stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const parsedBody = RequestBodySchema.safeParse(body);

    if (!parsedBody.success) {
      const message = parsedBody.error.issues
        .map((issue) => issue.message)
        .join('; ');
      return new Response(
        JSON.stringify({ error: `Invalid request body: ${message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { content, councilModels, chairmanModel, mode = 'council' } = parsedBody.data;
    const activeCouncilModels = sanitizeCouncilModelsInput(councilModels);
    const chairmanSelection = sanitizeChairmanModelInput(chairmanModel);
    const { id } = await params;
    const conversationId = id;

    // Check if conversation exists
    const conversation = getConversation(conversationId);
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is the first message
    const isFirstMessage = conversation.messages.length === 0;

    // Create a readable stream
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
          // Add user message to disk
          addUserMessage(conversationId, content);

          // Update conversation mode if provided
          const updatedConversation = getConversation(conversationId);
          if (updatedConversation) {
            updatedConversation.mode = mode;
            // Also store config if needed
          }

          // Start title generation in parallel (don't await yet)
          let titlePromise: Promise<string> | null = null;
          if (isFirstMessage) {
            titlePromise = generateConversationTitle(content);
          }

          if (mode === 'roundtable') {
            // Roundtable logic
            sendEvent('roundtable_start');

            // Discussion loop (e.g., each model speaks once)
            const turns = activeCouncilModels.length; // One turn per model per user interaction
            let lastModelId: string | undefined;

            const participants = activeCouncilModels.map(m => ({
              id: m.model,
              name: m.model.split('/')[1] || m.model,
              systemPrompt: m.systemPrompt
            }));

            const accumulatedTurns: RoundtableTurn[] = [];

            for (let i = 0; i < turns; i++) {
              const speaker = getNextSpeaker(participants, lastModelId);
              sendEvent('roundtable_turn_start', {
                model_id: speaker.id,
                model_name: speaker.name
              });

              // Get history for AI to see
              const currentConversation = getConversation(conversationId);
              const history = currentConversation?.messages || [];

              // We also need to add the turns in this round to history
              const turnsAsMessages = accumulatedTurns.map(t => ({
                role: 'assistant',
                model_id: t.model_id,
                model_name: t.model_name,
                content: t.content
              }));
              const fullHistory = [...history, ...turnsAsMessages];

              const turnContent = await runRoundtableTurn(
                speaker.id,
                speaker.name,
                fullHistory,
                participants,
                speaker.systemPrompt
              );

              if (turnContent) {
                // Generate unique ID for this turn
                const turnId = `${conversationId}-${speaker.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                const newTurn = {
                  id: turnId,
                  role: 'assistant' as const,
                  model_id: speaker.id,
                  model_name: speaker.name,
                  content: turnContent,
                  timestamp: new Date().toISOString()
                };

                console.log('[BACKEND DEBUG] Adding turn to accumulated array:', {
                  model_id: speaker.id,
                  turn_number: accumulatedTurns.length + 1,
                  content_preview: turnContent.substring(0, 50)
                });

                accumulatedTurns.push(newTurn);

                console.log('[BACKEND DEBUG] Sending roundtable_turn_complete event:', {
                  turn_id: turnId,
                  model_id: speaker.id,
                  content_preview: turnContent.substring(0, 50)
                });

                sendEvent('roundtable_turn_complete', {
                  turn_id: turnId,
                  model_id: speaker.id,
                  model_name: speaker.name,
                  data: turnContent
                });
                lastModelId = speaker.id;
              } else {
                sendEvent('roundtable_turn_error', {
                  model_id: speaker.id,
                  message: 'Model failed to respond'
                });
              }
            }

            // Save the complete session as ONE message block
            saveRoundtableMessage(conversationId, accumulatedTurns);

            // Final synthesis by Chairman if requested
            sendEvent('roundtable_complete');
          } else {
            // Original Stage 1: Collect responses
            sendEvent('stage1_start');
            const stage1Results = await stage1CollectResponses(
              content,
              activeCouncilModels
            );
            sendEvent('stage1_complete', { data: stage1Results });

            // Stage 2: Collect rankings
            sendEvent('stage2_start');
            let metadata: {
              label_to_model: Record<string, string>;
              aggregate_rankings: any[];
            } | null = null;

            const { rankings: stage2Results, labelToModel } =
              await stage2CollectRankings(
                content,
                stage1Results,
                activeCouncilModels
              );
            const aggregateRankings = calculateAggregateRankings(
              stage2Results,
              labelToModel
            );
            metadata = {
              label_to_model: labelToModel,
              aggregate_rankings: aggregateRankings,
            };
            sendEvent('stage2_complete', {
              data: stage2Results,
              metadata,
            });

            // Stage 3: Synthesize final answer
            sendEvent('stage3_start');
            const stage3Result = await stage3SynthesizeFinal(
              content,
              stage1Results,
              stage2Results,
              chairmanSelection
            );
            sendEvent('stage3_complete', { data: stage3Result });

            // Save complete assistant message
            addAssistantMessage(
              conversationId,
              stage1Results,
              stage2Results,
              stage3Result,
              metadata
            );
          }

          // Wait for title generation if it was started
          if (titlePromise) {
            const title = await titlePromise;
            updateConversationTitle(conversationId, title);
            sendEvent('title_complete', { data: { title } });
          }

          // Send completion event
          sendEvent('complete');

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
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
    console.error('Error in stream endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

const CouncilModelSchema = z.object({
  model: z.string().min(1, 'Model identifier cannot be empty.'),
  systemPrompt: z.string().optional(),
});

const RequestBodySchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty.'),
  councilModels: z.array(CouncilModelSchema).optional(),
  chairmanModel: z.string().optional(),
  mode: z.enum(['council', 'roundtable']).optional(),
});

function sanitizeCouncilModelsInput(
  input?: CouncilModelConfig[]
): CouncilModelConfig[] {
  const source =
    input && input.length > 0 ? input : RESOLVED_COUNCIL_MODEL_CONFIGS;

  const normalized = source
    .map((cfg) => ({
      model: cfg.model.trim(),
      systemPrompt: cfg.systemPrompt?.trim() || undefined,
    }))
    .filter((cfg) => cfg.model.length > 0);

  if (normalized.length === 0) {
    throw new Error('At least one council model must be provided.');
  }

  return normalized;
}

function sanitizeChairmanModelInput(input?: string | null): string | undefined {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

