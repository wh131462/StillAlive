# 主题风格设计规范 - 今天又活了一天

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

```
主页模块     → 温暖、有生命力 → 绿色点缀，心跳动画
打卡模块     → 清晰、有成就感 → 日历绿色标记，数据可视化
人物模块     → 温情、有记忆感 → 暖色调，照片质感
我的模块     → 简洁、功能性   → 中性灰色调，清晰层级
```

---

## 2. 色彩系统

### 2.1 基础色板（Slate 灰度体系）

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
| primary-light | `#d1fae5` (emerald-100) | 浅色背景、标签底色 |
| primary | `#10b981` (emerald-500) | 主按钮、打卡成功、已确认状态 |
| primary-dark | `#059669` (emerald-600) | 按钮悬停、强调 |

#### 强调色（心跳红）
代表"心跳"、"生命体征"、"重要提醒"

| 名称 | 色值 | 用途 |
|------|------|------|
| accent-light | `#ffe4e6` (rose-100) | 浅色背景 |
| accent | `#f43f5e` (rose-500) | 心跳动画、生日提醒、重要标记 |
| accent-dark | `#e11d48` (rose-600) | 悬停状态 |

#### 功能色彩

| 类型 | 色值 | 用途 |
|------|------|------|
| success | `#22c55e` (green-500) | 成功状态 |
| warning | `#f59e0b` (amber-500) | 警告、未打卡提醒 |
| error | `#ef4444` (red-500) | 错误状态 |
| info | `#3b82f6` (blue-500) | 信息提示 |

### 2.3 深色模式配色

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

### 3.3 特殊文字样式

```css
/* 核心文案 - 如"还活着吗？" */
.text-headline {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--slate-800);
}

/* 数字统计 */
.text-statistic {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: 700;
  color: var(--primary);
}
```

---

## 4. 间距系统

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
| spacing-10 | 40px | 页面边距 |
| spacing-12 | 48px | 大留白 |

### 4.2 页面布局间距

```
页面水平边距: 16px (移动端) / 24px (平板)
卡片间距: 12px
区块间距: 24px
底部导航高度: 56px
安全区域底部: env(safe-area-inset-bottom)
```

---

## 5. 圆角系统

| 名称 | 值 | 用途 |
|------|-----|------|
| radius-sm | 6px | 小按钮、标签 |
| radius-md | 8px | 输入框、小卡片 |
| radius-lg | 12px | 标准卡片 |
| radius-xl | 16px | 大卡片、弹窗 |
| radius-2xl | 24px | 底部弹出面板 |
| radius-full | 9999px | 圆形头像、胶囊按钮 |

---

## 6. 阴影系统

### 6.1 阴影层级

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

### 6.2 深色模式阴影

深色模式下使用更深的阴影或边框代替：

```css
/* 深色模式卡片 */
.dark .card {
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.1);
}
```

---

## 7. 动效规范

### 7.1 缓动函数

```css
/* 标准缓动 */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);

/* 进入动画 */
--ease-in: cubic-bezier(0.4, 0, 1, 1);

/* 退出动画 */
--ease-out: cubic-bezier(0, 0, 0.2, 1);

/* 弹性效果 */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### 7.2 动画时长

| 类型 | 时长 | 用途 |
|------|------|------|
| instant | 100ms | 悬停反馈、颜色变化 |
| fast | 150ms | 按钮状态、小元素 |
| normal | 200ms | 标准过渡 |
| slow | 300ms | 页面切换、大元素 |
| slower | 500ms | 复杂动画 |

### 7.3 特色动画

#### 心跳动画（生存状态）
```css
@keyframes heartbeat {
  0%, 100% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.1);
  }
  28% {
    transform: scale(1);
  }
  42% {
    transform: scale(1.1);
  }
  70% {
    transform: scale(1);
  }
}

.heartbeat {
  animation: heartbeat 1.5s ease-in-out infinite;
}
```

#### 打卡成功动画
```css
@keyframes checkIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.check-in-success {
  animation: checkIn 0.4s var(--ease-bounce);
}
```

#### 呼吸效果（提醒状态）
```css
@keyframes breathe {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.breathe {
  animation: breathe 2s ease-in-out infinite;
}
```

---

## 8. 组件样式规范

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

---

*文档版本: v1.0*
*最后更新: 2026-01-12*
