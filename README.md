# StillAlive - 还活着

> "还活着吗？"——一款以生存确认和记忆沉淀为核心的多端打卡应用。

## 想法

活着，本身就值得庆祝。

每天早上或晚上，打个卡，告诉自己：**恭喜你又活过了一天**。

不需要写长篇大论，不需要精心排版，甚至可以什么都不记录——因为这只是一个打卡工具。但如果你愿意，可以记录今天有意义的事，可以为重要的人写一份「人物小传」，还可以阅读和分享那些"差点就没了，但我现在还活着"的真实故事。

写下来的过程，本身就是加深记忆的过程，为自己增加回忆的节点。

### 核心功能

- **生存打卡** - 每日确认"我还活着"
- **意义记录** - 记录今天发生的有意义的事
- **人物小传** - 为重要的人建立情感档案
- **故事社区** - 匿名生命韧性故事，阅读与共鸣
- **死亡确认** - 连续多日未打卡时，向紧急联系人发送确认邮件

## 项目结构

```
stillalive/
├── apps/
│   ├── server/          # Node.js + Express - 后端 API
│   ├── web/             # React - Web 客户端
│   ├── mobile/          # React Native - iOS/Android App
│   └── miniapp/         # Taro (React) - 微信小程序
├── packages/
│   ├── types/           # @stillalive/types — TS 接口定义
│   ├── api/             # @stillalive/api — API 请求封装
│   ├── core/            # @stillalive/core — 纯函数工具库
│   └── tokens/          # @stillalive/tokens — 设计 Token
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile.server
├── docs/                # 产品文档
├── pnpm-workspace.yaml
└── turbo.json
```

## 技术栈

| 模块 | 技术 |
|------|------|
| Monorepo | pnpm workspace + Turborepo |
| 后端 | Node.js + Express + Prisma |
| 数据库 | PostgreSQL |
| App | React Native |
| Web | React |
| 小程序 | Taro (React) |
| 鉴权 | JWT (access + refresh token) |
| 文件存储 | 阿里云 OSS / 腾讯云 COS |
| 部署 | Docker Compose |

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 16+

### 安装

```bash
pnpm install
```

### 启动开发

```bash
# 启动后端 + 数据库
docker compose -f docker/docker-compose.yml up -d postgres redis
pnpm --filter @stillalive/server dev

# 启动 Web
pnpm --filter @stillalive/web dev

# 启动 App
pnpm --filter @stillalive/mobile dev

# 启动小程序
pnpm --filter @stillalive/miniapp dev
```

### 构建

```bash
pnpm build
```

## 文档

- [产品需求文档 (PRD)](docs/PRD.md)
- [设计规范](docs/DESIGN_SPEC.md)
- [技术架构](docs/ARCHITECTURE.md)
- [后端 API](docs/BACKEND.md)
- [部署指南](docs/DEPLOYMENT.md)

## License

MIT
