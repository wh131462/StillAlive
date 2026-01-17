# ============================================
# StillAlive - Makefile
# ============================================

.PHONY: help dev build deploy ssl logs restart stop clean

ENV_FILE ?= configs/.env.production
DOCKER_COMPOSE = docker-compose -f docker/docker-compose.yml

help: ## 显示帮助信息
	@echo "StillAlive - 可用命令:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ==================== 开发 ====================

dev: ## 启动开发环境
	pnpm dev

dev-db: ## 启动开发数据库
	docker-compose -f docker/docker-compose.dev.yml up -d

dev-db-stop: ## 停止开发数据库
	docker-compose -f docker/docker-compose.dev.yml down

install: ## 安装依赖
	pnpm install

# ==================== Docker ====================

build: ## 构建 Docker 镜像
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) build

up: ## 启动所有服务
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) up -d

down: ## 停止所有服务
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) down

restart: ## 重启所有服务
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) restart

logs: ## 查看日志
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) logs -f

ps: ## 查看服务状态
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) ps

# ==================== 部署 ====================

deploy: ## 部署应用
	./scripts/deploy.sh

ssl: ## 初始化 SSL 证书
	./scripts/init-ssl.sh

# ==================== 数据库 ====================

db-migrate: ## 运行数据库迁移
	$(DOCKER_COMPOSE) --env-file $(ENV_FILE) run --rm server npx prisma migrate deploy

db-studio: ## 启动 Prisma Studio
	cd apps/server && pnpm db:studio

db-backup: ## 备份数据库
	$(DOCKER_COMPOSE) exec postgres pg_dump -U stillalive stillalive > backup_$$(date +%Y%m%d_%H%M%S).sql

# ==================== 清理 ====================

clean: ## 清理构建产物
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/dist
	rm -rf packages/*/dist

docker-clean: ## 清理 Docker 资源
	docker system prune -af
	docker volume prune -f
