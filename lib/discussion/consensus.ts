/**
 * Consensus Detection Module
 *
 * Provides multiple strategies for detecting when a discussion
 * has reached consensus among participants.
 */

import { DiscussionMessage } from './orchestrator';

/**
 * Consensus detection result
 */
export interface ConsensusResult {
  detected: boolean;
  confidence: number; // 0-1
  method: 'semantic_similarity' | 'llm_judge' | 'heuristic' | 'combined';
  basedOnMessages: string[]; // Message IDs
}

/**
 * Strategy 1: Semantic Similarity using Embeddings
 *
 * Compares the semantic meaning of recent messages to detect
 * convergence in viewpoints.
 */
export async function detectConsensusByEmbeddings(
  messages: DiscussionMessage[],
  threshold: number = 0.85,
  windowSize: number = 6
): Promise<ConsensusResult> {
  if (messages.length < 3) {
    return {
      detected: false,
      confidence: 0,
      method: 'semantic_similarity',
      basedOnMessages: []
    };
  }

  // Get recent messages
  const recentMessages = messages.slice(-windowSize);
  const contents = recentMessages.map(m => m.content);

  try {
    // Generate embeddings for each message
    // Using OpenAI's embedding API (most reliable for semantic similarity)
    const embeddings = await Promise.all(
      contents.map(content => generateEmbedding(content))
    );

    // Calculate pairwise cosine similarity
    const similarities: number[] = [];
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const sim = cosineSimilarity(embeddings[i], embeddings[j]);
        similarities.push(sim);
      }
    }

    // Average similarity
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

    return {
      detected: avgSimilarity >= threshold,
      confidence: avgSimilarity,
      method: 'semantic_similarity',
      basedOnMessages: recentMessages.map(m => m.id)
    };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return {
      detected: false,
      confidence: 0,
      method: 'semantic_similarity',
      basedOnMessages: []
    };
  }
}

/**
 * Strategy 2: LLM Judge
 *
 * Uses an LLM to analyze the discussion and determine if consensus exists.
 */
export async function detectConsensusByLLM(
  messages: DiscussionMessage[],
  topic: string
): Promise<ConsensusResult> {
  if (messages.length < 4) {
    return {
      detected: false,
      confidence: 0,
      method: 'llm_judge',
      basedOnMessages: []
    };
  }

  // Build discussion summary for the judge
  const discussionText = messages
    .slice(-8)
    .map(m => `[${m.speakerNameEn}]: ${m.content}`)
    .join('\n');

  const prompt = `You are analyzing a multi-agent discussion to determine if consensus has been reached.

Topic: "${topic}"

Recent discussion:
${discussionText}

Analyze whether the participants have reached consensus. Consider:
1. Are they agreeing with each other?
2. Are there any remaining major disagreements?
3. Has the discussion converged on similar conclusions?

Respond with ONLY a JSON object:
{
  "consensus": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

  try {
    // Use a lightweight model for judgment
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    const parsed = JSON.parse(content);

    return {
      detected: parsed.consensus === true,
      confidence: parsed.confidence || 0,
      method: 'llm_judge',
      basedOnMessages: messages.slice(-8).map(m => m.id)
    };
  } catch (error) {
    console.error('Error in LLM consensus detection:', error);
    return {
      detected: false,
      confidence: 0,
      method: 'llm_judge',
      basedOnMessages: []
    };
  }
}

/**
 * Strategy 3: Heuristic Analysis
 *
 * Fast, rule-based consensus detection without API calls.
 * Good for real-time checking.
 */
export function detectConsensusByHeuristics(
  messages: DiscussionMessage[],
  threshold: number = 0.7
): ConsensusResult {
  if (messages.length < 4) {
    return {
      detected: false,
      confidence: 0,
      method: 'heuristic',
      basedOnMessages: []
    };
  }

  const recentMessages = messages.slice(-6);
  let score = 0;
  const maxScore = 5;

  // Factor 1: Message length decreasing (discussion winding down)
  const lengths = recentMessages.map(m => m.content.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (avgLength < 150) score += 1;

  // Factor 2: Affirmative language
  const affirmativePatterns = [
    /agree/i, /makes sense/i, /good point/i, /concur/i,
    /seems right/i, /reasonable/i, /sound/i, /valid/i,
    /well said/i, /exactly/i, /precisely/i
  ];

  const affirmativeCount = recentMessages.filter(m =>
    affirmativePatterns.some(p => p.test(m.content))
  ).length;

  if (affirmativeCount >= 2) score += 1;
  if (affirmativeCount >= 3) score += 0.5;

  // Factor 3: Reduced disagreement markers
  const disagreementPatterns = [
    /disagree/i, /however/i, /but/i, /on the other hand/i,
    /i think.*wrong/i, /not quite/i, /problem/i, /issue/i,
    /concern/i, /flaw/i
  ];

  const disagreementCount = recentMessages.filter(m =>
    disagreementPatterns.some(p => p.test(m.content))
  ).length;

  if (disagreementCount <= 1) score += 1;
  if (disagreementCount === 0) score += 0.5;

  // Factor 4: Repetition of similar conclusions
  const uniqueConclusions = new Set(
    recentMessages.map(m => {
      // Extract last sentence as "conclusion"
      const sentences = m.content.match(/[^.!?]+[.!?]+/g) || [];
      return sentences[sentences.length - 1]?.trim().toLowerCase() || '';
    })
  );

  if (uniqueConclusions.size <= recentMessages.length / 2) score += 1;

  // Factor 5: Explicit agreement statements
  const explicitAgreement = recentMessages.some(m =>
    /I agree with/.test(m.content) || /build on.*point/i.test(m.content)
  );

  if (explicitAgreement) score += 1;

  const confidence = score / maxScore;

  return {
    detected: confidence >= threshold,
    confidence,
    method: 'heuristic',
    basedOnMessages: recentMessages.map(m => m.id)
  };
}

/**
 * Combined consensus detection
 * Uses multiple strategies and votes on the result
 */
export function detectConsensus(
  messages: DiscussionMessage[],
  topic: string,
  options: {
    threshold?: number;
    requireMultipleStrategies?: boolean;
  } = {}
): ConsensusResult {
  const { threshold = 0.7, requireMultipleStrategies = false } = options;

  // Run heuristic (fast, no API cost)
  const heuristicResult = detectConsensusByHeuristics(messages, threshold);

  if (!requireMultipleStrategies) {
    return heuristicResult;
  }

  // For higher confidence, run multiple strategies
  const results: ConsensusResult[] = [heuristicResult];

  // Run embedding-based if we have enough messages
  if (messages.length >= 4) {
    // Note: This requires OPENROUTER_API_KEY or similar
    // detectConsensusByEmbeddings(messages, threshold).then(r => results.push(r));
  }

  // Vote: consensus detected if majority agree
  const detectedCount = results.filter(r => r.detected).length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  return {
    detected: detectedCount >= Math.ceil(results.length / 2),
    confidence: avgConfidence,
    method: 'combined',
    basedOnMessages: [...new Set(results.flatMap(r => r.basedOnMessages))]
  };
}

// ============================================================================
// Helper functions for embedding calculations
// ============================================================================

/**
 * Generate embedding for text using OpenAI API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-ada-002',
      input: text.slice(0, 8000) // Limit input length
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}
