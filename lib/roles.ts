/**
 * Role definition system for multi-agent discussion
 *
 * Each role represents a distinct perspective that an agent can take
 * in the collaborative discussion.
 */

export interface AgentRole {
  id: string;
  name: string;
  nameEn: string; // English name for system prompts
  description: string;
  systemPrompt: string;
  modelProvider: string;
  modelName: string;
  color: string;      // UI display color (hex)
  avatar: string;     // Emoji or icon
}

/**
 * Default roles for the discussion system
 * These provide diverse perspectives for balanced discussion
 */
export const DEFAULT_ROLES: AgentRole[] = [
  {
    id: 'optimist',
    name: '乐观主义者',
    nameEn: 'Optimist',
    description: '总是看到积极面和机会',
    systemPrompt: `You are an optimist in a collaborative discussion. Your role is to:
- Highlight positive aspects and opportunities
- Focus on potential benefits and upside
- Encourage bold, ambitious thinking
- Find silver linings in challenges
- Build on others' ideas with enthusiasm

Be genuinely optimistic but not naive. Acknowledge real concerns while maintaining a positive outlook.`,
    modelProvider: 'openai',
    modelName: 'gpt-4o-mini',
    color: '#FFD700',
    avatar: '☀️'
  },
  {
    id: 'pessimist',
    name: '悲观主义者',
    nameEn: 'Pessimist',
    description: '谨慎分析风险和潜在问题',
    systemPrompt: `You are a cautious pessimist in a collaborative discussion. Your role is to:
- Identify risks and potential problems
- Point out flaws in reasoning or plans
- Highlight worst-case scenarios to consider
- Question assumptions and optimistic projections
- Advocate for precaution and preparation

Be constructively critical, not nihilistic. Your goal is to improve outcomes by surfacing risks early.`,
    modelProvider: 'anthropic',
    modelName: 'claude-sonnet-4-20250514',
    color: '#708090',
    avatar: '🌧️'
  },
  {
    id: 'pragmatist',
    name: '实用主义者',
    nameEn: 'Pragmatist',
    description: '关注可行性和实际执行',
    systemPrompt: `You are a pragmatist in a collaborative discussion. Your role is to:
- Focus on what is practical and feasible
- Consider resource constraints and trade-offs
- Identify actionable next steps
- Bridge idealistic ideas with reality
- Cut through theory to practical application

Be realistic without being cynical. Help translate ideas into executable plans.`,
    modelProvider: 'google',
    modelName: 'gemini-2.5-pro',
    color: '#228B22',
    avatar: '🔧'
  },
  {
    id: 'innovator',
    name: '创新者',
    nameEn: 'Innovator',
    description: '提出非传统想法和突破性方案',
    systemPrompt: `You are an innovator in a collaborative discussion. Your role is to:
- Think outside the box and challenge conventions
- Propose unconventional, breakthrough ideas
- Make unexpected connections between concepts
- Question "how things are usually done"
- Explore radical alternatives

Be creative but not absurd. Your wild ideas might contain seeds of genuine innovation.`,
    modelProvider: 'xai',
    modelName: 'grok-3',
    color: '#9932CC',
    avatar: '💡'
  }
];

/**
 * Get a role by ID
 */
export function getRoleById(id: string): AgentRole | undefined {
  return DEFAULT_ROLES.find(r => r.id === id);
}

/**
 * Build system prompt for a role with topic context
 */
export function buildSystemPrompt(role: AgentRole, topic: string): string {
  return `${role.systemPrompt}

---

DISCUSSION TOPIC: "${topic}"

You are participating in a collaborative multi-agent discussion with other participants who have different perspectives.

GUIDELINES:
- Respond to previous points when relevant
- Build on others' ideas constructively
- Keep responses concise (2-4 paragraphs max)
- You can agree, disagree, ask questions, or propose new angles
- Stay in character as ${role.nameEn}
- The discussion ends after 20 rounds or when consensus is reached

Add your unique perspective to the discussion.`;
}

/**
 * Validate a custom role configuration
 */
export function validateRole(role: Partial<AgentRole>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!role.id || role.id.length < 2) {
    errors.push('Role ID must be at least 2 characters');
  }

  if (!role.name || role.name.length < 1) {
    errors.push('Role name is required');
  }

  if (!role.nameEn || role.nameEn.length < 1) {
    errors.push('English name is required');
  }

  if (!role.description || role.description.length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (!role.systemPrompt || role.systemPrompt.length < 50) {
    errors.push('System prompt must be at least 50 characters');
  }

  if (!role.modelProvider || role.modelProvider.length < 1) {
    errors.push('Model provider is required');
  }

  if (!role.modelName || role.modelName.length < 1) {
    errors.push('Model name is required');
  }

  if (role.color && !/^#[0-9A-Fa-f]{6}$/.test(role.color)) {
    errors.push('Color must be a valid hex color (e.g., #FFD700)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a custom role with validation
 */
export function createRole(role: Partial<AgentRole>): { success: boolean; role?: AgentRole; errors?: string[] } {
  const validation = validateRole(role);

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  return {
    success: true,
    role: {
      id: role.id!,
      name: role.name!,
      nameEn: role.nameEn!,
      description: role.description!,
      systemPrompt: role.systemPrompt!,
      modelProvider: role.modelProvider!,
      modelName: role.modelName!,
      color: role.color || '#888888',
      avatar: role.avatar || '👤'
    }
  };
}

/**
 * Get available models for role configuration
 * Returns a list of provider-model combinations
 */
export const AVAILABLE_MODELS = [
  { provider: 'openai', name: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { provider: 'openai', name: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'openai', name: 'o3-mini', label: 'o3-mini' },
  { provider: 'anthropic', name: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { provider: 'anthropic', name: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
  { provider: 'google', name: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { provider: 'google', name: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { provider: 'xai', name: 'grok-2-1212', label: 'Grok-2' },
  { provider: 'xai', name: 'grok-3', label: 'Grok-3' },
  { provider: 'meta', name: 'llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { provider: 'mistral', name: 'mistral-large-2411', label: 'Mistral Large' },
];

/**
 * Serialize roles for storage (removes any non-serializable properties)
 */
export function serializeRoles(roles: AgentRole[]): AgentRole[] {
  return roles.map(role => ({
    id: role.id,
    name: role.name,
    nameEn: role.nameEn,
    description: role.description,
    systemPrompt: role.systemPrompt,
    modelProvider: role.modelProvider,
    modelName: role.modelName,
    color: role.color,
    avatar: role.avatar
  }));
}
