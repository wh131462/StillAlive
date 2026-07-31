#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
NDK_VERSION="${ANDROID_NDK_VERSION:-27.1.12297006}"
APP_VERSION="$(node -e "const config = require(process.argv[1]); process.stdout.write(config.expo.version);" "$MOBILE_DIR/app.json")"
SIGNING_CONFIG="$MOBILE_DIR/android-production-signing.gradle"
SIGNING_ENV_FILE="$ROOT_DIR/jks/export.sh"

if [[ ! "$APP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  printf 'Error: apps/mobile/app.json 中的 expo.version 无效：%s\n' "$APP_VERSION" >&2
  exit 1
fi

for SIGNING_VARIABLE in \
  STILL_ALIVE_ANDROID_KEYSTORE_PATH \
  STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD \
  STILL_ALIVE_ANDROID_KEY_ALIAS \
  STILL_ALIVE_ANDROID_KEY_PASSWORD; do
  if [[ -z "${!SIGNING_VARIABLE:-}" && -f "$SIGNING_ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$SIGNING_ENV_FILE"
    break
  fi
done

for SIGNING_VARIABLE in \
  STILL_ALIVE_ANDROID_KEYSTORE_PATH \
  STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD \
  STILL_ALIVE_ANDROID_KEY_ALIAS \
  STILL_ALIVE_ANDROID_KEY_PASSWORD; do
  if [[ -z "${!SIGNING_VARIABLE:-}" ]]; then
    printf 'Error: 缺少生产签名环境变量 %s。\n' "$SIGNING_VARIABLE" >&2
    exit 1
  fi
done

if [[ ! -f "$STILL_ALIVE_ANDROID_KEYSTORE_PATH" ]]; then
  printf 'Error: 生产签名文件不存在：%s\n' "$STILL_ALIVE_ANDROID_KEYSTORE_PATH" >&2
  exit 1
fi

if [[ -z "$SDK_DIR" && -d "$HOME/Library/Android/sdk" ]]; then
  SDK_DIR="$HOME/Library/Android/sdk"
fi

if [[ -z "$SDK_DIR" || ! -d "$SDK_DIR" ]]; then
  printf 'Error: 当前未找到可用的 Android SDK。\n' >&2
  printf '请设置 ANDROID_HOME，或通过 Android Studio 安装 Android SDK。\n' >&2
  exit 1
fi

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export NODE_ENV="${NODE_ENV:-production}"

if [[ ! -f "$SDK_DIR/ndk/$NDK_VERSION/source.properties" ]]; then
  for NDK_SOURCE in "$SDK_DIR"/ndk/27.*/source.properties; do
    if [[ -f "$NDK_SOURCE" ]]; then
      NDK_VERSION="$(basename "$(dirname "$NDK_SOURCE")")"
      printf 'Warning: required NDK is incomplete; using NDK %s\n' "$NDK_VERSION" >&2
      break
    fi
  done
fi

pnpm --dir "$MOBILE_DIR" exec expo prebuild --platform android --no-install --no-clean

GRADLE_PROPERTIES="$MOBILE_DIR/android/gradle.properties"
CONFIGURED_JAVA_HOME="$(sed -n 's/^org\.gradle\.java\.installations\.paths=//p' "$GRADLE_PROPERTIES")"
MACOS_JAVA_HOME_17="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
JDK_CANDIDATES=(
  "$CONFIGURED_JAVA_HOME"
  "${JAVA_HOME:-}"
  "$MACOS_JAVA_HOME_17"
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
)

for JDK_CANDIDATE in "${JDK_CANDIDATES[@]}"; do
  if [[ -z "$JDK_CANDIDATE" || ! -x "$JDK_CANDIDATE/bin/java" || ! -x "$JDK_CANDIDATE/bin/javac" || ! -x "$JDK_CANDIDATE/bin/jlink" ]]; then
    continue
  fi

  JAVA_VERSION_OUTPUT="$("$JDK_CANDIDATE/bin/java" -version 2>&1)"
  JAVA_MAJOR_VERSION="$(printf '%s\n' "$JAVA_VERSION_OUTPUT" | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n 1)"

  if [[ "$JAVA_MAJOR_VERSION" == "17" ]]; then
    export JAVA_HOME="$JDK_CANDIDATE"
    break
  fi
done

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" || ! -x "$JAVA_HOME/bin/javac" || ! -x "$JAVA_HOME/bin/jlink" ]]; then
  printf 'Error: Android 构建需要包含 java、javac 和 jlink 的完整 JDK 17。\n' >&2
  exit 1
fi

if command -v scutil >/dev/null 2>&1; then
  SYSTEM_PROXY="$(scutil --proxy 2>/dev/null || true)"
  if [[ "$SYSTEM_PROXY" == *'HTTPSEnable : 1'* ]]; then
    HTTPS_PROXY_HOST="$(printf '%s\n' "$SYSTEM_PROXY" | sed -n 's/^  HTTPSProxy : //p' | head -n 1)"
    HTTPS_PROXY_PORT="$(printf '%s\n' "$SYSTEM_PROXY" | sed -n 's/^  HTTPSPort : //p' | head -n 1)"
    HTTP_PROXY_HOST="$(printf '%s\n' "$SYSTEM_PROXY" | sed -n 's/^  HTTPProxy : //p' | head -n 1)"
    HTTP_PROXY_PORT="$(printf '%s\n' "$SYSTEM_PROXY" | sed -n 's/^  HTTPPort : //p' | head -n 1)"

    if [[ -n "$HTTPS_PROXY_HOST" && -n "$HTTPS_PROXY_PORT" ]]; then
      export GRADLE_OPTS="${GRADLE_OPTS:-} -Dhttps.proxyHost=$HTTPS_PROXY_HOST -Dhttps.proxyPort=$HTTPS_PROXY_PORT"
    fi
    if [[ -n "$HTTP_PROXY_HOST" && -n "$HTTP_PROXY_PORT" ]]; then
      export GRADLE_OPTS="${GRADLE_OPTS:-} -Dhttp.proxyHost=$HTTP_PROXY_HOST -Dhttp.proxyPort=$HTTP_PROXY_PORT"
    fi
  fi
fi

(
  cd "$MOBILE_DIR/android"
  ./gradlew --init-script "$SIGNING_CONFIG" -PndkVersion="$NDK_VERSION" assembleRelease
)

APK_OUTPUT_DIR="$MOBILE_DIR/android/app/build/outputs/apk/release"
APK_SOURCE="$APK_OUTPUT_DIR/app-release.apk"
APK_TARGET="$APK_OUTPUT_DIR/still-alive-pro-v$APP_VERSION.apk"

mv -f "$APK_SOURCE" "$APK_TARGET"
printf 'APK: %s\n' "$APK_TARGET"
