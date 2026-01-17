# 设置模块 (settingsStore)

> 管理用户个人信息、死亡确认配置、打卡提醒和数据统计。

**依赖**: authStore

---

## US-SETTINGS-01: 查看/编辑个人信息

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

---

## US-SETTINGS-02: 设置死亡确认

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

---

## US-SETTINGS-03: 设置打卡提醒

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

---

## US-SETTINGS-04: 数据统计

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

## 状态定义

```typescript
interface SettingsState {
  // 个人信息
  profile: User | null;
  isUpdating: boolean;

  // 死亡确认配置
  emergencyConfig: EmergencyConfig | null;
  isConfigLoading: boolean;
  isConfigUpdating: boolean;

  // 打卡提醒
  reminderEnabled: boolean;
  reminderTime: string;
  notificationType: 'local' | 'push';

  // 数据统计
  totalDays: number;
  totalPersons: number;
  totalRecords: number;

  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileInput) => Promise<void>;
  fetchEmergencyConfig: () => Promise<void>;
  updateEmergencyConfig: (config: EmergencyConfig) => Promise<void>;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setNotificationType: (type: 'local' | 'push') => void;
  fetchStats: () => Promise<void>;
  reset: () => void;
}
```

---

## API 依赖

| Action | API Endpoint | Method |
|--------|--------------|--------|
| fetchProfile | `/api/users/profile` | GET |
| updateProfile | `/api/users/profile` | PUT |
| fetchEmergencyConfig | `/api/users/emergency-config` | GET |
| updateEmergencyConfig | `/api/users/emergency-config` | PUT |
| fetchStats | `/api/users/stats` | GET |

---

## 本地存储

打卡提醒配置存储在本地（不需要同步到服务端）：

```typescript
// localStorage key: 'settings-storage'
{
  reminderEnabled: boolean;
  reminderTime: string;
  notificationType: 'local' | 'push';
}
```
