# 仍在 / Still Alive

本地优先的个人生命记录应用，仅支持 iOS 和 Android。

核心闭环：每日打卡、Markdown 日记、图片与人物关联、时间回看、完整导出。

## 工作区

```text
apps/
  mobile/       Expo React Native 主应用

packages/
  types/        共享数据类型
  core/         纯业务规则
  storage/      本地存储接口
  backup/       导出与恢复接口
  tokens/       设计 Token

docs/           PRD 与 HTML 设计稿
openspec/       产品变更规格
```

MVP 不包含服务端、Web 客户端、微信小程序和 Docker 部署。Web 不属于支持平台，构建与验收以 iOS/Android 为准。

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
