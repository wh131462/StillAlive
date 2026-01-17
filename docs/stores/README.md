# Stores 状态管理

> 本目录定义了各个 Store 模块的用户故事，用于指导状态管理的实现。

---

## 模块概览

| Store | 文件 | 用户故事 | 优先级 | 依赖 |
|-------|------|----------|--------|------|
| authStore | [auth.md](./auth.md) | US-AUTH-01 ~ 04 | P0 | - |
| checkinStore | [checkin.md](./checkin.md) | US-CHECKIN-01 ~ 05 | P0 | authStore |
| personStore | [person.md](./person.md) | US-PERSON-01 ~ 06 | P1 | authStore |
| settingsStore | [settings.md](./settings.md) | US-SETTINGS-01 ~ 04 | P1 | authStore |
| uiStore | [ui.md](./ui.md) | US-UI-01 ~ 04 | P0 | - |

---

## 依赖关系图

```
┌─────────────┐
│  authStore  │ (P0)
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│checkinStore │ │ personStore │ │settingsStore│
│    (P0)     │ │    (P1)     │ │    (P1)     │
└─────────────┘ └─────────────┘ └─────────────┘

┌─────────────┐
│   uiStore   │ (P0, 独立)
└─────────────┘
```

---

## 技术规范

### Zustand Store 模板

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  // 状态
  data: DataType | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchData: () => Promise<void>;
  reset: () => void;
}

export const useExampleStore = create<ExampleState>()(
  persist(
    (set, get) => ({
      data: null,
      isLoading: false,
      error: null,

      fetchData: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.getData();
          set({ data, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },

      reset: () => set({ data: null, isLoading: false, error: null }),
    }),
    {
      name: 'example-storage',
    }
  )
);
```

### 类型引用

```typescript
import type {
  User,
  Checkin,
  CheckinStats,
  Person,
  EmergencyConfig
} from '@stillalive/types';
```

### 持久化策略

| Store | 持久化 | 存储 Key | 说明 |
|-------|--------|----------|------|
| authStore | 是 | `auth-storage` | token、用户信息 |
| checkinStore | 否 | - | 数据从服务端获取 |
| personStore | 否 | - | 数据从服务端获取 |
| settingsStore | 是 | `settings-storage` | 本地偏好设置 |
| uiStore | 否 | - | 临时 UI 状态 |

---

## 实现顺序

1. **Phase 1 (P0)**: authStore → uiStore → checkinStore
2. **Phase 2 (P1)**: personStore → settingsStore
