# StillAlive 部署指南

## 快速开始

### 1. 服务器要求

- Ubuntu 20.04+ / Debian 11+
- 2GB RAM (最低)
- 20GB 磁盘空间
- Docker & Docker Compose
- 域名已解析到服务器 IP

### 2. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
sudo apt install docker-compose-plugin

# 启动 Docker
sudo systemctl enable docker
sudo systemctl start docker
```

### 3. 克隆项目

```bash
git clone https://github.com/your-username/stillalive.git
cd stillalive
```

### 4. 配置环境变量

```bash
# 复制环境配置模板
cp .env.example .env.production

# 编辑配置文件
nano .env.production
```

**必须修改的配置项:**

```env
# 数据库密码 (使用强密码)
POSTGRES_PASSWORD=your_secure_password_here

# JWT 密钥 (使用随机字符串)
JWT_SECRET=your_very_secure_jwt_secret_key_here

# 邮件配置 (用于死亡确认功能)
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your_email@qq.com
SMTP_PASS=your_smtp_authorization_code

# SSL 证书邮箱
LETSENCRYPT_EMAIL=your_email@example.com
```

### 5. 初始化 SSL 证书

```bash
# 添加执行权限
chmod +x scripts/init-ssl.sh

# 运行 SSL 初始化
./scripts/init-ssl.sh
```

### 6. 部署

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

---

## 域名配置

确保以下域名都解析到你的服务器 IP:

| 子域名 | 用途 |
|--------|------|
| `still-alive.me` | 门户网站 |
| `www.still-alive.me` | 门户网站 (重定向) |
| `api.still-alive.me` | API 服务器 |
| `app.still-alive.me` | Web 应用 |

### DNS 配置示例 (A 记录)

```
still-alive.me      A    YOUR_SERVER_IP
www                 A    YOUR_SERVER_IP
api                 A    YOUR_SERVER_IP
app                 A    YOUR_SERVER_IP
```

---

## 常用命令

### 查看服务状态

```bash
docker-compose ps
```

### 查看日志

```bash
# 所有服务
docker-compose logs -f

# 指定服务
docker-compose logs -f server
docker-compose logs -f nginx
```

### 重启服务

```bash
docker-compose restart
```

### 停止服务

```bash
docker-compose down
```

### 更新部署

```bash
git pull
./scripts/deploy.sh
```

### 数据库备份

```bash
docker-compose exec postgres pg_dump -U stillalive stillalive > backup_$(date +%Y%m%d).sql
```

### 数据库恢复

```bash
docker-compose exec -T postgres psql -U stillalive stillalive < backup_20241215.sql
```

---

## 目录结构

```
/your-project/
├── .env.production     # 生产环境配置 (不要提交!)
├── docker-compose.yml  # Docker 编排
├── Dockerfile.*        # 各服务 Dockerfile
├── nginx/              # Nginx 配置
│   ├── nginx.conf
│   └── conf.d/
├── certbot/           # SSL 证书 (自动生成)
│   ├── conf/
│   └── www/
├── downloads/         # APK 下载目录
└── scripts/           # 部署脚本
```

---

## 上传 APK

将 Android APK 放到 `downloads/` 目录:

```bash
mkdir -p downloads
cp your-app.apk downloads/stillalive.apk
```

访问: `https://still-alive.me/downloads/stillalive.apk`

---

## SSL 证书续期

证书会自动续期 (certbot 容器每 12 小时检查一次)。

手动续期:

```bash
docker-compose run --rm certbot renew
docker-compose restart nginx
```

---

## 故障排除

### 1. 502 Bad Gateway

```bash
# 检查后端服务
docker-compose logs server

# 重启后端
docker-compose restart server
```

### 2. SSL 证书问题

```bash
# 检查证书
ls -la certbot/conf/live/still-alive.me/

# 重新申请证书
rm -rf certbot/conf/live/still-alive.me
./scripts/init-ssl.sh
```

### 3. 数据库连接失败

```bash
# 检查数据库容器
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres
```

### 4. 内存不足

```bash
# 检查内存使用
docker stats

# 清理无用镜像
docker system prune -a
```

---

## 安全建议

1. **定期更新** - 保持系统和 Docker 镜像更新
2. **强密码** - 使用复杂的数据库密码和 JWT 密钥
3. **备份** - 定期备份数据库
4. **防火墙** - 只开放 80/443 端口
5. **监控** - 设置服务监控告警

---

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DOMAIN` | 主域名 | still-alive.me |
| `POSTGRES_USER` | 数据库用户名 | stillalive |
| `POSTGRES_PASSWORD` | 数据库密码 | (必填) |
| `POSTGRES_DB` | 数据库名 | stillalive |
| `JWT_SECRET` | JWT 签名密钥 | (必填) |
| `SERVER_PORT` | 服务端口 | 4000 |
| `SMTP_HOST` | 邮件服务器 | smtp.qq.com |
| `SMTP_PORT` | 邮件端口 | 465 |
| `SMTP_USER` | 邮件账号 | (必填) |
| `SMTP_PASS` | 邮件授权码 | (必填) |
| `ENABLE_DEATH_CONFIRMATION` | 启用死亡确认 | true |
| `VITE_API_URL` | 前端 API 地址 | https://api.still-alive.me |
| `LETSENCRYPT_EMAIL` | SSL 证书邮箱 | (必填) |
