#!/usr/bin/env bash

set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_JAVA_HOME_17="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
JDK_CANDIDATES=(
  "${JAVA_HOME:-}"
  "$MACOS_JAVA_HOME_17"
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  "/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
)

for JDK_CANDIDATE in "${JDK_CANDIDATES[@]}"; do
  if [[ ! -x "$JDK_CANDIDATE/bin/java" || ! -x "$JDK_CANDIDATE/bin/javac" || ! -x "$JDK_CANDIDATE/bin/jlink" ]]; then
    continue
  fi

  JAVA_MAJOR_VERSION="$("$JDK_CANDIDATE/bin/java" -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n 1)"
  if [[ "$JAVA_MAJOR_VERSION" == "17" ]]; then
    export JAVA_HOME="$JDK_CANDIDATE"
    break
  fi
done

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" || ! -x "$JAVA_HOME/bin/javac" || ! -x "$JAVA_HOME/bin/jlink" || "$("$JAVA_HOME/bin/java" -version 2>&1)" != *'version "17.'* ]]; then
  printf 'Error: Android dev 构建需要完整的 JDK 17。\n' >&2
  exit 1
fi

export NODE_ENV=development
export STILL_ALIVE_APP_VARIANT=development

cd "$MOBILE_DIR"
# 每次启动前重新生成自动链接清单，确保新增的 Expo 原生模块（包括 DOM WebView）进入开发 APK。
pnpm exec expo prebuild --platform android --no-install --no-clean
exec pnpm exec expo run:android "$@"
