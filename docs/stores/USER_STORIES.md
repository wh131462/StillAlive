# Stores 用户故事

> 本文档定义了各个 Store 模块需要支持的用户故事，用于指导状态管理的实现。

---

## 1. 认证模块 (authStore)

### US-AUTH-01: 用户注册
```
作为 新用户，
我想要 使用邮箱和密码注册账号，
以便 开始使用"今天又活了一天"记录我的生活。

验收标准：
- [ ] 用户可以输入邮箱、密码、昵称（可选）
- [ ] 邮箱格式校验，密码长度校验
- [ ] 注册成功后自动登录并跳转主页
- [ ] 注册失败显示错误提示

状态需求：
- isLoading: boolean
- error: string | null
- user: User | null
- token: string | null
```

### US-AUTH-02: 用户登录
```
作为 已注册用户，
我想要 使用邮箱和密码登录，
以便 访问我的打卡记录和人物档案。

验收标准：
- [ ] 用户可以输入邮箱和密码
- [ ] 登录成功后保存 token 到本地存储
- [ ] 登录失败显示错误提示
- [ ] 支持"记住登录状态"

状态需求：
- isAuthenticated: boolean
- isLoading: boolean
- error: string | null
```

### US-AUTH-03: 自动登录
```
作为 已登录用户，
我想要 下次打开应用时自动登录，
以便 无需重复输入账号密码。

验收标准：
- [ ] 应用启动时检查本地存储的 token
- [ ] token 有效则自动恢复登录状态
- [ ] token 过期则清除并跳转登录页

状态需求：
- isInitialized: boolean
```

### US-AUTH-04: 用户登出
```
作为 已登录用户，
我想要 退出登录，
以便 切换账号或保护隐私。

验收标准：
- [ ] 清除本地存储的 token 和用户信息
- [ ] 重置所有 store 状态
- [ ] 跳转到登录页

Actions:
- logout(): void
```

---

## 2. 打卡模块 (checkinStore)

### US-CHECKIN-01: 每日打卡
```
作为 用户，
我想要 一键确认今日存活，
以便 记录我又活过了一天。

验收标准：
- [ ] 点击打卡按钮完成今日打卡
- [ ] 显示打卡成功动画和文案"恭喜你又活过了一天！"
- [ ] 打卡后按钮变为已完成状态
- [ ] 支持早晚各打卡一次（可选）

状态需求：
- todayCheckedIn: boolean
- isCheckinLoading: boolean
- lastCheckinTime: Date | null
```

### US-CHECKIN-02: 记录有意义的事
```
作为 用户，
我想要 在打卡时记录今天有意义的事，
以便 沉淀生活中的美好记忆。

验收标准：
- [ ] 打卡时可输入文字记录（可选）
- [ ] 支持上传一张今日照片（可选）
- [ ] 记录内容与打卡关联保存
- [ ] 支持"什么都不记录"的纯粹打卡

状态需求：
- checkinContent: string
- checkinPhoto: string | null
```

### US-CHECKIN-03: 查看打卡统计
```
作为 用户，
我想要 查看我的打卡统计数据，
以便 了解自己的生存记录。

验收标准：
- [ ] 显示总打卡天数
- [ ] 显示当前连续打卡天数
- [ ] 显示有意义事件的记录总数

状态需求：
- stats: CheckinStats | null
- isStatsLoading: boolean
```

### US-CHECKIN-04: 查看打卡日历
```
作为 用户，
我想要 在日历视图中查看打卡记录，
以便 直观了解哪些天打卡了。

验收标准：
- [ ] 月度日历视图展示当月打卡情况
- [ ] 已打卡日期标记为绿色
- [ ] 今天日期显示特殊边框
- [ ] 支持切换月份查看历史

状态需求：
- currentMonth: Date
- monthlyCheckins: Map<string, Checkin>
- isCalendarLoading: boolean
```

### US-CHECKIN-05: 查看历史记录
```
作为 用户，
我想要 按时间线查看历史打卡记录，
以便 回顾过去的生活点滴。

验收标准：
- [ ] 按日期倒序展示记录列表
- [ ] 显示日期、打卡状态、记录文字
- [ ] 展示当日照片缩略图
- [ ] 未打卡日期以灰色半透明展示
- [ ] 支持下拉加载更多

状态需求：
- checkins: Checkin[]
- hasMore: boolean
- isListLoading: boolean
- page: number
```

---

## 3. 人物模块 (personStore)

### US-PERSON-01: 添加人物
```
作为 用户，
我想要 添加重要的人物档案，
以便 记录与他们的情感连接。

验收标准：
- [ ] 必填：姓名/称呼
- [ ] 选填：性别、生日、照片、MBTI
- [ ] 选填：个人印象、共同经历
- [ ] 添加成功后返回列表页

状态需求：
- isCreating: boolean
- createError: string | null
```

### US-PERSON-02: 查看人物列表
```
作为 用户，
我想要 查看所有已添加的人物，
以便 快速浏览我记录的重要人物。

验收标准：
- [ ] 卡片展示：头像、姓名、MBTI、生日
- [ ] 支持按添加时间/生日临近排序
- [ ] 点击进入人物详情页
- [ ] 显示人物总数

状态需求：
- persons: Person[]
- isLoading: boolean
- sortBy: 'createdAt' | 'birthday'
```

