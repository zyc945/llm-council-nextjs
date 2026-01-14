# ============================================
# LLM Council - Production Dockerfile
# Multi-stage build for optimized image size
# ============================================

# 基础镜像
FROM node:20-alpine AS base
WORKDIR /app

# 安装必要的系统依赖
RUN apk add --no-cache \
    libc6-compat \
    dumb-init

# ============================================
# 依赖安装阶段
# ============================================
FROM base AS deps

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装生产依赖（使用 npm ci 确保确定性构建）
RUN npm ci --omit=dev && \
    npm cache clean --force

# ============================================
# 构建阶段
# ============================================
FROM base AS builder

# 接收构建参数
ARG BUILD_TIME
ARG GIT_COMMIT
ARG NODE_ENV=production

ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建应用
RUN npm run build && \
    # 清理构建缓存
    rm -rf .next/cache

# ============================================
# 生产运行阶段
# ============================================
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 创建数据目录（将通过 volume 挂载）
RUN mkdir -p /app/data/conversations && \
    chown -R nextjs:nodejs /app/data && \
    chmod -R 755 /app/data

# 添加健康检查脚本
COPY --chown=nextjs:nodejs <<'EOF' /app/healthcheck.js
const http = require('http');
const options = {
  host: 'localhost',
  port: 3000,
  path: '/',
  timeout: 2000
};
const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.on('timeout', () => process.exit(1));
req.end();
EOF

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node /app/healthcheck.js

# 使用 dumb-init 作为 PID 1，优雅处理信号
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# 启动应用
CMD ["node", "server.js"]

