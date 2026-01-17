# 认证模块 (authStore)

> 管理用户认证状态，包括注册、登录、登出和自动登录。

---

## US-AUTH-01: 用户注册

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

---

## US-AUTH-02: 用户登录

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

---

## US-AUTH-03: 自动登录

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

---

## US-AUTH-04: 用户登出

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

## 状态定义

```typescript
interface AuthState {
  // 状态
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  clearError: () => void;
}
```

---

## API 依赖

| Action | API Endpoint | Method |
|--------|--------------|--------|
| register | `/api/auth/register` | POST |
| login | `/api/auth/login` | POST |
| logout | `/api/auth/logout` | POST |
| initialize | `/api/auth/me` | GET |
