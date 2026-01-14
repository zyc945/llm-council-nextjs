# Docker 部署指南

本文档提供 LLM Council 项目的 Docker 部署完整指南，包括开发、测试和生产环境的配置说明。

## 目录

- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [部署模式](#部署模式)
- [常用命令](#常用命令)
- [故障排查](#故障排查)
- [性能优化](#性能优化)
- [监控和日志](#监控和日志)
- [安全最佳实践](#安全最佳实践)

---

## 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 有效的 OpenRouter API Key

### 30秒快速部署

```bash
# 1. 克隆项目
git clone <repository-url>
cd llm-council-nextjs

# 2. 配置 API Key
echo "OPENROUTER_API_KEY=sk-or-v1-your-api-key" > .env

# 3. 启动服务
docker-compose up -d

# 4. 访问应用
open http://localhost:3000
```

### 使用交互式启动脚本

```bash
./start.sh
```

脚本会引导你：
1. 选择部署模式（本地/开发/生产/测试）
2. 配置环境变量
3. 自动启动服务

---

## 环境配置

### 环境变量文件

项目支持多环境配置：

```
.env.example          # 模板文件（提交到 git）
.env.local            # 本地开发覆盖
.env.development      # Docker 开发环境
.env.test            # Docker 测试环境
.env.production      # Docker 生产环境（不提交）
.env                 # Docker Compose 默认使用
```

### 必需配置

```bash
# OpenRouter API Key (必需)
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

### 可选配置

```bash
# 模型配置
COUNCIL_MODELS=deepseek/deepseek-v3.2-exp,google/gemini-3-pro-preview,anthropic/claude-sonnet-4.5,x-ai/grok-4
CHAIRMAN_MODEL=openai/gpt-4o

# 运行环境
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# 日志级别
LOG_LEVEL=info

# 数据目录
DATA_DIR=./data
```

完整的配置说明见 `env.example`。

---

## 部署模式

### 1. 开发模式 (推荐开发使用)

**特点**：
- 支持热重载
- 源代码通过 volume 挂载
- 详细的调试日志
- 快速迭代

**启动**：
```bash
# 方式1：使用启动脚本
./start.sh  # 选择选项 2

# 方式2：直接使用 docker-compose
docker-compose -f docker-compose.dev.yml up
```

**配置文件**：
- `Dockerfile.dev`
- `docker-compose.dev.yml`
- `.env.development`

**访问**：http://localhost:3000

**特性**：
```yaml
volumes:
  - .:/app                    # 源代码挂载
  - /app/node_modules         # node_modules 保留在容器内
  - /app/.next                # 构建缓存保留在容器内
  - ./data:/app/data          # 数据目录
```

---

### 2. 生产模式 (推荐生产部署)

**特点**：
- 优化的构建流程
- 最小化镜像大小
- 健康检查
- 资源限制
- 日志轮转

**启动**：
```bash
# 方式1：使用启动脚本
./start.sh  # 选择选项 3

# 方式2：使用部署脚本（推荐）
bash scripts/deploy.sh

# 方式3：直接使用 docker-compose
docker-compose up -d --build
```

**配置文件**：
- `Dockerfile`
- `docker-compose.yml`
- `.env` 或 `.env.production`

**访问**：http://localhost:3000

**特性**：
- 多阶段构建优化
- 非 root 用户运行
- 健康检查（30秒间隔）
- CPU/内存限制
- 日志轮转（10MB/文件，保留3个）

---

### 3. 测试模式

**特点**：
- 类生产环境
- 独立测试数据
- 详细日志

**启动**：
```bash
# 方式1：使用启动脚本
./start.sh  # 选择选项 4

# 方式2：直接使用 docker-compose
docker-compose -f docker-compose.test.yml up -d
```

**配置文件**：
- `Dockerfile`
- `docker-compose.test.yml`
- `.env.test`

**访问**：http://localhost:3001 (默认端口 3001)

---

## 常用命令

### 生产环境

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f llm-council

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看状态
docker-compose ps

# 重新构建并启动
docker-compose up -d --build

# 查看资源使用
docker stats llm-council-app

# 健康检查
bash scripts/healthcheck.sh
```

### 开发环境

```bash
# 启动开发服务
docker-compose -f docker-compose.dev.yml up

# 后台运行
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f

# 停止服务
docker-compose -f docker-compose.dev.yml down

# 进入容器调试
docker-compose -f docker-compose.dev.yml exec llm-council-dev sh
```

### 测试环境

```bash
# 启动测试服务
docker-compose -f docker-compose.test.yml up -d

# 查看日志
docker-compose -f docker-compose.test.yml logs -f

# 停止服务
docker-compose -f docker-compose.test.yml down
```

### 数据管理

```bash
# 备份数据
bash scripts/backup.sh

# 手动备份
tar -czf data-backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzf data-backup-YYYYMMDD.tar.gz

# 清理数据
docker-compose down -v  # 警告：会删除所有数据卷
```

### 镜像管理

```bash
# 查看镜像
docker images | grep llm-council

# 删除旧镜像
docker image prune -a

# 构建镜像（无缓存）
docker-compose build --no-cache

# 导出镜像
docker save llm-council:latest -o llm-council.tar

# 导入镜像
docker load -i llm-council.tar
```

---

## 故障排查

### 容器无法启动

**症状**：`docker-compose up` 失败

**检查步骤**：

1. 查看日志
```bash
docker-compose logs
```

2. 检查环境变量
```bash
cat .env
# 确保 OPENROUTER_API_KEY 已配置
```

3. 检查端口占用
```bash
lsof -i :3000
# 如果端口被占用，停止占用进程或修改端口
```

4. 检查 Docker 状态
```bash
docker ps -a
docker system df
```

---

### 健康检查失败

**症状**：容器状态显示 unhealthy

**解决方法**：

1. 查看健康检查日志
```bash
docker inspect llm-council-app | grep -A 20 Health
```

2. 手动测试健康检查
```bash
docker exec llm-council-app node /app/healthcheck.js
```

3. 查看应用日志
```bash
docker-compose logs -f llm-council
```

4. 检查资源限制
```bash
docker stats llm-council-app
# 如果内存或 CPU 超限，调整 docker-compose.yml 中的限制
```

---

### API 调用失败

**症状**：应用启动但 LLM 调用失败

**检查步骤**：

1. 验证 API Key
```bash
# 检查环境变量
docker-compose exec llm-council env | grep OPENROUTER_API_KEY
```

2. 测试 OpenRouter API
```bash
curl -H "Authorization: Bearer sk-or-v1-your-key" \
     https://openrouter.ai/api/v1/models
```

3. 查看应用日志中的错误
```bash
docker-compose logs llm-council | grep -i error
```

---

### 构建失败

**症状**：`docker-compose build` 失败

**常见原因**：

1. **网络问题**
```bash
# 使用国内镜像
docker build --build-arg HTTP_PROXY=http://proxy:port .
```

2. **磁盘空间不足**
```bash
# 清理 Docker 资源
docker system prune -a
```

3. **依赖安装失败**
```bash
# 使用 npm 国内源
# 在 Dockerfile 中添加：
# RUN npm config set registry https://registry.npmmirror.com
```

---

### 数据丢失

**预防措施**：

1. 定期备份
```bash
# 添加 cron 任务
0 2 * * * cd /path/to/llm-council && bash scripts/backup.sh
```

2. 使用命名卷
```yaml
# docker-compose.yml 中已配置
volumes:
  llm-council-data:
    driver: local
```

3. 检查卷挂载
```bash
docker volume inspect llm-council_llm-council-data
```

---

### 性能问题

**症状**：响应缓慢

**优化步骤**：

1. 检查资源使用
```bash
docker stats llm-council-app
```

2. 调整资源限制
```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '4'      # 增加 CPU
      memory: 4G     # 增加内存
```

3. 优化日志配置
```yaml
# docker-compose.yml
logging:
  options:
    max-size: "50m"  # 增加日志文件大小
```

4. 检查网络延迟
```bash
# 测试到 OpenRouter 的延迟
time curl -I https://openrouter.ai
```

---

## 性能优化

### 镜像优化

当前镜像大小：~200MB

**优化策略**：
- 使用 Alpine 基础镜像
- 多阶段构建
- 只安装生产依赖
- 清理构建缓存

### 构建缓存

利用 Docker 层缓存加速构建：

```dockerfile
# 依赖层单独构建，不频繁变化
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 源代码层，经常变化
COPY . .
RUN npm run build
```

### 运行时优化

1. **健康检查优化**
```yaml
healthcheck:
  interval: 30s      # 检查间隔
  timeout: 10s       # 超时时间
  retries: 3         # 重试次数
  start_period: 40s  # 启动宽限期
```

2. **资源限制**
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

3. **优雅关闭**
```yaml
stop_grace_period: 30s  # 给应用 30 秒时间优雅关闭
```

---

## 监控和日志

### 日志管理

**查看实时日志**：
```bash
docker-compose logs -f
```

**查看最近 N 行**：
```bash
docker-compose logs --tail=100
```

**过滤错误**：
```bash
docker-compose logs | grep -i error
```

**日志轮转配置**：
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"    # 每个日志文件最大 10MB
    max-file: "3"      # 保留最近 3 个文件
    compress: "true"   # 压缩旧日志
```

### 健康监控

**使用内置健康检查脚本**：
```bash
bash scripts/healthcheck.sh
```

**输出示例**：
```
✓ HTTP endpoint is accessible (HTTP 200)
✓ Container health status: healthy
✓ No errors found in recent logs
Resource usage: 5.2% CPU, 256MB / 2GB Memory
Overall Status: HEALTHY ✓
```

### 资源监控

**查看资源使用**：
```bash
docker stats llm-council-app --no-stream
```

**输出示例**：
```
CONTAINER         CPU %   MEM USAGE / LIMIT   MEM %
llm-council-app   5.2%    256MB / 2GB         12.8%
```

### 集成监控工具（可选）

**Prometheus + Grafana**：
```yaml
# 添加到 docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
```

---

## 安全最佳实践

### 1. 环境变量安全

**不要提交敏感信息到 Git**：
```bash
# .gitignore 中已包含
.env
.env.local
.env.*.local
.env.production
```

**使用 Docker Secrets (推荐生产环境)**：
```yaml
secrets:
  openrouter_api_key:
    external: true

services:
  llm-council:
    secrets:
      - openrouter_api_key
```

### 2. 容器安全

**非 root 用户运行** (已实现)：
```dockerfile
USER nextjs  # UID 1001
```

**只读文件系统** (可选)：
```yaml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /app/.next/cache
```

### 3. 网络安全

**使用自定义网络** (已实现)：
```yaml
networks:
  llm-council-network:
    driver: bridge
```

**限制端口暴露**：
```yaml
ports:
  - "127.0.0.1:3000:3000"  # 只监听本地
```

### 4. 镜像安全

**定期更新基础镜像**：
```bash
# 拉取最新 Node.js Alpine 镜像
docker pull node:20-alpine
docker-compose build --no-cache
```

**扫描安全漏洞**：
```bash
docker scan llm-council:latest
```

### 5. 数据安全

**定期备份**：
```bash
# 设置自动备份 cron 任务
0 2 * * * cd /path/to/llm-council && bash scripts/backup.sh
```

**加密敏感数据**：
```bash
# 使用 GPG 加密备份
gpg -c data-backup.tar.gz
```

---

## 生产部署检查清单

### 部署前

- [ ] 配置正确的 API Key
- [ ] 设置生产环境变量 (`.env` 或 `.env.production`)
- [ ] 配置合适的资源限制
- [ ] 设置日志轮转
- [ ] 配置健康检查
- [ ] 备份现有数据

### 部署时

- [ ] 使用 `scripts/deploy.sh` 或手动部署
- [ ] 验证容器启动成功
- [ ] 检查健康检查状态
- [ ] 验证应用可访问

### 部署后

- [ ] 测试完整功能流程
- [ ] 监控资源使用
- [ ] 检查日志输出
- [ ] 设置定期备份任务
- [ ] 配置监控告警（可选）

---

## 高级配置

### 反向代理（Nginx）

```nginx
# /etc/nginx/sites-available/llm-council
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### HTTPS 配置（Let's Encrypt）

```bash
# 安装 Certbot
apt-get install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d yourdomain.com

# 自动续期
certbot renew --dry-run
```

### 多实例部署

```bash
# 启动多个实例
docker-compose up -d --scale llm-council=3

# 使用 Nginx 负载均衡
upstream llm_council {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}
```

---

## 常见问题 (FAQ)

### Q: 如何切换模型配置？

A: 修改 `.env` 文件中的 `COUNCIL_MODELS` 和 `CHAIRMAN_MODEL`，然后重启容器：
```bash
docker-compose restart
```

### Q: 如何查看容器内部文件？

A: 进入容器：
```bash
docker-compose exec llm-council sh
```

### Q: 如何导出导入镜像到另一台机器？

A:
```bash
# 导出
docker save llm-council:latest | gzip > llm-council.tar.gz

# 传输到另一台机器后导入
gunzip -c llm-council.tar.gz | docker load
```

### Q: 如何限制日志大小？

A: 已在 `docker-compose.yml` 中配置日志轮转，默认每个文件 10MB，保留 3 个文件。

### Q: 开发模式下修改代码不生效？

A: 检查 volume 挂载是否正确，确保 `docker-compose.dev.yml` 中有：
```yaml
volumes:
  - .:/app
```

---

## 获取帮助

- **项目文档**：README.md
- **环境配置**：env.example
- **开发指南**：CLAUDE.md
- **问题反馈**：GitHub Issues

---

**更新时间**：2025-01-14
**文档版本**：1.0.0
