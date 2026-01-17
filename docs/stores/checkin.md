# 打卡模块 (checkinStore)

> 管理每日打卡、记录内容、统计数据和历史记录。

**依赖**: authStore

---

## US-CHECKIN-01: 每日打卡

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

---

## US-CHECKIN-02: 记录有意义的事

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

---

## US-CHECKIN-03: 查看打卡统计

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

---

## US-CHECKIN-04: 查看打卡日历

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

---

## US-CHECKIN-05: 查看历史记录

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

## 状态定义

```typescript
interface CheckinState {
  // 今日状态
  todayCheckedIn: boolean;
  isCheckinLoading: boolean;
  lastCheckinTime: Date | null;

  // 打卡输入
  checkinContent: string;
  checkinPhoto: string | null;

  // 统计数据
  stats: CheckinStats | null;
  isStatsLoading: boolean;

  // 日历视图
  currentMonth: Date;
  monthlyCheckins: Map<string, Checkin>;
  isCalendarLoading: boolean;

  // 历史列表
  checkins: Checkin[];
  hasMore: boolean;
  isListLoading: boolean;
  page: number;

  // Actions
  checkin: (content?: string, photo?: string) => Promise<void>;
  fetchTodayStatus: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchMonthlyCheckins: (month: Date) => Promise<void>;
  fetchCheckinList: (page?: number) => Promise<void>;
  setCheckinContent: (content: string) => void;
  setCheckinPhoto: (photo: string | null) => void;
  setCurrentMonth: (month: Date) => void;
  reset: () => void;
}
```

---

## API 依赖

| Action | API Endpoint | Method |
|--------|--------------|--------|
| checkin | `/api/checkins` | POST |
| fetchTodayStatus | `/api/checkins/today` | GET |
| fetchStats | `/api/checkins/stats` | GET |
| fetchMonthlyCheckins | `/api/checkins/monthly?month={month}` | GET |
| fetchCheckinList | `/api/checkins?page={page}&limit={limit}` | GET |
