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

# Interactive startup script
./start.sh
```

## Environment Configuration

Create a `.env.local` (for local dev) or `.env` (for Docker) file:
```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-your-api-key

# Optional Customizations
COUNCIL_MODELS=openai/gpt-4o,anthropic/claude-3.5-sonnet
CHAIRMAN_MODEL=openai/gpt-4o
```

## High-Level Architecture

### Overview
This is a **Next.js 15 full-stack application** implementing a 3-stage LLM Council process. It migrated from a FastAPI + Vite architecture to a unified Next.js App Router structure.

### Three-Stage Council Process
1.  **Stage 1 - Initial Opinions**: Council models are queried in parallel for individual responses.
2.  **Stage 2 - Peer Review**: Models rank anonymized Stage 1 responses to identify the most valuable ones.
3.  **Stage 3 - Final Synthesis**: A Chairman model synthesizes all responses and rankings into a final answer.

### Core Architecture Components

#### Server-Side (`lib/`)
- **`council.ts`**: The main orchestrator for the 3-stage process (`runFullCouncil`).
- **`openrouter.ts`**: Client for OpenRouter API with parallel query support and timeouts.
- **`storage.ts`**: Local file-system persistence using JSON files in `data/conversations/`.
- **`config.ts` & `env.ts`**: Configuration management and Zod-based environment validation.

#### API Routes (`app/api/`)
- **`/api/conversations/[id]/message/stream`**: SSE (Server-Sent Events) endpoint that handles the streaming of the 3-stage process.
- **`/api/models`**: Fetches current available models from OpenRouter.

#### Client-Side (`app/components/`)
- **`ChatInterface.tsx`**: React orchestrator that manages SSE events and global conversation state.
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