### US-PERSON-03: 搜索人物
```
作为 用户，
我想要 按姓名搜索人物，
以便 快速找到特定的人。

验收标准：
- [ ] 输入关键词实时筛选
- [ ] 搜索结果高亮匹配文字
- [ ] 无结果时显示提示

状态需求：
- searchKeyword: string
- filteredPersons: Person[]
```

### US-PERSON-04: 查看人物详情
```
作为 用户，
我想要 查看某个人物的完整档案，
以便 回顾我与这个人的情感记录。

验收标准：
- [ ] 显示所有人物信息字段
- [ ] 显示"共同经历"时间线
- [ ] 支持编辑和删除操作

状态需求：
- currentPerson: Person | null
- isDetailLoading: boolean
```

### US-PERSON-05: 编辑人物
```
作为 用户，
我想要 修改人物档案信息，
以便 更新或补充记录内容。

验收标准：
- [ ] 可修改所有字段
- [ ] 保存成功显示提示
- [ ] 支持删除人物（二次确认）

状态需求：
- isUpdating: boolean
- updateError: string | null
```

### US-PERSON-06: 今日生日提醒
```
作为 用户，
我想要 在打卡时看到今日过生日的人物，
以便 不忘记给重要的人送上祝福。

验收标准：
- [ ] 仅在有人物生日当天显示
- [ ] 显示生日人物头像和姓名
- [ ] 点击可跳转人物详情
- [ ] 显示年龄（如有出生年份）

状态需求：
- todayBirthdays: Person[]
```

---

## 4. 设置模块 (settingsStore)

### US-SETTINGS-01: 查看/编辑个人信息
```
作为 用户，
我想要 设置我的个人信息，
以便 个性化我的账号。

验收标准：
- [ ] 可修改头像
- [ ] 可修改昵称
- [ ] 显示累计生存天数

状态需求：
- profile: User | null
- isUpdating: boolean
```

### US-SETTINGS-02: 设置死亡确认
```
作为 用户，
我想要 设置死亡确认邮件，
以便 在我长期未打卡时通知紧急联系人。

验收标准：
- [ ] 可选触发天数：3/7/14/30天
- [ ] 设置紧急联系人邮箱
- [ ] 开关控制功能启用/禁用
- [ ] 显示当前设置状态

状态需求：
- emergencyConfig: EmergencyConfig | null
- isConfigLoading: boolean
- isConfigUpdating: boolean
```

### US-SETTINGS-03: 设置打卡提醒
```
作为 用户，
我想要 设置每日打卡提醒，
以便 不忘记确认今日存活。

验收标准：
- [ ] 开关控制提醒启用/禁用
- [ ] 自定义提醒时间（默认21:00）
- [ ] 支持本地通知/推送通知

状态需求：
- reminderEnabled: boolean
- reminderTime: string
- notificationType: 'local' | 'push'
```

### US-SETTINGS-04: 数据统计
```
作为 用户，
我想要 查看我的数据统计，
以便 了解使用情况。

验收标准：
- [ ] 显示总生存天数
- [ ] 显示记录人物数量
- [ ] 显示记录条数

状态需求：
- totalDays: number
- totalPersons: number
- totalRecords: number
```

---

## 5. UI 状态模块 (uiStore)

### US-UI-01: 导航状态
```
作为 用户，
我想要 在底部导航栏切换页面，
以便 访问不同功能模块。

验收标准：
- [ ] 4个Tab：主页、打卡、人物、我的
- [ ] 当前Tab高亮显示
- [ ] 切换时保持各页面状态

状态需求：
- activeTab: 'home' | 'checkin' | 'person' | 'profile'
```

### US-UI-02: 打卡弹窗
```
作为 用户，
我想要 在弹窗中完成打卡流程，
以便 不离开当前页面即可打卡。

验收标准：
- [ ] 点击打卡按钮弹出弹窗
- [ ] 弹窗内可输入记录和上传照片
- [ ] 完成后显示成功动画
- [ ] 点击外部或关闭按钮关闭弹窗

状态需求：
- isCheckinModalOpen: boolean
- checkinModalStep: 'input' | 'success'
```

### US-UI-03: 加载状态
```
作为 用户，
我想要 在数据加载时看到加载提示，
以便 知道应用正在处理。

验收标准：
- [ ] 全局loading遮罩
- [ ] 各区块loading骨架屏
- [ ] 按钮loading状态

状态需求：
- globalLoading: boolean
- loadingMessage: string | null
```

### US-UI-04: 消息提示
```
作为 用户，
我想要 看到操作结果的反馈，
以便 确认操作是否成功。

验收标准：
- [ ] 成功提示（绿色）
- [ ] 错误提示（红色）
- [ ] 警告提示（黄色）
- [ ] 自动消失或手动关闭

状态需求：
- toast: { type: 'success' | 'error' | 'warning', message: string } | null
```

---

## Store 实现清单

| Store | 文件名 | 优先级 | 依赖 |
|-------|--------|--------|------|
| authStore | auth.ts | P0 | - |
| checkinStore | checkin.ts | P0 | authStore |
| personStore | person.ts | P1 | authStore |
| settingsStore | settings.ts | P1 | authStore |
| uiStore | ui.ts | P0 | - |

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
