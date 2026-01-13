# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Run with Docker (recommended)
docker-compose up -d

# View Docker logs
docker-compose logs -f

# Stop Docker
docker-compose down

# Rebuild Docker
docker-compose up -d --build
```

## Environment Configuration

Create a `.env.local` file with:
```bash
OPENROUTER_API_KEY=sk-or-v1-your-api-key
```

Optional customizations:
```bash
COUNCIL_MODELS=openai/gpt-4o,anthropic/claude-3.5-sonnet
CHAIRMAN_MODEL=openai/gpt-4o
```

## High-Level Architecture

### Overview
This is a **Next.js 15 full-stack application** that implements a 3-stage LLM Council process where multiple AI models collaborate to answer user queries. The app was migrated from FastAPI + Vite to a unified Next.js architecture.

### Three-Stage Council Process

1. **Stage 1 - Initial Opinions**: Query all council models in parallel to get individual responses
2. **Stage 2 - Peer Review**: Each model ranks anonymized responses from Stage 1
3. **Stage 3 - Final Synthesis**: Chairman model synthesizes all responses and rankings into a comprehensive answer

### Core Directory Structure

```
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (backend)
│   │   ├── conversations/        # Conversation endpoints
│   │   ├── config/route.ts       # Configuration endpoint
│   │   └── models/route.ts       # Available models endpoint
│   ├── components/               # React UI components
│   │   ├── ChatInterface.tsx     # Main chat UI and orchestration
│   │   ├── Sidebar.tsx           # Conversation list
│   │   ├── Stage1.tsx            # Stage 1 display component
│   │   ├── Stage2.tsx            # Stage 2 display component
│   │   ├── Stage3.tsx            # Stage 3 display component
│   │   ├── ModelConfigModal.tsx  # Per-conversation model config
│   │   ├── ThemeProvider.tsx     # Theme context
│   │   └── SafeMarkdown.tsx      # Safe markdown rendering
│   ├── lib/
│   │   └── api.ts                # Client-side API client
│   ├── types/
│   │   └── modelConfig.ts        # TypeScript types
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
│
├── lib/                          # Server-side utilities
│   ├── config.ts                 # Configuration and default models
│   ├── openrouter.ts             # OpenRouter API client
│   ├── council.ts                # 3-stage council orchestration
│   ├── storage.ts                # JSON file storage
│   └── env.ts                    # Environment validation (Zod)
│
└── data/                         # Data storage
    └── conversations/            # JSON conversation files
```

### Key Architecture Components

#### Server-Side (`lib/`)

- **`council.ts`** - Orchestrates the 3-stage process
  - `stage1CollectResponses()` - Parallel queries to all models
  - `stage2CollectRankings()` - Each model ranks others' responses
  - `stage3SynthesizeFinal()` - Chairman synthesizes final answer
  - `calculateAggregateRankings()` - Computes overall model rankings
  - `runFullCouncil()` - High-level orchestration function

- **`openrouter.ts`** - OpenRouter API client
  - `queryModel()` - Single model query with timeout
  - `queryModelsParallel()` - Parallel queries to multiple models
  - Uses AbortController for timeouts (120s default)

- **`storage.ts`** - File-based conversation persistence
  - JSON files in `data/conversations/`
  - CRUD operations for conversations
  - Automatic directory creation

- **`config.ts`** - Configuration management
  - Environment variable parsing
  - Default models and chairman model
  - OpenRouter API URL

- **`env.ts`** - Environment validation using Zod
  - Validates `OPENROUTER_API_KEY` is required
  - Optional `COUNCIL_MODELS` and `CHAIRMAN_MODEL`

#### API Routes (`app/api/`)

- **`/api/conversations`** - GET/POST conversation list and creation
- **`/api/conversations/[id]`** - GET specific conversation
- **`/api/conversations/[id]/message/stream`** - **Streaming message endpoint**
  - Implements Server-Sent Events (SSE)
  - Streams stage updates: `stage1_start`, `stage1_complete`, `stage2_start`, `stage2_complete`, `stage3_start`, `stage3_complete`, `complete`
  - Handles the full 3-stage council process
- **`/api/models`** - Fetch available models from OpenRouter
- **`/api/config`** - Get server configuration defaults

#### Client-Side (`app/components/`)

- **`ChatInterface.tsx`** - Main orchestrator
  - Manages conversation state
  - Handles SSE events
  - Coordinates UI updates across all 3 stages
  - Model configuration modal integration

- **Stage Components** (`Stage1.tsx`, `Stage2.tsx`, `Stage3.tsx`)
  - Display responses from each stage
  - Stage2 shows peer rankings with aggregate statistics
  - Stage3 shows final synthesized answer

- **`ModelConfigModal.tsx`**
  - Per-conversation model selection
  - Fetches model list from OpenRouter API
  - Custom system prompts per model
  - Chairman model selection

### Data Flow

1. User submits query → `ChatInterface.tsx`
2. Client calls `/api/conversations/[id]/message/stream`
3. API route orchestrates 3 stages via `lib/council.ts`
4. Results streamed to client via Server-Sent Events
5. Client updates UI progressively as stages complete
6. Final conversation saved to `data/conversations/`

### Default Configuration

**Default Council Models:**
- `deepseek/deepseek-v3.2-exp`
- `google/gemini-3-pro-preview`
- `anthropic/claude-sonnet-4.5`
- `x-ai/grok-4`

**Default Chairman Model:**
- `google/gemini-3-pro-preview`

All models via OpenRouter API (https://openrouter.ai/)

### Key Implementation Details

- **Parallel Execution**: Stage 1 queries all models simultaneously using `Promise.all()`
- **Anonymous Ranking**: Stage 2 responses are anonymized (Response A, B, C) to prevent bias
- **Language Consistency**: All prompts enforce responding in the same language as user input
- **Streaming**: Real-time updates via SSE (`text/event-stream`)
- **File Storage**: Simple JSON files (no database)
- **Type Safety**: Full TypeScript coverage with Zod validation

### Configuration Flexibility

- **Global Defaults**: Set via environment variables (`COUNCIL_MODELS`, `CHAIRMAN_MODEL`)
- **Per-Conversation**: Override models via `ModelConfigModal.tsx`
- **Model Search**: Browse all available OpenRouter models through the UI
- **Custom System Prompts**: Per-model customization in the modal

### Migration Notes

The project was migrated from **FastAPI + Vite** to **Next.js full-stack**:
- ✅ All features preserved
- ✅ Same data format (no migration needed)
- ✅ Single language (TypeScript)
- ✅ Simplified deployment (one service)
- ✅ Better type safety

## Important Files for Reference

- **Main orchestration**: `lib/council.ts`
- **API endpoint**: `app/api/conversations/[id]/message/stream/route.ts`
- **Client API**: `app/lib/api.ts`
- **Configuration**: `lib/config.ts`
- **Storage layer**: `lib/storage.ts`
- **UI Orchestrator**: `app/components/ChatInterface.tsx`

## Quick Reference

- **Port**: 3000 (local), configured in `docker-compose.yml`
- **Data Directory**: `data/conversations/` (JSON files)
- **API Base**: `/api`
- **Models Source**: OpenRouter API (https://openrouter.ai/models)
- **Environment Variables**: Validated at startup via `lib/env.ts`