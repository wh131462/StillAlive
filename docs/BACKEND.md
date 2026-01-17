# 后端文档 - 今天又活了一天

> 后端采用轻量化设计，专注于认证、同步与增值服务

---

## 1. 服务职责划分

```
┌─────────────────────────────────────────────────────────────────┐
│                         后端服务                                 │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   基础服务       │   同步服务       │   增值服务 (核心价值)        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • 用户注册/登录  │ • 数据上传       │ • 🌟 年度总结生成            │
│ • Token 管理    │ • 数据下载       │ • 📰 每日信息差              │
│ • 账号关联      │ • 冲突检测       │ • 📧 死亡确认邮件            │
│                │ • 增量同步       │ • 📊 高级数据分析            │
└─────────────────┴─────────────────┴─────────────────────────────┘
       必需               可选                付费/核心
```

---

## 2. API 设计

### 2.1 认证接口 (必需)

```
POST /api/auth/register     # 注册
POST /api/auth/login        # 登录
POST /api/auth/refresh      # 刷新 Token
DELETE /api/auth/logout     # 登出
```

### 2.2 同步接口

```
# 通用同步接口 - 简化设计
POST /api/sync/push         # 上传本地变更
POST /api/sync/pull         # 拉取远程变更
GET  /api/sync/status       # 获取同步状态

# 请求体示例
POST /api/sync/push
{
  "lastSyncAt": 1705123456000,
  "changes": [
    {
      "collection": "checkins",
      "operation": "upsert",  // upsert | delete
      "data": { ... },
      "localUpdatedAt": 1705123456000
    }
  ]
}

# 响应体
{
  "syncedAt": 1705123460000,
  "conflicts": [],  // 冲突记录，由客户端决定如何处理
  "accepted": ["id1", "id2"]
}
```

### 2.3 增值服务接口

```
# 年度总结
GET  /api/premium/yearly-summary/:year
POST /api/premium/yearly-summary/generate

# 每日信息差
GET  /api/daily-info                    # 获取今日信息差
GET  /api/daily-info/history            # 历史信息差

# 死亡确认
PUT  /api/emergency/config              # 更新配置
POST /api/emergency/test                # 测试发送邮件
```

---

## 3. 增值服务详细设计

### 3.1 年度总结生成

#### 功能描述
基于用户一整年的打卡数据和人物记录，使用 AI 生成个性化的年度总结报告。

#### 数据输入
```typescript
interface YearlySummaryInput {
  year: number;
  checkins: {
    totalDays: number;
    maxStreak: number;
    monthlyDistribution: number[];  // 12个月的打卡天数
    meaningfulEvents: string[];     // 有意义的事记录
    photos: string[];               // 照片 URL
  };
  people: {
    newAdded: number;               // 新增人物数
    birthdays: string[];            // 记录的生日
    topImpressions: string[];       // 高频印象词
  };
}
```

#### 输出格式
```typescript
interface YearlySummary {
  year: number;
  title: string;                    // AI 生成的标题
  highlights: string[];             // 年度亮点 (3-5条)
  statistics: {
    totalDays: number;
    longestStreak: number;
    meaningfulMoments: number;
    peopleCherished: number;
  };
  monthlyReview: {
    month: number;
    summary: string;                // AI 生成的月度小结
    keyMoment?: string;
  }[];
  aiInsights: string;               // AI 洞察与祝福
  shareImage?: string;              // 可分享的图片 URL
}
```

#### 技术实现
```
1. 客户端请求生成 →
2. 后端收集该用户年度数据 →
3. 调用 AI API (Claude/GPT) 生成文案 →
4. 缓存结果 →
5. 返回给客户端
```

---

### 3.2 每日信息差

#### 功能描述
每天汇总当天世界各地发生的重要新闻事件，帮助用户快速了解"信息差"，同时推送历史上的今天。

**核心价值**: 让用户在打卡的同时，用 2 分钟了解今天发生了什么，避免信息茧房。

#### 数据结构
```typescript
// 每日信息差
interface DailyInfo {
  id: string;
  date: string;                     // YYYY-MM-DD

  // 今日新闻 (10条左右)
  news: DailyNewsItem[];

  // 历史上的今天 (3-5条)
  historyToday: HistoryItem[];

  generatedAt: string;              // 生成时间
}

// 新闻条目
interface DailyNewsItem {
  id: string;
  title: string;                    // 新闻标题
  summary: string;                  // 一句话摘要 (50字以内)
  category: 'tech' | 'world' | 'finance' | 'science' | 'culture' | 'sports' | 'other';
  source?: string;                  // 来源
  url?: string;                     // 原文链接 (可选)
  importance: 1 | 2 | 3;            // 重要程度 1-3
}

// 历史上的今天
interface HistoryItem {
  year: number;                     // 年份
  event: string;                    // 事件描述
  category: 'history' | 'birth' | 'death' | 'invention' | 'culture';
}
```

