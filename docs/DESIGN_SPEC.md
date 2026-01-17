# 设计规范 - 今天又活了一天

## 1. 设计理念

### 1.1 核心调性

基于产品「生存确认」与「记忆沉淀」的核心概念，视觉风格应体现：

| 关键词 | 说明 |
|--------|------|
| **温暖而不甜腻** | 避免过于明亮活泼，保持内敛的温度感 |
| **沉稳但有生命力** | 通过点缀色和动效体现"活着"的主题 |
| **轻量与呼吸感** | 大量留白，非压力式的视觉体验 |
| **黑色幽默感** | 配合文案调性，不过于严肃也不过于轻佻 |

### 1.2 情绪映射

| 模块 | 情绪 | 表达方式 |
|------|------|----------|
| 主页 | 温暖、有生命力 | 绿色点缀，心跳动画 |
| 打卡 | 清晰、有成就感 | 日历绿色标记，数据可视化 |
| 人物 | 温情、有记忆感 | 暖色调，照片质感 |
| 我的 | 简洁、功能性 | 中性灰色调，清晰层级 |

---

## 2. 色彩系统

### 2.1 基础灰度（Slate 色系）

采用 Tailwind CSS 的 Slate 色系作为基础灰度：

| 色阶 | 色值 | 用途 |
|------|------|------|
| slate-50 | `#f8fafc` | 页面主背景 |
| slate-100 | `#f1f5f9` | 次级背景、分割区域 |
| slate-200 | `#e2e8f0` | 边框、分割线 |
| slate-300 | `#cbd5e1` | 禁用状态、占位符 |
| slate-400 | `#94a3b8` | 次要图标 |
| slate-500 | `#64748b` | 次要文字、描述文字 |
| slate-600 | `#475569` | 正文文字 |
| slate-700 | `#334155` | 标题文字 |
| slate-800 | `#1e293b` | 强调标题 |
| slate-900 | `#0f172a` | 深色模式背景 |

### 2.2 语义色彩

#### 主色（生命绿）
代表"存活"、"生命力"、"确认"

| 名称 | 色值 | 用途 |
|------|------|------|
| primary-light | `#d1fae5` | 浅色背景、标签底色 |
| primary | `#10b981` | 主按钮、打卡成功、已确认状态 |
| primary-dark | `#059669` | 按钮悬停、强调 |

#### 强调色（心跳红）
代表"心跳"、"生命体征"、"重要提醒"

| 名称 | 色值 | 用途 |
|------|------|------|
| accent-light | `#ffe4e6` | 浅色背景 |
| accent | `#f43f5e` | 心跳动画、生日提醒、重要标记 |
| accent-dark | `#e11d48` | 悬停状态 |

#### 功能色彩

| 类型 | 色值 | 用途 |
|------|------|------|
| success | `#22c55e` | 成功状态 |
| warning | `#f59e0b` | 警告、未打卡提醒 |
| error | `#ef4444` | 错误状态 |
| info | `#3b82f6` | 信息提示 |

### 2.3 深色模式

| 元素 | 浅色模式 | 深色模式 |
|------|----------|----------|
| 页面背景 | `#f8fafc` | `#0f172a` |
| 卡片背景 | `#ffffff` | `#1e293b` |
| 主文字 | `#1e293b` | `#f1f5f9` |
| 次要文字 | `#64748b` | `#94a3b8` |
| 边框 | `#e2e8f0` | `#334155` |
| 主色 | `#10b981` | `#34d399` |
| 强调色 | `#f43f5e` | `#fb7185` |

---

## 3. 字体系统

### 3.1 字体家族

```css
/* 主字体 - 系统默认 */
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, "Noto Sans SC", sans-serif;

/* 等宽字体 - 用于数字展示 */
--font-mono: "SF Mono", Monaco, "Cascadia Code", monospace;
```

### 3.2 字号规范

| 级别 | 字号 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| display | 32px | 1.2 | 700 | 大标题、数据展示 |
| h1 | 24px | 1.3 | 600 | 页面标题 |
| h2 | 20px | 1.4 | 600 | 区块标题 |
| h3 | 18px | 1.4 | 500 | 卡片标题 |
| body | 16px | 1.5 | 400 | 正文内容 |
| body-sm | 14px | 1.5 | 400 | 次要正文、描述 |
| caption | 12px | 1.4 | 400 | 辅助说明、时间戳 |

