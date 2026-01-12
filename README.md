# StillAlive

一款以「生存确认」和「记忆沉淀」为核心的轻量化打卡工具。

## 想法

活着，本身就值得庆祝。

每天早上或晚上，打个卡，告诉自己：**恭喜你又活过了一天**。

不需要写长篇大论，不需要精心排版，甚至可以什么都不记录——因为这只是一个打卡工具。但如果你愿意，可以记录今天有意义的事，可以为重要的人写一份「人物小传」。

我认为人活着最重要的东西就是记忆，在离开之前我们能想起的其实也只有回忆，所以为自己重要的人或事去记录，这个写下来的过程，本身就是加深记忆的过程，为自己增加回忆的节点。

### 核心功能

- **生存打卡** - 每日确认"我还活着"
- **意义记录** - 记录今天发生的有意义的事
- **人物小传** - 为重要的人建立情感档案，记录印象、经历、生日
- **死亡确认** - 连续多日未打卡时，向紧急联系人发送确认邮件

### 设计理念

- 轻量化，不强求记录
- 温和的文案，不制造焦虑
- 通过大事记和人物小传，创造与世界和现实的联系

## 项目结构

```
StillAlive/
├── apps/
│   ├── mobile/          # React Native (Expo) - 移动端App
│   ├── miniprogram/     # Taro - 微信小程序
│   ├── web/             # React + Vite - Web客户端
│   └── server/          # Fastify + Prisma - 后端服务
├── packages/
│   ├── types/           # 共享 TypeScript 类型定义
│   ├── utils/           # 共享工具函数
│   ├── api-client/      # API 客户端封装
│   └── ui/              # 共享 UI 组件
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 技术栈

| 模块 | 技术 |
|------|------|
| Monorepo | pnpm + Turborepo |
| Mobile | Expo (React Native) |
| 小程序 | Taro (React) |
| Web | React + Vite + TailwindCSS |
| Server | Fastify + Prisma |
| Database | PostgreSQL |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9
- PostgreSQL (后端开发需要)

### 安装依赖

```bash
# 安装 pnpm (如果没有)
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 启动开发服务器

```bash
# 启动所有服务
pnpm dev

# 或单独启动某个服务
pnpm dev:mobile      # 移动端 App
pnpm dev:web         # Web 客户端
pnpm dev:miniprogram # 微信小程序
pnpm dev:server      # 后端服务
```

### 后端配置

1. 复制环境变量文件：
```bash
cp apps/server/.env.example apps/server/.env
```

2. 配置数据库连接：
```env
DATABASE_URL="postgresql://user:password@localhost:5432/stillalive"
```

3. 初始化数据库：
```bash
cd apps/server
pnpm db:push
```

## 功能模块

### 主页
- 生存状态卡片
- 快速打卡按钮
- 今日生日提醒
- 每日信息差
- 今日有意义的事记录

### 打卡
- 打卡统计
- 月度日历视图
- 历史记录列表

### 人物记
- 人物列表
- 今日生日
- 人物详情与情感档案

### 我的
- 个人信息
- 死亡确认设置
- 打卡提醒设置

## 开发命令

```bash
# 构建所有项目
pnpm build

# 代码检查
pnpm lint

# 清理构建产物
pnpm clean
```

## 目录说明

### apps/mobile
Expo 项目，使用 expo-router 进行文件系统路由。

### apps/miniprogram
Taro 项目，支持编译到微信小程序、支付宝小程序、H5等多端。

### apps/web
Vite + React 项目，使用 react-router-dom 进行路由管理。

### apps/server
Fastify 后端服务，使用 Prisma 进行数据库操作。

### packages/types
共享的 TypeScript 类型定义，确保前后端类型一致。

### packages/utils
共享的工具函数，如日期处理、文案生成等。

### packages/api-client
封装的 API 客户端，提供统一的接口调用方式。

### packages/ui
共享的 UI 组件库，基于 TailwindCSS。

## License

MIT
