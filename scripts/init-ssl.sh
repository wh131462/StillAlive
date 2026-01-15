#!/bin/bash
# ============================================
# StillAlive - SSL 证书初始化脚本
# 使用 Let's Encrypt 获取 SSL 证书
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
DOMAIN="${DOMAIN:-still-alive.me}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@still-alive.me}"
STAGING="${STAGING:-0}"  # 设为 1 使用 Let's Encrypt 测试环境

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}StillAlive SSL 证书初始化${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "域名: $DOMAIN"
echo "邮箱: $EMAIL"
echo ""

# 检查必要目录
mkdir -p certbot/conf
mkdir -p certbot/www

# 创建临时 nginx 配置（用于 SSL 验证）
echo -e "${YELLOW}[1/4] 创建临时 Nginx 配置...${NC}"

cat > nginx/conf.d/temp.conf << 'EOF'
server {
    listen 80;
    server_name still-alive.me www.still-alive.me api.still-alive.me app.still-alive.me;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'StillAlive - SSL Setup in progress';
        add_header Content-Type text/plain;
    }
}
EOF

# 启动临时 nginx
echo -e "${YELLOW}[2/4] 启动 Nginx...${NC}"
docker-compose up -d nginx

# 等待 nginx 启动
sleep 5

# 请求证书
echo -e "${YELLOW}[3/4] 请求 SSL 证书...${NC}"

STAGING_ARG=""
if [ "$STAGING" = "1" ]; then
    STAGING_ARG="--staging"
    echo -e "${YELLOW}使用 Let's Encrypt 测试环境${NC}"
fi

docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $STAGING_ARG \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "api.$DOMAIN" \
    -d "app.$DOMAIN"

# 删除临时配置
echo -e "${YELLOW}[4/4] 清理临时配置...${NC}"
rm -f nginx/conf.d/temp.conf

# 重启服务
echo -e "${GREEN}重启所有服务...${NC}"
docker-compose down
docker-compose --env-file .env.production up -d

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}SSL 证书配置完成!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "访问以下地址测试:"
echo "  - https://$DOMAIN"
echo "  - https://api.$DOMAIN"
echo "  - https://app.$DOMAIN"
