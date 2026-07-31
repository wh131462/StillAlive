#!/usr/bin/env bash

if ! (return 0 2>/dev/null); then
  printf 'Error: 请使用 source ./jks/export.sh 加载签名环境变量。\n' >&2
  exit 1
fi

_still_alive_export_signing() {
  local export_script_path
  local jks_dir
  local keystore_path=''
  local keystore_count=0
  local candidate

  if [[ -n "${BASH_VERSION:-}" ]]; then
    export_script_path="${BASH_SOURCE[0]}"
  elif [[ -n "${ZSH_VERSION:-}" ]]; then
    export_script_path="${(%):-%x}"
  else
    printf 'Error: export.sh 仅支持 Bash 或 Zsh。\n' >&2
    return 1
  fi

  jks_dir="$(cd "$(dirname "$export_script_path")" && pwd)"

  for candidate in "$jks_dir"/*.jks; do
    [[ -f "$candidate" ]] || continue
    keystore_path="$candidate"
    keystore_count=$((keystore_count + 1))
  done

  if [[ "$keystore_count" -eq 0 ]]; then
    printf 'Error: %s 中未找到 .jks 文件。\n' "$jks_dir" >&2
    return 1
  fi

  if [[ "$keystore_count" -gt 1 ]]; then
    printf 'Error: %s 中存在多个 .jks 文件，请仅保留生产签名文件。\n' "$jks_dir" >&2
    return 1
  fi

  export STILL_ALIVE_ANDROID_KEYSTORE_PATH="$keystore_path"
  export STILL_ALIVE_ANDROID_KEY_ALIAS="${STILL_ALIVE_ANDROID_KEY_ALIAS:-still-alive-release}"

  if [[ -z "${STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD:-}" ]]; then
    if [[ ! -t 0 ]]; then
      printf 'Error: 当前无法交互输入 keystore 密码。\n' >&2
      return 1
    fi

    if [[ -n "${BASH_VERSION:-}" ]]; then
      if ! IFS= read -r -s -p '请输入 keystore 密码：' STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD; then
        printf '\nError: keystore 密码读取失败。\n' >&2
        return 1
      fi
    else
      if ! IFS= read -r -s 'STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD?请输入 keystore 密码：'; then
        printf '\nError: keystore 密码读取失败。\n' >&2
        return 1
      fi
    fi
    printf '\n'

    if [[ -z "$STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD" ]]; then
      printf 'Error: keystore 密码不能为空。\n' >&2
      return 1
    fi

    export STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD
  fi

  if [[ -z "${STILL_ALIVE_ANDROID_KEY_PASSWORD:-}" ]]; then
    if [[ ! -t 0 ]]; then
      printf 'Error: 当前无法交互输入密钥密码。\n' >&2
      return 1
    fi

    if [[ -n "${BASH_VERSION:-}" ]]; then
      if ! IFS= read -r -s -p '请输入密钥密码（回车复用 keystore 密码）：' STILL_ALIVE_ANDROID_KEY_PASSWORD; then
        printf '\nError: 密钥密码读取失败。\n' >&2
        return 1
      fi
    else
      if ! IFS= read -r -s 'STILL_ALIVE_ANDROID_KEY_PASSWORD?请输入密钥密码（回车复用 keystore 密码）：'; then
        printf '\nError: 密钥密码读取失败。\n' >&2
        return 1
      fi
    fi
    printf '\n'
    export STILL_ALIVE_ANDROID_KEY_PASSWORD="${STILL_ALIVE_ANDROID_KEY_PASSWORD:-$STILL_ALIVE_ANDROID_KEYSTORE_PASSWORD}"
  fi
}

if _still_alive_export_signing; then
  unset -f _still_alive_export_signing
  return 0
fi

unset -f _still_alive_export_signing
return 1
