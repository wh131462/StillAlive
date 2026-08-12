# home-flow Specification

## Purpose
TBD - created by archiving change humane-redesign. Update Purpose after archive.
## Requirements
### Requirement: 主页分阶段状态机

主页 SHALL 按用户当日活动状态呈现三种互斥形态。状态依据：本地 `dayKey` 是否存在「打卡记录」+ 当日是否存在 Post。

#### Scenario: 状态 A 未打卡

- **WHEN** 用户进入主页且当日没有任何打卡也没有任何 Post
- **THEN** 主页突出显示一张「今日打卡」卡片
- **AND** 卡片含一个主 CTA「✓ 打卡」按钮，无其它操作
- **AND** **Post Composer 入口不可见**——不展示「写一条」「想写点什么」等任何写入引导

#### Scenario: 状态 B 已打卡未写

- **WHEN** 用户在当日点击「✓ 打卡」按钮，或当日存在打卡记录而无 Post
- **THEN** 卡片以弹簧曲线（cubic-bezier 0.34 1.56 0.64 1）变形为「打卡完成」态
- **AND** 卡片标题变为「今天的存在已记下」+ 一行温柔文案
- **AND** 出现次级 CTA「想写点什么吗？」（按钮风格更轻，非主色填充）
- **AND** 点击该 CTA 唤起底部上拉的 Post Composer sheet（不跳页）

#### Scenario: 状态 C 已打卡已写

- **WHEN** 用户在当日已打卡且至少存在一条 Post
- **THEN** 卡片折叠为更紧凑的"小条"样式
- **AND** 文案为「今天已记下 N 条」（N = 当日 Post 数量）
- **AND** 末尾保留一个不显眼的「再写一条」次级入口

#### Scenario: 状态切换可立即重渲

- **WHEN** 状态发生变化（如刚点完打卡 / 刚保存完一条 Post）
- **THEN** 卡片立即以弹簧动效切换到下一状态
- **AND** 不需要刷新页面或重新进入

### Requirement: 历史合流

主页打卡卡片下方 SHALL 呈现一条反向时序的「历史合流」滚动区。

#### Scenario: 数据来源

- **WHEN** 渲染历史合流
- **THEN** 流中包含三类条目：
  1. 用户写过的 Post（卡片样式）
  2. 当日有打卡但无 Post 的「我还在」徽章
  3. 「那天是 X 日子」过期提醒卡（来自 Reminder）
- **AND** 这些条目共享同一份倒序时间线，不分开标签页

#### Scenario: 日期分隔

- **WHEN** 滚动到不同日期之间
- **THEN** 显示日期分隔条（"昨天" / "前天" / "X 月 Y 日"）
- **AND** 距今 7 天内用相对时间表述，更远则用绝对日期

#### Scenario: 历史区不含写入按钮

- **WHEN** 浏览历史合流
- **THEN** 历史区任何条目都不附带「在此处写一条」按钮
- **AND** 唯一的写入入口是主页顶部的打卡卡片（已打卡状态下浮出 sheet）

### Requirement: 写入仅通过底部 sheet

Post Composer SHALL 仅以底部上拉 sheet 形式出现，不再作为独立屏。

#### Scenario: sheet 上拉动画

- **WHEN** 用户在打卡完成的卡片上点击「想写点什么吗？」
- **THEN** Composer sheet 从屏幕底部上拉至 75% 高度（移动端）或屏幕居中（桌面端）
- **AND** 背景轻微变暗（30% 不透明度），点击暗区可关闭 sheet
- **AND** sheet 顶部有一条小横条（drag indicator），下拉可关闭

#### Scenario: sheet 内容简洁

- **WHEN** sheet 展开
- **THEN** 顶部仅显示「记一条」+ 关闭按钮，无大标题、无日期 mono 字
- **AND** 中部是一个无边框 textarea，placeholder 文案温和（"今天发生了什么？也可以什么都不写"）
- **AND** 底部仅 4 个圆形小图标：@ / 📷 / ⏰ / 完成
- **AND** **不显示**「Markdown」「保存草稿」「自动保存于」等技术化字眼

