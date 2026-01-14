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

# 3. Start with Docker (Production mode)
docker-compose up -d

# 4. Open browser
open http://localhost:3000
```

**Alternative: Development mode with hot-reload**
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up
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

### Method 3: Interactive Startup Script (Easiest)

```bash
# Interactive setup with multiple deployment options
./start.sh
```

The script will:
- Let you choose deployment mode (Local / Docker Dev / Docker Prod / Docker Test)
- Help you create and configure environment files
- Install dependencies if needed
- Automatically start the application

**Deployment Modes**:
1. **Local Dev** - npm run dev with hot-reload
2. **Docker Dev** - Containerized development with source mounting
3. **Docker Prod** - Production-optimized build
4. **Docker Test** - Testing environment on port 3001

---

## Configuration

### Environment Variables

Create a `.env` or `.env.local` file:

```bash
# Required (validated at startup)
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
    "deepseek/deepseek-v3.2-exp",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4"
]
CHAIRMAN_MODEL = 'openai/gpt-4o'
```

View all available models at: https://openrouter.ai/models

### Per-Conversation Model Settings

- 通过侧边栏右上角的 `⚙ 配置模型` 按钮打开弹窗，可随时调整当前会话要参与的模型。
- 模型列表直接来自 OpenRouter API，支持搜索/勾选，无需手动输入 ID（仍可保留已有的自定义模型 ID）。
- 每个选定模型都可以填写独立的 System Prompt（作用于 Stage 1/Stage 2），用于约束语气或给出专长背景。
- 可在同一弹窗中指定主席模型（若留空则使用默认 `CHAIRMAN_MODEL`），方便快速切换最终综合者。
- 点击保存后立即生效；如果未做选择，则使用 `COUNCIL_MODELS` 与 `CHAIRMAN_MODEL` 环境变量中的默认值。

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

### Multiple Environment Support

The project supports three Docker deployment modes:

#### Production Environment (Recommended for deployment)
```bash
# Full production deployment with backup and health checks
bash scripts/deploy.sh

# Or manually
docker-compose up -d --build
```

#### Development Environment (Hot-reload enabled)
```bash
# Start development container
docker-compose -f docker-compose.dev.yml up

# Background mode
docker-compose -f docker-compose.dev.yml up -d
```

#### Test Environment (Isolated testing)
```bash
# Start test environment on port 3001
docker-compose -f docker-compose.test.yml up -d
```

### Essential Commands

```bash
# Production
docker-compose up -d                    # Start
docker-compose logs -f                  # View logs
docker-compose down                     # Stop
docker-compose restart                  # Restart
docker-compose ps                       # Check status

# Development
docker-compose -f docker-compose.dev.yml up     # Start (foreground)
docker-compose -f docker-compose.dev.yml logs -f # Logs
docker-compose -f docker-compose.dev.yml down   # Stop

# Health check
bash scripts/healthcheck.sh

# Data backup
bash scripts/backup.sh
```

### Configuration Files

```
Dockerfile                  # Production build
Dockerfile.dev             # Development build
docker-compose.yml         # Production config
docker-compose.dev.yml     # Development config
docker-compose.test.yml    # Test config
.env                       # Production environment variables
.env.development           # Development environment variables
.env.test                  # Test environment variables
```

### Custom Port

Edit the respective `docker-compose*.yml` file:
```yaml
ports:
  - "8080:3000"  # Use port 8080 instead of 3000
```

Or set in `.env`:
```bash
PORT=8080
```

### Advanced Features

**Health Checks**: Automatically enabled in production mode
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3 times

**Resource Limits**: Configured in docker-compose.yml
- CPU: 2 cores (max), 0.5 cores (reserved)
- Memory: 2GB (max), 512MB (reserved)

**Log Rotation**: Automatic log management
- Max size: 10MB per file
- Max files: 3
- Compression: Enabled

### Docker Troubleshooting

**Issue: Port already in use**
```bash
# Find and kill process
lsof -ti :3000 | xargs kill -9

# Or change port in .env
echo "PORT=3001" >> .env
```

**Issue: Build fails**
```bash
# Clean rebuild
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

**Issue: Container unhealthy**
```bash
# Check health status
bash scripts/healthcheck.sh

# View detailed logs
docker-compose logs --tail=100

# Restart container
docker-compose restart
```

**Issue: Development hot-reload not working**
```bash
# Ensure using dev compose file
docker-compose -f docker-compose.dev.yml up

# Check volume mounts
docker-compose -f docker-compose.dev.yml config
```

### Complete Docker Documentation

For comprehensive Docker deployment guide, see [DOCKER.md](DOCKER.md):
- Multi-environment setup
- Performance optimization
- Monitoring and logging
- Security best practices
- Production deployment checklist

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
- ✅ **可视化模型配置** - 左侧面板实时增删模型并设置 system prompt
- ✅ **OpenRouter 模型库接入** - 在弹窗中直接搜索/选择官方模型列表

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
- Markdown 渲染使用 `rehype-sanitize`，阻止响应内注入 HTML/JS

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
