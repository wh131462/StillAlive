#!/bin/bash
# ============================================
# StillAlive - 部署脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
ENV_FILE="${ENV_FILE:-.env.production}"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}StillAlive 部署${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# 检查环境文件
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}错误: 环境文件 $ENV_FILE 不存在${NC}"
    echo "请先复制 .env.example 为 $ENV_FILE 并填写配置"
    exit 1
fi

echo -e "${YELLOW}[1/5] 加载环境变量...${NC}"
source "$ENV_FILE"

echo -e "${YELLOW}[2/5] 拉取最新代码...${NC}"
git pull origin main || true

echo -e "${YELLOW}[3/5] 构建 Docker 镜像...${NC}"
docker-compose --env-file "$ENV_FILE" build

echo -e "${YELLOW}[4/5] 运行数据库迁移...${NC}"
docker-compose --env-file "$ENV_FILE" run --rm server npx prisma migrate deploy

echo -e "${YELLOW}[5/5] 启动服务...${NC}"
docker-compose --env-file "$ENV_FILE" up -d

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}部署完成!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "服务状态:"
docker-compose ps
echo ""
echo "查看日志: docker-compose logs -f"
