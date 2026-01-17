# 技术架构 - 今天又活了一天

> 核心理念：**Local-First**，前端本地存储为主，后端仅做数据同步与增值服务

---

## 1. 架构概述

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    客户端 (Web/Mobile/小程序)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 本地存储     │  │ 离线队列     │  │ 同步引擎               │  │
│  │ IndexedDB   │  │ Pending Ops │  │ Conflict Resolution    │  │
│  │ SQLite      │  │             │  │                        │  │
│  │ AsyncStorage│  │             │  │                        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 同步 (仅在有网络时)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        轻后端服务                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 认证服务     │  │ 数据同步     │  │ 增值服务               │  │
│  │ JWT/OAuth  │  │ CRDT/OT    │  │ - 年度总结生成          │  │
│  │             │  │             │  │ - 每日信息差            │  │
│  │             │  │             │  │ - 死亡确认邮件          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 职责边界

```
✅ 后端负责:
   - 用户认证
   - 跨设备数据同步
   - AI 年度总结生成
   - 每日信息差内容
   - 死亡确认邮件

❌ 后端不负责:
   - 打卡逻辑
   - 统计计算
   - 人物管理
   - 本地通知
   - UI 状态
```

---

## 2. 本地优先策略

### 2.1 前端本地完成的功能

| 功能模块 | 本地实现 | 说明 |
|---------|---------|------|
| **打卡** | ✅ 完全本地 | 本地存储打卡记录，离线可用 |
| **打卡统计** | ✅ 完全本地 | 本地计算总天数、连续打卡等 |
| **人物档案** | ✅ 完全本地 | CRUD 全部本地完成 |
| **生日提醒** | ✅ 完全本地 | 本地计算今日生日 |
| **打卡日历** | ✅ 完全本地 | 本地渲染日历数据 |
| **搜索过滤** | ✅ 完全本地 | 人物搜索、记录筛选 |
| **打卡提醒** | ✅ 完全本地 | 本地通知 / 系统闹钟 |
| **用户设置** | ✅ 完全本地 | 提醒时间、主题等 |

### 2.2 本地存储方案

```typescript
// 统一存储接口
interface LocalStorage {
  // 基础 CRUD
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;

  // 批量操作
  getAll<T>(prefix: string): Promise<T[]>;

  // 查询
  query<T>(collection: string, filter: QueryFilter): Promise<T[]>;
}

// 各平台实现
// Web: IndexedDB (Dexie.js)
// Mobile: SQLite (expo-sqlite) 或 MMKV
// 小程序: wx.getStorage + 本地数据库
```

---

## 3. 数据模型

### 3.1 本地数据结构

```typescript
// 打卡记录
interface LocalCheckin {
  id: string;           // uuid
  date: string;         // YYYY-MM-DD
  content?: string;     // 有意义的事
  photo?: string;       // 本地图片路径或 base64
  createdAt: number;    // timestamp
  updatedAt: number;
  syncStatus: 'pending' | 'synced' | 'conflict';
  syncedAt?: number;
}

// 人物档案
interface LocalPerson {
  id: string;
  name: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: string;    // MM-DD
  birthYear?: number;
  photo?: string;       // 本地路径
  mbti?: string;
  impression?: string;
  experience?: string;
  createdAt: number;
  updatedAt: number;
  syncStatus: 'pending' | 'synced' | 'conflict';
}

// 用户设置 (仅本地)
interface LocalSettings {
  reminderEnabled: boolean;
  reminderTime: string;  // HH:mm
  theme: 'light' | 'dark' | 'system';
  // 不需要同步的本地偏好
}
```

### 3.2 服务端数据结构

```prisma
// 用户表 - 仅存储认证信息
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  password      String
  nickname      String?
  createdAt     DateTime @default(now())

  // 关联
  syncData      SyncData?
  emergency     EmergencyConfig?
}

// 同步数据 - 存储用户的全部同步数据
model SyncData {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])

  // JSON 存储所有数据 (简化设计)
  checkins      Json     @default("[]")
  people        Json     @default("[]")

  lastSyncAt    DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// 紧急配置
model EmergencyConfig {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])

  email         String
  triggerDays   Int      @default(7)
  isEnabled     Boolean  @default(false)
  lastNotifiedAt DateTime?
}
```