#### 内容来源与生成流程
```
┌─────────────────────────────────────────────────────────────────┐
│                    每日信息差生成流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 定时任务 (每天 6:00 + 12:00 + 18:00)                         │
│     │                                                           │
│     ▼                                                           │
│  2. 数据采集                                                     │
│     ├── 新闻 API (NewsAPI / 聚合数据 / RSSHub)                   │
│     ├── 历史上的今天 API                                         │
│     └── 自定义数据源                                             │
│     │                                                           │
│     ▼                                                           │
│  3. AI 处理 (Claude/GPT)                                        │
│     ├── 筛选重要新闻 (去重、过滤低质量)                           │
│     ├── 生成中文摘要                                             │
│     ├── 分类标签                                                │
│     └── 重要性评分                                               │
│     │                                                           │
│     ▼                                                           │
│  4. 存储 & 缓存                                                  │
│     └── 按日期存储，客户端直接拉取                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 新闻分类说明
| 分类 | 说明 | 示例 |
|------|------|------|
| `tech` | 科技互联网 | AI 突破、产品发布、公司动态 |
| `world` | 国际时事 | 政治、外交、社会事件 |
| `finance` | 财经金融 | 股市、加密货币、经济政策 |
| `science` | 科学发现 | 学术突破、太空探索 |
| `culture` | 文化娱乐 | 电影、音乐、艺术 |
| `sports` | 体育赛事 | 重大比赛、运动员新闻 |

#### API 响应示例
```json
GET /api/daily-info
{
  "date": "2025-01-15",
  "news": [
    {
      "id": "n1",
      "title": "OpenAI 发布 GPT-5",
      "summary": "新模型在推理能力上有重大突破，可处理更复杂的多步骤任务",
      "category": "tech",
      "source": "TechCrunch",
      "importance": 3
    },
    {
      "id": "n2",
      "title": "欧盟通过新 AI 监管法案",
      "summary": "全球首个全面的 AI 监管框架，将于 2025 年底生效",
      "category": "world",
      "importance": 2
    }
  ],
  "historyToday": [
    {
      "year": 2001,
      "event": "维基百科正式上线",
      "category": "invention"
    },
    {
      "year": 1929,
      "event": "马丁·路德·金出生",
      "category": "birth"
    }
  ],
  "generatedAt": "2025-01-15T06:00:00Z"
}
```

---

### 3.3 死亡确认邮件

#### 触发逻辑
```typescript
// 定时任务 (每天运行一次)
async function checkDeathConfirmation() {
  const configs = await db.emergencyConfig.findMany({
    where: { isEnabled: true }
  });

  for (const config of configs) {
    const lastCheckin = await getLastCheckin(config.userId);
    const daysSinceLastCheckin = diffDays(new Date(), lastCheckin.date);

    if (daysSinceLastCheckin >= config.triggerDays) {
      // 检查是否已发送过
      if (!hasNotifiedRecently(config)) {
        await sendDeathConfirmationEmail(config);
        await updateLastNotifiedAt(config);
      }
    }
  }
}
```

#### 邮件模板
```html
主题: 【今天又活了一天】关于 {{nickname}} 的生存确认

亲爱的朋友：

这封邮件来自"今天又活了一天"应用。

{{nickname}} 已经 {{days}} 天没有确认存活状态了。

这可能意味着：
- Ta 只是忘记了打卡
- Ta 最近很忙
- 或者...需要您确认一下 Ta 的状况

如果您收到这封邮件，建议联系 {{nickname}} 确认一下情况。

---
这是一封自动发送的邮件，由 {{nickname}} 预先设置。
```

---

## 4. 数据库设计

### 4.1 表结构

```prisma
// 每日信息差 (后台管理)
model DailyInfo {
  id            String   @id @default(uuid())
  date          String   @unique  // YYYY-MM-DD
  type          String
  content       Json
  tags          String[]
  createdAt     DateTime @default(now())
}

// 年度总结缓存
model YearlySummary {
  id            String   @id @default(uuid())
  userId        String
  year          Int
  content       Json
  generatedAt   DateTime @default(now())

  @@unique([userId, year])
}
```

> 完整数据库模型请参阅 [ARCHITECTURE.md](./ARCHITECTURE.md#32-服务端数据结构)

---

## 5. 实现路线图

### Phase 1: 本地优先基础 (1周)

- [ ] 实现本地存储层
  - [ ] Web: IndexedDB 封装
  - [ ] Mobile: SQLite/MMKV 封装
  - [ ] 统一存储接口
- [ ] 前端所有功能本地化
  - [ ] 打卡功能完全本地
  - [ ] 人物管理完全本地
  - [ ] 统计计算本地完成
- [ ] 离线状态处理

### Phase 2: 轻后端服务 (1周)

- [ ] 精简后端 API
  - [ ] 认证接口
  - [ ] 同步接口 (push/pull)
- [ ] 数据库迁移
  - [ ] 简化表结构
  - [ ] SyncData JSON 存储
- [ ] 同步引擎
  - [ ] 增量同步
  - [ ] 冲突检测

### Phase 3: 增值服务 (2周)

- [ ] 每日信息差
  - [ ] 内容库建设
  - [ ] API 实现
  - [ ] 前端展示
- [ ] 年度总结
  - [ ] AI 生成逻辑
  - [ ] 模板设计
  - [ ] 分享图片生成
- [ ] 死亡确认邮件
  - [ ] 定时任务
  - [ ] 邮件模板
  - [ ] 测试发送

---

## 附录

### 相关文档

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 产品需求文档 |
| [DESIGN_SPEC.md](./DESIGN_SPEC.md) | 设计规范 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 技术架构（数据模型、同步策略） |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 部署指南 |

---

*文档版本: v2.0*
*最后更新: 2026-01-16*
