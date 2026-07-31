# Android 生产签名说明

本目录用于存放 Android 生产签名相关文件，但目录本身不被 Git 整体忽略。根目录 `.gitignore` 通过 `*.jks` 规则忽略 JKS 原文件；提交前必须单独检查其他签名相关文件，避免将敏感材料上传到公开仓库、公开网盘或发送到不受信任的设备。

## 文件用途

- `still-alive-release.jks`：生产签名原文件。后续发布的 APK 必须继续使用同一签名，否则已安装应用无法直接升级。
- `still-alive-release.zip`：JKS 的加密压缩备份。该文件不匹配 `*.jks` 规则，提交前必须确认仓库可见性和备份策略。
- `export.sh`：读取本目录中唯一的 `.jks` 文件，并导出本地构建需要的签名环境变量。
- `README.md`：本说明文件，可以提交到 Git。

## 本地构建

在项目根目录执行：

```bash
pnpm build:apk
```

当签名环境变量不完整时，`build-apk.sh` 会自动加载 `jks/export.sh`。也可以手动加载：

```bash
source ./jks/export.sh
```

加载时会：

1. 检查本目录中是否只有一个 `.jks` 文件。
2. 默认使用别名 `still-alive-release`，已有环境变量可以覆盖该值。
3. 隐藏输入 keystore 密码。
4. 密钥密码留空时复用 keystore 密码。

相关环境变量：

```text
STILL_ALIVE_ANDROID_KEYSTORE_PATH
STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD
STILL_ALIVE_ANDROID_KEY_ALIAS
STILL_ALIVE_ANDROID_KEY_PASSWORD
```

## CI 签名配置

GitHub Actions 使用以下 Secrets：

```text
STILL_ALIVE_ANDROID_KEYSTORE_BASE64
STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD
STILL_ALIVE_ANDROID_KEY_ALIAS
STILL_ALIVE_ANDROID_KEY_PASSWORD
```

`STILL_ALIVE_ANDROID_KEYSTORE_BASE64` 是 JKS 文件的 Base64 内容。密码、JKS 内容和 Base64 内容都不能写入仓库或 CI 日志。

## 加密备份

当前备份为已加密的 ZIP 文件，压缩方式为 Deflate。具体加密实现取决于创建 ZIP 时使用的工具，不应仅凭扩展名判断安全强度。

```text
文件名：still-alive-release.zip
归档内容：still-alive-release.jks
加密状态：已加密
```

密码由负责人单独保管，本文件不记录密码。

解密到临时目录，避免覆盖当前 JKS：

```bash
mkdir -p /tmp/still-alive-jks-restore
unzip ./jks/still-alive-release.zip -d /tmp/still-alive-jks-restore
```

解密完成后应检查文件权限，并避免在临时目录长期保留明文 JKS。

## 安全要求

- 至少保留一份离线加密备份，并确认密码可恢复。
- 不要删除或重新生成生产 JKS，除非明确执行签名迁移。
- JKS 和加密备份建议设置为仅当前用户可读写：`chmod 600 <文件>`。
- 发布前确认签名别名和密码对应正确。
- 如果签名材料可能泄露，应立即停止发布并评估密钥轮换或应用迁移方案。
