# LLM Council

![llmcouncil](header.jpg)

An innovative AI assistant that doesn't just query a single LLM, but organizes multiple LLMs (OpenAI GPT, Anthropic Claude, Google Gemini, Meta Llama, etc.) into a "Council". The app sends your query to multiple LLMs, has them review and rank each other's responses, and finally a Chairman LLM synthesizes the collective wisdom into a final answer.

## How It Works

When you submit a query, it goes through three stages:

1. **Stage 1: Initial Opinions**. Your query is sent to all council members individually, and their responses are collected. You can inspect each response in separate tabs.

2. **Stage 2: Peer Review**. Each LLM receives the other responses (anonymized to prevent bias) and ranks them based on accuracy and insight. This reveals which responses the AI community finds most valuable.

3. **Stage 3: Final Answer**. The Chairman LLM synthesizes all responses and rankings into a single, comprehensive answer that represents the council's collective wisdom.

---

## Quick Start

### Prerequisites

- **Node.js 20+** (for local development)
- **Docker** (for containerized deployment)
- **OpenRouter API Key** - Get one at [openrouter.ai](https://openrouter.ai/)

### Method 1: Docker (Recommended)

```bash
# 1. Clone and enter directory
cd llm-council-nextjs

# 2. Configure API key
echo "OPENROUTER_API_KEY=sk-or-v1-your-api-key" > .env

# 3. Start with Docker
docker-compose up -d

# 4. Open browser
open http://localhost:3000
```

### Method 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure API key
echo "OPENROUTER_API_KEY=sk-or-v1-your-api-key" > .env.local

# 3. Start development server
npm run dev

# 4. Open browser
open http://localhost:3000
```

### Using the Startup Script

```bash
# Interactive setup
./start.sh
```

The script will:
- Check for Docker
- Help you create configuration
- Install dependencies if needed
- Start the application

---

## Configuration

### Environment Variables

Create a `.env` or `.env.local` file:

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-your-api-key

# Optional: Customize models (comma-separated)
COUNCIL_MODELS=openai/gpt-4o,anthropic/claude-3.5-sonnet,openai/gpt-4o-mini,meta-llama/llama-3.1-70b-instruct

# Optional: Customize chairman
CHAIRMAN_MODEL=openai/gpt-4o
```

### Model Configuration

**Default Models:**
```typescript
COUNCIL_MODELS = [
    "openai/gpt-5.1-chat",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4"
]
CHAIRMAN_MODEL = 'openai/gpt-4o'
```

**Recommended Configurations:**

**Most Stable (OpenAI only):**
```bash
COUNCIL_MODELS=openai/gpt-4o,openai/gpt-4o-mini,openai/gpt-4-turbo,openai/gpt-3.5-turbo
```

**High Performance:**
```bash
COUNCIL_MODELS=openai/gpt-4o,anthropic/claude-3.5-sonnet,anthropic/claude-3-opus,meta-llama/llama-3.1-405b-instruct
```

**Budget-Friendly:**
```bash
COUNCIL_MODELS=openai/gpt-4o-mini,openai/gpt-3.5-turbo,anthropic/claude-3-haiku,meta-llama/llama-3.1-8b-instruct
```

View all available models at: https://openrouter.ai/models

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Frontend**: React 19, React Markdown
- **Backend**: Next.js API Routes (full-stack in one)
- **AI**: OpenRouter API
- **Storage**: JSON files (local file system)
- **Deployment**: Docker + Docker Compose

---

## Project Structure

```
llm-council-nextjs/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (backend)
│   │   └── conversations/        # Conversation endpoints
│   ├── components/               # React components
│   │   ├── Sidebar.tsx           # Conversation list
│   │   ├── ChatInterface.tsx     # Main chat UI
│   │   ├── Stage1.tsx            # Stage 1 display
│   │   ├── Stage2.tsx            # Stage 2 display
│   │   └── Stage3.tsx            # Stage 3 display
│   ├── lib/                      # Client utilities
│   │   └── api.ts                # API client
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
│
├── lib/                          # Server utilities
│   ├── config.ts                 # Configuration
│   ├── openrouter.ts             # OpenRouter client
│   ├── storage.ts                # File storage
│   └── council.ts                # Council orchestration
│
├── data/                         # Data storage
│   └── conversations/            # JSON conversation files
│
├── public/                       # Static assets
├── Dockerfile                    # Docker configuration
├── docker-compose.yml            # Docker Compose
├── next.config.js                # Next.js config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
└── start.sh                      # Startup script
```

---

## Docker Deployment

### Basic Commands

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build

# Check status
docker-compose ps
```

### Custom Port

Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Use port 8080 instead
```

### Docker Troubleshooting

**Issue: Port already in use**
```bash
# Find and kill process
lsof -ti :3000 | xargs kill -9
```

**Issue: Build fails**
```bash
# Clean rebuild
docker-compose down
docker system prune -a
docker-compose up -d --build
```

**Issue: Image pull fails**
```bash
# Pull manually first
docker pull node:20-alpine
docker-compose up -d --build
```

---

## Production Deployment

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

### Environment Variables for Production

```bash
NODE_ENV=production
OPENROUTER_API_KEY=your-key
COUNCIL_MODELS=your-models
CHAIRMAN_MODEL=your-chairman
```

### Deployment Checklist

- [ ] Configure environment variables
- [ ] Set up reverse proxy (nginx)
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Configure log rotation
- [ ] Set up backups for data directory

---

## Features

- ✅ **3-Stage Council Process** - Opinions → Peer Review → Final Answer
- ✅ **Real-time Streaming** - See responses as they come in
- ✅ **Parallel Queries** - All LLMs queried simultaneously
- ✅ **Anonymous Review** - LLMs rank others without knowing identities
- ✅ **Aggregate Rankings** - See which models perform best
- ✅ **Conversation History** - All chats saved automatically
- ✅ **Beautiful UI** - Modern, responsive design
- ✅ **TypeScript** - Full type safety
- ✅ **Environment Config** - Easy model customization
- ✅ **Docker Ready** - One-click deployment

---

## Development

### Commands

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### File Structure

- **`app/api/`** - API endpoints (replaces FastAPI backend)
- **`lib/`** - Server-side business logic
- **`app/components/`** - React UI components
- **`data/`** - Conversation storage (persisted)

### Adding New Models

1. Check available models at https://openrouter.ai/models
2. Add to environment variables:
   ```bash
   COUNCIL_MODELS=model1,model2,model3
   ```
3. Or edit `lib/config.ts` defaults

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | GET | List all conversations |
| `/api/conversations` | POST | Create new conversation |
| `/api/conversations/:id` | GET | Get conversation details |
| `/api/conversations/:id/message/stream` | POST | Send message (streaming) |

---

## Troubleshooting

### Common Issues

**Port 3000 in use:**
```bash
lsof -ti :3000 | xargs kill -9
```

**API key not working:**
- Verify key is correct in `.env` or `.env.local`
- Check OpenRouter account has credits
- View model names at https://openrouter.ai/models

**Models returning errors:**
- Some model names may be outdated
- Use recommended configurations above
- Check logs: `docker-compose logs -f`

**Build fails:**
- Ensure Node.js 20+ installed
- Delete `node_modules` and `npm install` again
- Clear Next.js cache: `rm -rf .next`

**Docker issues:**
- Restart Docker Desktop
- Clean Docker: `docker system prune -a`
- Try without Docker: `npm run dev`

---

## Migration from FastAPI Version

This project was migrated from a FastAPI + Vite architecture to Next.js full-stack.

**What Changed:**
- ✅ Python backend → TypeScript backend
- ✅ Separate servers → Single Next.js server
- ✅ Manual routing → Next.js App Router
- ✅ Basic config → Environment variables

**What Stayed the Same:**
- ✅ All features intact
- ✅ Same 3-stage process
- ✅ Data format compatible (no migration needed)
- ✅ Same UI/UX

**Benefits:**
- Single language (JavaScript/TypeScript)
- Simpler deployment (one service)
- Better type safety
- Modern development experience

---

## Performance

- **Automatic Code Splitting** - Next.js optimizes bundle size
- **Static Asset Optimization** - Images and CSS optimized
- **API Response Streaming** - See results as they arrive
- **Docker Image Optimization** - Multi-stage build, Alpine base
- **Production Build** - Minified and compressed

---

## Security

- API keys stored in environment variables
- `.gitignore` prevents credential leaks
- Docker runs as non-root user
- CORS configured for necessary domains only
- No sensitive data in code

---

## Data Storage

Conversations are stored as JSON files in `data/conversations/`:

```json
{
  "id": "conversation-uuid",
  "created_at": "2024-01-01T00:00:00.000Z",
  "title": "Conversation Title",
  "messages": [
    {
      "role": "user",
      "content": "User message"
    },
    {
      "role": "assistant",
      "stage1": [...],
      "stage2": [...],
      "stage3": {...}
    }
  ]
}
```

**Backup:** Simply copy the `data/` directory.

---

## Contributing

This is a personal project and not actively maintained. Feel free to fork and modify for your needs.

---

## License

This project is provided as-is for learning and exploration. It was created as a weekend coding project and is not officially supported.

---

## Links

- **OpenRouter**: https://openrouter.ai/
- **OpenRouter Models**: https://openrouter.ai/models
- **OpenRouter Docs**: https://openrouter.ai/docs
- **Next.js**: https://nextjs.org/
- **TypeScript**: https://www.typescriptlang.org/
- **React**: https://react.dev/

---

## Support

**Need Help?**

1. Check the Troubleshooting section above
2. Review logs: `docker-compose logs -f`
3. Try without Docker: `npm run dev`
4. Check environment variables are set correctly
5. Verify OpenRouter API key and credits

---

**Start consulting your LLM Council today!** 🎉

Built with Next.js 15, TypeScript, and love for AI.
