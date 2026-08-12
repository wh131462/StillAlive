## ADDED Requirements

### Requirement: 本地主存优先

系统 SHALL 把用户所有数据（Post / Reminder / Person / Mention / 附件）存储在用户设备本地，服务器仅作为用户自选的二级备份。

- Web 主存：IndexedDB（schema v1 定义实体对象库 + 必要索引）；附件 blob 存于 IndexedDB 的 object store。
- App 主存：SQLite（schema v1 定义表结构）用于结构化数据；附件（图片）存入应用沙盒文件系统，数据库仅存相对路径。

#### Scenario: 离线可用

- **WHEN** 用户处于无网络环境
- **THEN** 读写 Post / Reminder / Person / 编辑 biography 等所有核心操作正常完成
- **AND** 不出现任何网络错误或功能降级提示

#### Scenario: 无服务器也可用

- **WHEN** 用户从未配置任何二级备份目标
- **THEN** 产品全部功能可用，仅设置页提示「未开启备份」

### Requirement: 备份协议为标准协议

系统 SHALL 支持将本地数据导出至用户自建服务器，协议限定为 WebDAV 或 S3 兼容（含 MinIO / R2 / B2）。

#### Scenario: WebDAV 配置

- **WHEN** 用户在「备份」设置中选择 WebDAV
- **THEN** 需填写 `serverUrl` + `username` + `password`（或 app-password）+ `rootPath`
- **AND** 「测试连接」按钮发起一次 `PROPFIND` 到 rootPath 验证可达与可写

#### Scenario: S3 兼容配置

- **WHEN** 用户选择 S3 兼容
- **THEN** 需填写 `endpoint` + `region` + `accessKeyId` + `secretAccessKey` + `bucket` + `keyPrefix`
- **AND** 「测试连接」发起一次 `HeadBucket` 验证

#### Scenario: 不支持私有专有协议

- **WHEN** 用户尝试使用任何专有云 SDK（Dropbox / iCloud Drive / OneDrive SDK）
- **THEN** 设计稿不提供该选项；仅 WebDAV 和 S3 兼容入口

### Requirement: 备份打包与命名

系统 SHALL 将一次备份打包为单一 `.tar.gz` 或 `.zip`（App 端偏 tar.gz、Web 端偏 zip，均可解压），内部结构固定：

```
/manifest.json          # 元数据：appVersion / schemaVersion / deviceId / exportedAt
/db.sqlite  或  /db.json # 结构化数据（App 为 SQLite 文件；Web 为 IndexedDB dump 的 JSON）
/media/<hash>.<ext>      # 图片按 SHA-256 内容哈希命名，去重
```

备份对象键为 `<rootPath>/<deviceId>/<YYYY-MM-DDTHH-MM-SS>.tar.gz`。

#### Scenario: 备份包自解释

- **WHEN** 用户下载任一备份包并手动解压
- **THEN** 可凭 `manifest.json` 理解版本 + 时间
- **AND** `/media/` 下的图片可直接被图片查看器打开

### Requirement: 同步语义单向与手动

系统 SHALL 在本次 MVP 中仅支持「单向上传备份」，不做增量双向同步。

#### Scenario: 手动备份

- **WHEN** 用户在设置页点击「立即备份」
- **THEN** 打包当前本地数据 + 未上传过的新媒体文件，推送到目标
- **AND** 记录最近备份时间戳到本地 `backupMeta.lastSyncedAt`

#### Scenario: 周期备份

- **WHEN** 用户配置「每周自动备份」
- **THEN** 应用空闲期尝试一次自动备份，失败则静默重试最多 3 次
- **AND** 失败原因（认证 / 磁盘满 / 网络）记入本地日志，不弹窗

#### Scenario: 不做跨设备合并

- **WHEN** 用户在两个设备上各自写入
- **THEN** 设计稿明确告知「备份是单向快照，不会自动合并跨设备数据」
- **AND** 高级选项中提供「从备份覆盖本地」手动恢复入口（带红色二次确认）

### Requirement: 隐私与加密

系统 SHALL 在备份上传前对敏感内容提供可选的客户端加密。

#### Scenario: 可选加密

- **WHEN** 用户在备份设置中启用「端到端加密」并设置一个口令
- **THEN** 备份包上传前用 AES-256-GCM 加密，口令以 PBKDF2-SHA256（iter ≥ 200000）派生
- **AND** 服务器仅存到密文 + salt + iv；口令只存于用户记忆 + 本地 keychain（如可用）

#### Scenario: 未加密明示

- **WHEN** 用户未启用加密
- **THEN** 设置页显示黄色提示「备份未加密，若服务器被他人访问则内容可读」
