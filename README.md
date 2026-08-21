# 仍在 / Still Alive

本地优先的个人生命记录应用，仅支持 iOS 和 Android。

核心闭环：每日打卡、Markdown 日记、图片与人物关联、时间回看、完整导出。

## 工作区

```text
apps/
  mobile/       Expo React Native 主应用
  portal/       静态产品门户与下载页

packages/
  types/        共享数据类型
  tokens/       设计 Token

docs/           PRD 与 HTML 设计稿
openspec/       产品变更规格
```

移动端内部按业务功能组织在 `apps/mobile/src/features/`，共享 UI 与基础能力位于 `apps/mobile/src/shared/`，数据库、文件、通知和平台适配位于 `apps/mobile/src/infrastructure/`。`apps/mobile/app/` 仅保留 Expo Router 路由入口。

MVP 不包含服务端、Web 客户端、微信小程序和 Docker 部署。门户仅用于产品介绍与应用下载，产品功能与验收以 iOS/Android 为准。

## 开发

环境要求：

- Node.js 20+
- pnpm 9+

安装依赖并锁定版本后：

```bash
pnpm install
pnpm dev
```

当前依赖已按 Expo 57 的兼容结果锁定，并由 `pnpm-lock.yaml` 固化。

## 文档

- [V3 PRD](docs/PRD_V3.md)
- [V3 交互设计稿](docs/design/v3.html)