---

## 4. 间距与布局

### 4.1 基础间距（Base: 4px）

| 名称 | 值 | 用途 |
|------|-----|------|
| spacing-1 | 4px | 极小间距、图标与文字 |
| spacing-2 | 8px | 紧凑元素间距 |
| spacing-3 | 12px | 卡片内小间距 |
| spacing-4 | 16px | 标准内间距 |
| spacing-5 | 20px | 区块间距 |
| spacing-6 | 24px | 卡片内间距 |
| spacing-8 | 32px | 大区块间距 |

### 4.2 页面布局

| 属性 | 值 |
|------|-----|
| 页面水平边距 | 16px (移动端) / 24px (平板) |
| 卡片间距 | 12px |
| 区块间距 | 24px |
| 底部导航高度 | 56px |
| 安全区域底部 | `env(safe-area-inset-bottom)` |

### 4.3 圆角系统

| 名称 | 值 | 用途 |
|------|-----|------|
| radius-sm | 6px | 小按钮、标签 |
| radius-md | 8px | 输入框、小卡片 |
| radius-lg | 12px | 标准卡片 |
| radius-xl | 16px | 大卡片、弹窗 |
| radius-2xl | 24px | 底部弹出面板 |
| radius-full | 9999px | 圆形头像、胶囊按钮 |

---

## 5. 阴影系统

### 5.1 阴影层级

```css
/* 轻微浮起 - 卡片默认状态 */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* 标准卡片 */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
             0 2px 4px -2px rgb(0 0 0 / 0.1);

/* 悬浮状态、弹窗 */
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
             0 4px 6px -4px rgb(0 0 0 / 0.1);

/* 模态框、重要弹窗 */
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1),
             0 8px 10px -6px rgb(0 0 0 / 0.1);
```

### 5.2 深色模式阴影

深色模式下使用边框代替阴影：

```css
.dark .card {
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.1);
}
```

---

## 6. 动效规范

### 6.1 缓动函数

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);  /* 标准缓动 */
--ease-in: cubic-bezier(0.4, 0, 1, 1);          /* 进入动画 */
--ease-out: cubic-bezier(0, 0, 0.2, 1);         /* 退出动画 */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* 弹性效果 */
```

### 6.2 动画时长

| 类型 | 时长 | 用途 |
|------|------|------|
| instant | 100ms | 悬停反馈、颜色变化 |
| fast | 150ms | 按钮状态、小元素 |
| normal | 200ms | 标准过渡 |
| slow | 300ms | 页面切换、大元素 |
| slower | 500ms | 复杂动画 |

### 6.3 特色动画

#### 心跳动画（生存状态）
```css
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.1); }
  28% { transform: scale(1); }
  42% { transform: scale(1.1); }
  70% { transform: scale(1); }
}

