#!/usr/bin/env bash

set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export NODE_ENV=development
export STILL_ALIVE_APP_VARIANT=development

cd "$MOBILE_DIR"
# 每次启动前同步 iOS 原生工程，并清理本项目的 Xcode 构建结果，避免复用旧原生资源。
pnpm exec expo prebuild --platform ios --no-install --no-clean
exec pnpm exec expo run:ios --no-build-cache "$@"
