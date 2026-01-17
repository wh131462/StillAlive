# UI 状态模块 (uiStore)

> 管理全局 UI 状态，包括导航、弹窗、加载状态和消息提示。

**依赖**: 无（独立模块）

---

## US-UI-01: 导航状态

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

---

## US-UI-02: 打卡弹窗

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

---

## US-UI-03: 加载状态

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

---

## US-UI-04: 消息提示

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

## 状态定义

```typescript
type TabType = 'home' | 'checkin' | 'person' | 'profile';
type ToastType = 'success' | 'error' | 'warning';
type CheckinModalStep = 'input' | 'success';

interface Toast {
  type: ToastType;
  message: string;
}

interface UIState {
  // 导航状态
  activeTab: TabType;

  // 打卡弹窗
  isCheckinModalOpen: boolean;
  checkinModalStep: CheckinModalStep;

  // 加载状态
  globalLoading: boolean;
  loadingMessage: string | null;

  // 消息提示
  toast: Toast | null;

  // Actions
  setActiveTab: (tab: TabType) => void;
  openCheckinModal: () => void;
  closeCheckinModal: () => void;
  setCheckinModalStep: (step: CheckinModalStep) => void;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  showToast: (type: ToastType, message: string) => void;
  hideToast: () => void;
  reset: () => void;
}
```

---

## 使用示例

### 显示 Toast 消息

```typescript
const { showToast } = useUIStore();

// 成功提示
showToast('success', '打卡成功！');

// 错误提示
showToast('error', '网络连接失败');

// 警告提示
showToast('warning', '请先登录');
```

### 全局加载状态

```typescript
const { setGlobalLoading } = useUIStore();

// 显示加载
setGlobalLoading(true, '正在保存...');

// 隐藏加载
setGlobalLoading(false);
```

### 打卡弹窗流程

```typescript
const { openCheckinModal, setCheckinModalStep, closeCheckinModal } = useUIStore();

// 打开弹窗
openCheckinModal();

// 打卡成功后切换到成功步骤
setCheckinModalStep('success');

// 关闭弹窗
closeCheckinModal();
```

---

## 注意事项

- uiStore 不需要持久化，所有状态在应用刷新后重置
- Toast 消息应设置自动消失时间（建议 3 秒）
- 全局 loading 应有最大显示时间，防止卡死