---

## 4. 数据同步策略

### 4.1 同步时机

```typescript
// 同步触发条件
const SyncTriggers = {
  // 自动同步
  APP_FOREGROUND: true,      // 应用进入前台
  NETWORK_RESTORED: true,    // 网络恢复
  PERIODIC: '30min',         // 定期同步 (后台)

  // 手动同步
  USER_TRIGGERED: true,      // 用户手动触发
  BEFORE_LOGOUT: true,       // 登出前
};
```

### 4.2 增量同步

```typescript
// 只同步变更的数据
POST /api/sync/push
{
  "lastSyncAt": 1705123456000,  // 上次同步时间戳
  "changes": [
    // 只包含 updatedAt > lastSyncAt 的记录
  ]
}
```

### 4.3 冲突解决

```typescript
// Last-Write-Wins 策略 (简单场景)
function resolveConflict(local: Record, remote: Record): Record {
  return local.updatedAt > remote.updatedAt ? local : remote;
}

// 或者让用户选择
interface ConflictResolution {
  conflictId: string;
  localVersion: Record;
  remoteVersion: Record;
  resolution: 'keep_local' | 'keep_remote' | 'merge';
}
```

---

## 5. 技术栈

### 5.1 后端技术栈

| 类别 | 技术选型 |
|------|----------|
| 框架 | Fastify 或 Hono (更轻量) |
| 数据库 | PostgreSQL + Prisma |
| 缓存 | Redis (可选，用于每日信息差缓存) |
| 定时任务 | node-cron 或 BullMQ |
| 邮件 | nodemailer + 邮件模板 |
| AI | Claude API 或 OpenAI API |
| 部署 | Vercel / Railway / Fly.io |

### 5.2 前端本地存储

| 平台 | 技术选型 |
|------|----------|
| Web | IndexedDB (Dexie.js) |
| Mobile | expo-sqlite 或 MMKV |
| 小程序 | wx.getStorage + 本地计算 |

---

## 6. 成本估算

### 6.1 服务器成本 (轻后端优势)

| 服务 | 方案 | 预估成本/月 |
|------|------|------------|
| 后端托管 | Vercel/Railway Free Tier | $0 |
| 数据库 | Supabase/PlanetScale Free | $0 |
| 邮件 | Resend (100封/天免费) | $0 |
| AI API | Claude/OpenAI (按需) | $5-20 |

**总计: $0-20/月** (小规模用户)

### 6.2 对比传统后端

| 对比项 | 传统重后端 | 轻后端 + 本地优先 |
|--------|-----------|------------------|
| 服务器 | 持续运行 $20+/月 | Serverless 按需计费 |
| 数据库 | 实时连接高资源占用 | 本地存储减少 90% 请求 |
| 流量 | 每个请求都经过后端 | 同步只在需要时发生 |

---

## 7. 项目结构

```
StillAlive/
├── apps/
│   ├── web/              # Next.js Web 应用
│   ├── mobile/           # React Native 移动端
│   ├── miniprogram/      # 微信小程序
│   ├── server/           # Fastify 后端服务
│   └── portal/           # 管理后台
│
├── packages/
│   ├── shared/           # 共享类型、工具函数
│   ├── ui/               # 共享 UI 组件
│   └── storage/          # 统一存储层
│
└── docs/                 # 项目文档
    ├── PRD.md            # 产品需求文档
    ├── DESIGN_SPEC.md    # 设计规范
    ├── ARCHITECTURE.md   # 技术架构 (本文档)
    ├── BACKEND.md        # 后端文档
    └── DEPLOYMENT.md     # 部署指南
```

---

## 附录

### 相关文档

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 产品需求文档（功能需求、业务规则） |
| [DESIGN_SPEC.md](./DESIGN_SPEC.md) | 设计规范（视觉、交互、组件） |
| [BACKEND.md](./BACKEND.md) | 后端文档（API设计、增值服务） |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 部署指南 |

---

*文档版本: v2.0*
*最后更新: 2026-01-16*
