#!/bin/bash

# ============================================
# LLM Council - Data Backup Script
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
DATA_DIR="${DATA_DIR:-./data}"
BACKUP_BASE_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="llm-council-data-$TIMESTAMP"
BACKUP_PATH="$BACKUP_BASE_DIR/$BACKUP_NAME"

# 保留的备份数量
KEEP_BACKUPS=${KEEP_BACKUPS:-7}

echo ""
echo "============================================"
echo "  LLM Council - Data Backup"
echo "============================================"
echo ""

# 检查数据目录
if [ ! -d "$DATA_DIR" ]; then
    log_error "Data directory not found: $DATA_DIR"
    exit 1
fi

if [ ! "$(ls -A $DATA_DIR)" ]; then
    log_error "Data directory is empty: $DATA_DIR"
    exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_BASE_DIR"

# 执行备份
log_info "Backing up data from $DATA_DIR"
log_info "Backup destination: $BACKUP_PATH"

cp -r "$DATA_DIR" "$BACKUP_PATH"

# 压缩备份
log_info "Compressing backup..."
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_BASE_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"

# 获取备份大小
BACKUP_SIZE=$(du -h "$BACKUP_PATH.tar.gz" | cut -f1)
log_success "Backup created: $BACKUP_PATH.tar.gz ($BACKUP_SIZE)"

# 清理旧备份
log_info "Cleaning up old backups (keeping last $KEEP_BACKUPS backups)..."
cd "$BACKUP_BASE_DIR"
ls -t llm-council-data-*.tar.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
cd - > /dev/null

REMAINING_BACKUPS=$(ls "$BACKUP_BASE_DIR"/llm-council-data-*.tar.gz 2>/dev/null | wc -l)
log_info "Total backups: $REMAINING_BACKUPS"

# 显示备份列表
echo ""
echo "Available backups:"
ls -lh "$BACKUP_BASE_DIR"/llm-council-data-*.tar.gz 2>/dev/null || echo "No backups found"

echo ""
log_success "Backup completed successfully!"
echo ""
echo "To restore this backup:"
echo "  tar -xzf $BACKUP_PATH.tar.gz -C $BACKUP_BASE_DIR"
echo "  rm -rf $DATA_DIR"
echo "  mv $BACKUP_BASE_DIR/$BACKUP_NAME $DATA_DIR"
echo ""
