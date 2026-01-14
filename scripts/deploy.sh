#!/bin/bash

# ============================================
# LLM Council - Production Deployment Script
# ============================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示标题
echo ""
echo "============================================"
echo "  LLM Council - Production Deployment"
echo "============================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    log_warning ".env file not found"

    if [ -f .env.production ]; then
        log_info "Copying .env.production to .env"
        cp .env.production .env
    elif [ -f env.example ]; then
        log_warning "Creating .env from env.example"
        cp env.example .env
        log_error "Please edit .env file and add your OPENROUTER_API_KEY"
        exit 1
    else
        log_error "No environment file found. Please create .env file."
        exit 1
    fi
fi

# 检查 API Key
if ! grep -q "OPENROUTER_API_KEY=sk-or-v1-" .env; then
    log_error "OPENROUTER_API_KEY not configured in .env file"
    exit 1
fi

# 备份数据目录
DATA_DIR="${DATA_DIR:-./data}"
if [ -d "$DATA_DIR" ] && [ "$(ls -A $DATA_DIR)" ]; then
    BACKUP_DIR="./backups/data-$(date +%Y%m%d-%H%M%S)"
    log_info "Backing up data directory to $BACKUP_DIR"
    mkdir -p ./backups
    cp -r "$DATA_DIR" "$BACKUP_DIR"
    log_success "Data backup created at $BACKUP_DIR"
fi

# 设置构建参数
export BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

log_info "Build time: $BUILD_TIME"
log_info "Git commit: $GIT_COMMIT"

# 停止现有容器
log_info "Stopping existing containers..."
docker-compose down

# 构建新镜像
log_info "Building Docker image..."
docker-compose build --no-cache

# 启动容器
log_info "Starting containers..."
docker-compose up -d

# 等待服务启动
log_info "Waiting for service to be healthy..."
sleep 10

# 健康检查
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose ps | grep -q "healthy"; then
        log_success "Service is healthy!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_info "Waiting for health check... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Service failed to become healthy"
    log_info "Checking logs..."
    docker-compose logs --tail=50
    exit 1
fi

# 显示状态
echo ""
log_success "Deployment completed successfully!"
echo ""
echo "============================================"
echo "  Service Information"
echo "============================================"
docker-compose ps
echo ""

# 显示访问信息
PORT=$(grep "^PORT=" .env | cut -d '=' -f2 || echo "3000")
echo "🚀 Service is running at: http://localhost:${PORT}"
echo ""
echo "Useful commands:"
echo "  View logs:       docker-compose logs -f"
echo "  Check status:    docker-compose ps"
echo "  Stop service:    docker-compose down"
echo "  Restart service: docker-compose restart"
echo ""