.heartbeat {
  animation: heartbeat 1.5s ease-in-out infinite;
}
```

#### 打卡成功动画
```css
@keyframes checkIn {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.check-in-success {
  animation: checkIn 0.4s var(--ease-bounce);
}
```

#### 里程碑庆祝动画
```css
@keyframes milestone {
  0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.milestone-celebrate {
  animation: milestone 1.5s ease-in-out;
}
```

#### 呼吸效果（提醒状态）
```css
@keyframes breathe {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.breathe {
  animation: breathe 2s ease-in-out infinite;
}
```

#### 骨架屏闪烁
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## 7. 交互规范

### 7.1 交互反馈

| 交互类型 | 反馈方式 |
|----------|----------|
| 按钮点击 | 轻微缩放 (scale: 0.98) + 触感反馈 |
| 卡片点击 | 阴影加深 + 轻微缩放 |
| 下拉刷新 | 顶部加载指示器 |
| 操作成功 | Toast提示 + 轻微震动 |
| 操作失败 | 错误Toast + 中等震动 |

### 7.2 加载状态

#### 骨架屏
| 应用场景 | 说明 |
|----------|------|
| 列表加载 | 打卡记录、人物列表首次加载时展示 |
| 卡片加载 | 数据统计卡片、热力图加载时展示 |
| 详情页 | 人物详情页首次加载时展示 |

#### 下拉刷新
| 应用场景 | 说明 |
|----------|------|
| 主页 | 下拉刷新今日状态和提醒 |
| 记录列表 | 下拉刷新最新记录 |
| 人物列表 | 下拉刷新人物数据 |

### 7.3 空状态设计

| 场景 | 文案 | 引导操作 |
|------|------|----------|
| 无打卡记录 | "开始你的第一次打卡吧" | 显示打卡按钮 |
| 无人物记录 | "添加一个重要的人" | 显示添加按钮 |
| 搜索无结果 | "没有找到相关内容" | 建议调整搜索词 |
| 无意义记录 | "今天有什么有意义的事吗？" | 显示快速记录入口 |

### 7.4 安全区域适配

| 区域 | 说明 |
|------|------|
| 顶部安全区 | 适配刘海屏/挖孔屏 |
| 底部安全区 | 适配全面屏手势区域 |
| 底部导航 | 使用 `env(safe-area-inset-bottom)` 适配 |

---

## 8. 组件规范

### 8.1 卡片组件

```css
.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s var(--ease-default);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

/* 深色模式 */
.dark .card {
  background: #1e293b;
}
```

### 8.2 按钮组件

#### 主按钮
```css
.btn-primary {
  background: #10b981;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.15s var(--ease-default);
}

.btn-primary:hover {
  background: #059669;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}
```

#### 打卡按钮（特殊）
```css
.btn-checkin {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  box-shadow: 0 4px 14px 0 rgb(16 185 129 / 0.4);
  transition: all 0.2s var(--ease-default);
}

.btn-checkin:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px 0 rgb(16 185 129 / 0.5);
}

.btn-checkin:active {
  transform: scale(0.98);
}

.btn-checkin.completed {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #059669;
}
```

### 8.3 输入框组件

```css
.input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  color: #1e293b;
  background: #ffffff;
  transition: all 0.15s var(--ease-default);
}

.input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgb(16 185 129 / 0.1);
}

.input::placeholder {
  color: #94a3b8;
}
```

### 8.4 标签组件

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.tag-primary {
  background: #d1fae5;
  color: #059669;
}

.tag-accent {
  background: #ffe4e6;
  color: #e11d48;
}
```

### 8.5 Toast 消息

```css
.toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 100;
  animation: scaleIn 0.2s ease-out;
}

.toast-success {
  background: #d1fae5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.toast-error {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
```

---

## 9. 图标规范

### 9.1 图标库

推荐使用 **Font Awesome 6** 或 **Heroicons**

### 9.2 底部导航图标

| Tab | 图标名称 | 说明 |
|-----|----------|------|
| 主页 | `house-chimney` | 家的感觉 |
| 打卡 | `calendar-check` | 日历打卡 |
| 人物 | `address-book` | 通讯录/档案 |
| 我的 | `user` | 个人中心 |

### 9.3 图标尺寸

| 场景 | 尺寸 |
|------|------|
| 底部导航 | 24px |
| 列表项图标 | 20px |
| 按钮内图标 | 16px |
| 行内图标 | 14px |

---

## 10. CSS 变量汇总

```css
:root {
  /* 色彩 */
  --color-bg: #f8fafc;
  --color-card: #ffffff;
  --color-text-primary: #1e293b;
  --color-text-secondary: #64748b;
  --color-border: #e2e8f0;
  --color-primary: #10b981;
  --color-primary-light: #d1fae5;
  --color-primary-dark: #059669;
  --color-accent: #f43f5e;
  --color-accent-light: #ffe4e6;
  --color-accent-dark: #e11d48;

  /* 字体 */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, "Noto Sans SC", sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", monospace;

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* 阴影 */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* 动效 */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-card: #1e293b;
    --color-text-primary: #f1f5f9;
    --color-text-secondary: #94a3b8;
    --color-border: #334155;
    --color-primary: #34d399;
    --color-accent: #fb7185;
  }
}
```

---

## 11. 设计检查清单

- [ ] 所有可点击元素有明确的悬停/按下反馈
- [ ] 文字对比度符合 WCAG AA 标准（≥4.5:1）
- [ ] 按钮点击区域不小于 44×44px
- [ ] 卡片间距均匀一致
- [ ] 动画时长适中，不影响操作效率
- [ ] 深色模式下所有元素可读性良好
- [ ] 心跳动画自然，不引起视觉疲劳
- [ ] 空状态有明确的引导操作
- [ ] 加载状态有骨架屏或指示器

---

*文档版本: v2.0*
*最后更新: 2026-01-16*
