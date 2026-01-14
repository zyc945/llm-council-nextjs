#!/bin/bash

# ============================================
# LLM Council - Interactive Startup Script
# Supports: Local Dev, Docker Dev, Docker Prod, Docker Test
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印标题
clear
echo -e "${CYAN}"
echo "============================================"
echo "  🚀 LLM Council - Next.js"
echo "============================================"
echo -e "${NC}"

# 检查 Docker 是否可用
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    DOCKER_AVAILABLE=true
fi

# 显示启动模式选择
echo "请选择启动模式："
echo ""
echo -e "${GREEN}1.${NC} 本地开发模式 (npm run dev，支持热重载)"
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo -e "${BLUE}2.${NC} Docker 开发模式 (docker-compose.dev.yml，容器内热重载)"
    echo -e "${BLUE}3.${NC} Docker 生产模式 (docker-compose.yml，生产构建)"
    echo -e "${BLUE}4.${NC} Docker 测试模式 (docker-compose.test.yml，测试环境)"
else
    echo -e "${YELLOW}   (Docker 未安装或未启动，Docker 选项不可用)${NC}"
fi
echo ""
read -p "请输入选项 [1-4，默认 1]: " MODE
MODE=${MODE:-1}

# ============================================
# 环境变量配置函数
# ============================================
setup_env() {
    local ENV_FILE=$1
    local ENV_TYPE=$2

    if [ ! -f "$ENV_FILE" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  未找到 $ENV_FILE 文件${NC}"

        if [ -f "env.example" ]; then
            read -p "是否从 env.example 创建？(y/n): " CREATE_ENV
            if [ "$CREATE_ENV" = "y" ] || [ "$CREATE_ENV" = "Y" ]; then
                cp env.example "$ENV_FILE"
                echo -e "${GREEN}✓${NC} 已创建 $ENV_FILE"
            else
                echo -e "${RED}✗${NC} 无法继续，缺少环境配置文件"
                exit 1
            fi
        fi
    fi

    # 检查 API Key
    if ! grep -q "OPENROUTER_API_KEY=sk-or-v1-" "$ENV_FILE" 2>/dev/null; then
        echo ""
        echo -e "${YELLOW}⚠️  OPENROUTER_API_KEY 未配置${NC}"
        read -p "请输入您的 OpenRouter API Key: " API_KEY

        if grep -q "^OPENROUTER_API_KEY=" "$ENV_FILE"; then
            # 替换现有的
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$API_KEY|" "$ENV_FILE"
            else
                sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$API_KEY|" "$ENV_FILE"
            fi
        else
            # 添加新的
            echo "OPENROUTER_API_KEY=$API_KEY" >> "$ENV_FILE"
        fi

        echo -e "${GREEN}✓${NC} API Key 已保存到 $ENV_FILE"
    fi

    # 可选：配置模型
    echo ""
    read -p "是否自定义模型配置？(y/n，默认使用推荐配置): " CUSTOM_MODELS
    if [ "$CUSTOM_MODELS" = "y" ] || [ "$CUSTOM_MODELS" = "Y" ]; then
        echo ""
        echo "请输入议会成员模型（逗号分隔，留空使用默认）："
        echo "推荐: deepseek/deepseek-v3.2-exp,google/gemini-3-pro-preview,anthropic/claude-sonnet-4.5,x-ai/grok-4"
        read -p "COUNCIL_MODELS: " COUNCIL_MODELS

        if [ ! -z "$COUNCIL_MODELS" ]; then
            if grep -q "^COUNCIL_MODELS=" "$ENV_FILE"; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|^COUNCIL_MODELS=.*|COUNCIL_MODELS=$COUNCIL_MODELS|" "$ENV_FILE"
                else
                    sed -i "s|^COUNCIL_MODELS=.*|COUNCIL_MODELS=$COUNCIL_MODELS|" "$ENV_FILE"
                fi
            else
                echo "COUNCIL_MODELS=$COUNCIL_MODELS" >> "$ENV_FILE"
            fi
        fi

        echo ""
        echo "请输入主席模型（留空使用默认 openai/gpt-4o）："
        read -p "CHAIRMAN_MODEL: " CHAIRMAN_MODEL

        if [ ! -z "$CHAIRMAN_MODEL" ]; then
            if grep -q "^CHAIRMAN_MODEL=" "$ENV_FILE"; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|^CHAIRMAN_MODEL=.*|CHAIRMAN_MODEL=$CHAIRMAN_MODEL|" "$ENV_FILE"
                else
                    sed -i "s|^CHAIRMAN_MODEL=.*|CHAIRMAN_MODEL=$CHAIRMAN_MODEL|" "$ENV_FILE"
                fi
            else
                echo "CHAIRMAN_MODEL=$CHAIRMAN_MODEL" >> "$ENV_FILE"
            fi
        fi
    fi

    echo ""
    echo -e "${GREEN}✓${NC} 环境配置完成"
}

# ============================================
# 本地开发模式
# ============================================
start_local_dev() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  启动本地开发模式${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"

    # 配置环境变量
    setup_env ".env.local" "development"

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo ""
        echo -e "${BLUE}📦 安装依赖...${NC}"
        npm install
    fi

    echo ""
    echo -e "${GREEN}🔧 启动开发服务器...${NC}"
    echo ""
    echo -e "${CYAN}访问地址: ${GREEN}http://localhost:3000${NC}"
    echo -e "${CYAN}按 Ctrl+C 停止服务${NC}"
    echo ""

    npm run dev
}

# ============================================
# Docker 开发模式
# ============================================
start_docker_dev() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}  启动 Docker 开发模式${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"

    # 配置环境变量
    setup_env ".env.development" "development"

    # 如果 .env 不存在，复制 .env.development
    if [ ! -f ".env" ]; then
        cp .env.development .env
    fi

    echo ""
    echo -e "${BLUE}🐳 启动 Docker 容器...${NC}"
    docker-compose -f docker-compose.dev.yml up -d

    echo ""
    echo -e "${GREEN}✅ 服务已启动！${NC}"
    echo ""
    echo -e "${CYAN}访问地址: ${GREEN}http://localhost:3000${NC}"
    echo ""
    echo "常用命令:"
    echo "  查看日志:  docker-compose -f docker-compose.dev.yml logs -f"
    echo "  停止服务:  docker-compose -f docker-compose.dev.yml down"
    echo "  重启服务:  docker-compose -f docker-compose.dev.yml restart"
    echo ""
}

