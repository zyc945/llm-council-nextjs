#!/bin/bash

# ============================================
# LLM Council - Health Check Script
# ============================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取端口
PORT="${PORT:-3000}"

echo "Checking service health on port $PORT..."
echo ""

# HTTP 健康检查
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} HTTP endpoint is accessible (HTTP $HTTP_CODE)"
    HTTP_STATUS="healthy"
else
    echo -e "${RED}✗${NC} HTTP endpoint failed (HTTP $HTTP_CODE)"
    HTTP_STATUS="unhealthy"
fi

# Docker 容器状态检查
echo ""
echo "Docker container status:"
docker-compose ps

# Docker 健康检查状态
echo ""
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' llm-council-app 2>/dev/null || echo "unknown")

case "$HEALTH_STATUS" in
    "healthy")
        echo -e "${GREEN}✓${NC} Container health status: healthy"
        ;;
    "unhealthy")
        echo -e "${RED}✗${NC} Container health status: unhealthy"
        ;;
    "starting")
        echo -e "${YELLOW}⟳${NC} Container health status: starting"
        ;;
    *)
        echo -e "${YELLOW}?${NC} Container health status: $HEALTH_STATUS"
        ;;
esac

# 检查容器日志中的错误
echo ""
echo "Recent errors in logs:"
ERROR_COUNT=$(docker-compose logs --tail=100 | grep -i "error" | wc -l | tr -d ' ')

if [ "$ERROR_COUNT" -gt "0" ]; then
    echo -e "${YELLOW}⚠${NC}  Found $ERROR_COUNT error(s) in recent logs"
    docker-compose logs --tail=10 | grep -i "error"
else
    echo -e "${GREEN}✓${NC} No errors found in recent logs"
fi

# 资源使用情况
echo ""
echo "Resource usage:"
docker stats llm-council-app --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 总体状态
echo ""
echo "============================================"
if [ "$HTTP_STATUS" = "healthy" ] && [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}Overall Status: HEALTHY ✓${NC}"
    exit 0
else
    echo -e "${RED}Overall Status: UNHEALTHY ✗${NC}"
    exit 1
fi
