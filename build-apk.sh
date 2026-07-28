#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
NDK_VERSION="${ANDROID_NDK_VERSION:-27.1.12297006}"

if [[ -n "$SDK_DIR" && ! -f "$SDK_DIR/ndk/$NDK_VERSION/source.properties" ]]; then
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
JDK17_CANDIDATES=(
  "$CONFIGURED_JAVA_HOME"
  "${JAVA_HOME:-}"
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  "/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
)

for JDK_CANDIDATE in "${JDK17_CANDIDATES[@]}"; do
  if [[ -z "$JDK_CANDIDATE" || ! -x "$JDK_CANDIDATE/bin/java" ]]; then
    continue
  fi
  JAVA_VERSION_OUTPUT="$("$JDK_CANDIDATE/bin/java" -version 2>&1)"
  if [[ "$JAVA_VERSION_OUTPUT" == *'version "17.'* ]]; then
    export JAVA_HOME="$JDK_CANDIDATE"
    break
  fi
done

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME:-}/bin/java" || "$("${JAVA_HOME:-}/bin/java" -version 2>&1)" != *'version "17.'* ]]; then
  printf 'Error: Android 构建需要 JDK 17；当前未找到可用的 JDK 17。\n' >&2
  printf '请安装 JDK 17，或设置 JAVA_HOME 指向 JDK 17。\n' >&2
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
  ./gradlew -PndkVersion="$NDK_VERSION" assembleRelease
)

printf 'APK: %s\n' "$MOBILE_DIR/android/app/build/outputs/apk/release/app-release.apk"