# ============================================
# Docker 生产模式
# ============================================
start_docker_prod() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}  启动 Docker 生产模式${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"

    # 配置环境变量
    setup_env ".env" "production"

    # 可选：使用部署脚本
    if [ -f "scripts/deploy.sh" ]; then
        read -p "是否使用完整部署脚本（包含备份和健康检查）？(y/n): " USE_DEPLOY
        if [ "$USE_DEPLOY" = "y" ] || [ "$USE_DEPLOY" = "Y" ]; then
            bash scripts/deploy.sh
            return
        fi
    fi

    echo ""
    echo -e "${BLUE}🐳 启动 Docker 容器...${NC}"
    docker-compose up -d --build

    echo ""
    echo -e "${GREEN}✅ 服务已启动！${NC}"
    echo ""
    echo -e "${CYAN}访问地址: ${GREEN}http://localhost:3000${NC}"
    echo ""
    echo "常用命令:"
    echo "  查看日志:  docker-compose logs -f"
    echo "  停止服务:  docker-compose down"
    echo "  重启服务:  docker-compose restart"
    echo "  健康检查:  bash scripts/healthcheck.sh"
    echo ""
}

# ============================================
# Docker 测试模式
# ============================================
start_docker_test() {
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  启动 Docker 测试模式${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════${NC}"

    # 配置环境变量
    setup_env ".env.test" "test"

    echo ""
    echo -e "${BLUE}🐳 启动 Docker 测试容器...${NC}"
    docker-compose -f docker-compose.test.yml up -d --build

    echo ""
    echo -e "${GREEN}✅ 测试环境已启动！${NC}"
    echo ""
    echo -e "${CYAN}访问地址: ${GREEN}http://localhost:3001${NC}"
    echo ""
    echo "常用命令:"
    echo "  查看日志:  docker-compose -f docker-compose.test.yml logs -f"
    echo "  停止服务:  docker-compose -f docker-compose.test.yml down"
    echo "  重启服务:  docker-compose -f docker-compose.test.yml restart"
    echo ""
}

# ============================================
# 主逻辑
# ============================================

case $MODE in
    1)
        start_local_dev
        ;;
    2)
        if [ "$DOCKER_AVAILABLE" = true ]; then
            start_docker_dev
        else
            echo -e "${RED}✗${NC} Docker 不可用，请安装 Docker 后再试"
            exit 1
        fi
        ;;
    3)
        if [ "$DOCKER_AVAILABLE" = true ]; then
            start_docker_prod
        else
            echo -e "${RED}✗${NC} Docker 不可用，请安装 Docker 后再试"
            exit 1
        fi
        ;;
    4)
        if [ "$DOCKER_AVAILABLE" = true ]; then
            start_docker_test
        else
            echo -e "${RED}✗${NC} Docker 不可用，请安装 Docker 后再试"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}✗${NC} 无效选项"
        exit 1
        ;;
esac
