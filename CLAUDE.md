# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Local Development
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
```

### Docker Commands

#### Interactive Startup (Recommended)
```bash
# Launches interactive menu to choose deployment mode
./start.sh

# Options:
# 1. Local Dev - npm run dev with hot-reload
# 2. Docker Dev - Containerized development with source mounting
# 3. Docker Prod - Production-optimized build
# 4. Docker Test - Testing environment on port 3001
```

#### Production Deployment
```bash
# Method 1: Full deployment with backup and health checks (recommended)
bash scripts/deploy.sh

# Method 2: Standard docker-compose
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop service
docker-compose down

# Restart service
docker-compose restart

# Check health
bash scripts/healthcheck.sh
```

#### Development Environment (Hot-reload)
```bash
# Start development container with source mounting
docker-compose -f docker-compose.dev.yml up

# Background mode
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop service
docker-compose -f docker-compose.dev.yml down

# Enter container for debugging
docker-compose -f docker-compose.dev.yml exec llm-council-dev sh
```

#### Test Environment
```bash
# Start test environment (runs on port 3001)
docker-compose -f docker-compose.test.yml up -d

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Stop service
docker-compose -f docker-compose.test.yml down
```

#### Utility Commands
```bash
# Backup data
bash scripts/backup.sh

# Health check
bash scripts/healthcheck.sh

# View container stats
docker stats llm-council-app

# Clean up Docker resources
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

### Environment Switching
```bash
# Use specific environment file
docker-compose --env-file .env.development up
docker-compose --env-file .env.production up
docker-compose --env-file .env.test up

# Or let start.sh handle it automatically
./start.sh
```

## Environment Configuration

### Environment Files Structure
```
env.example           # Template (committed to git)
.env.local            # Local development override (not committed)
.env.development      # Docker development environment
.env.test            # Docker test environment
.env.production      # Docker production environment (not committed)
.env                 # Docker Compose default (not committed)
```

### Creating Environment Files

**For Local Development:**
```bash
cp env.example .env.local
# Edit .env.local with your API key
```

**For Docker Deployment:**
```bash
# Production
cp env.example .env
# Or use .env.production
cp env.example .env.production

# Development
cp env.example .env.development

# Test
cp env.example .env.test
```

### Environment Variables

**Required:**
```bash
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

**Optional Model Customization:**
```bash
COUNCIL_MODELS=deepseek/deepseek-v3.2-exp,google/gemini-3-pro-preview,anthropic/claude-sonnet-4.5,x-ai/grok-4
CHAIRMAN_MODEL=openai/gpt-4o
```

**Optional Runtime Configuration:**
```bash
NODE_ENV=production          # development | production | test
PORT=3000                    # Server port
HOSTNAME=0.0.0.0            # Server hostname
LOG_LEVEL=info              # error | warn | info | debug
DATA_DIR=./data             # Data directory for conversations
```

### Quick Setup

The interactive startup script (`./start.sh`) will guide you through environment configuration automatically.

## High-Level Architecture

### Overview
This is a **Next.js 15 full-stack application** implementing two modes:
1. **3-Stage Council Process** - Traditional council voting and synthesis
2. **Multi-Agent Discussion Mode** - Real-time collaborative discussion between AI agents

### Three-Stage Council Process
1.  **Stage 1 - Initial Opinions**: Council models are queried in parallel for individual responses.
2.  **Stage 2 - Peer Review**: Models rank anonymized Stage 1 responses to identify the most valuable ones.
3.  **Stage 3 - Final Synthesis**: A Chairman model synthesizes all responses and rankings into a final answer.

### Multi-Agent Discussion Mode (NEW)

**Features:**
- **4 Predefined Roles**: Optimist (☀️), Pessimist (🌧️), Pragmatist (🔧), Innovator (💡)
- **Round-Robin Discussion**: Agents take turns responding to each other
- **Real-time Streaming**: Watch the discussion unfold live
- **User Intervention**: Jump in to redirect or deepen the conversation
- **Consensus Detection**: Automatically ends when agents reach agreement
- **20 Round Limit**: Maximum discussion length configurable

**Architecture:**
- **`lib/discussion/orchestrator.ts`**: Manages multi-agent discussion lifecycle
- **`lib/discussion/consensus.ts`**: Consensus detection using heuristics/embeddings/LLM
- **`lib/roles.ts`**: Role definitions and customization
- **`app/api/discussions/[id]/stream/route.ts`**: SSE endpoint for discussion streaming
- **`app/components/DiscussionInterface.tsx`**: Chat-style UI for discussions

### Core Architecture Components

#### Server-Side (`lib/`)
- **`council.ts`**: The main orchestrator for the 3-stage process (`runFullCouncil`).
- **`discussion/orchestrator.ts`**: Multi-agent discussion orchestration using pi-agent-core.
- **`discussion/consensus.ts`**: Consensus detection algorithms.
- **`roles.ts`**: Agent role definitions and customization.
- **`openrouter.ts`**: Client for OpenRouter API with parallel query support and timeouts.
- **`storage.ts`**: Local file-system persistence using JSON files in `data/conversations/`.
- **`config.ts` & `env.ts`**: Configuration management and Zod-based environment validation.

#### API Routes (`app/api/`)
- **`/api/conversations/[id]/message/stream`**: SSE endpoint for council mode streaming.
- **`/api/discussions/[id]/stream`**: SSE endpoint for discussion mode (POST/PATCH/DELETE).
- **`/api/models`**: Fetches current available models from OpenRouter.

#### Client-Side (`app/components/`)
- **`ChatInterface.tsx`**: React orchestrator that manages SSE events and global conversation state.
- **`DiscussionInterface.tsx`**: Chat-style UI for multi-agent discussions.
- **`ModelConfigModal.tsx`**: Allows per-conversation model selection and custom system prompts.
- **`Stage1/2/3.tsx`**: UI components for rendering each stage of the council process.

### Data Flow
1. Client POSTs to the streaming endpoint.
2. `lib/council.ts` triggers Stage 1/2/3 sequentially.
3. Progress and partial results are streamed via SSE (`stage1_start`, `stage1_complete`, etc.).
4. Final results are persisted to `data/conversations/[id].json`.

## Technical Standards
- **Framework**: Next.js 15 (App Router), React 19.
- **Type Safety**: Strict TypeScript coverage; Zod for runtime validation.
- **Styling**: Tailwind CSS + ThemeProvider for dark/light mode.
- **Security**: `rehype-sanitize` for safe markdown rendering; no sensitive data in code.
- **Storage**: Flat-file JSON storage (no external database required).
