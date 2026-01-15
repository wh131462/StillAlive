/**
 * 本地存储工具
 * 提供跨平台的本地存储访问
 */

import { SqliteStorage } from '@still-alive/local-storage/mobile';
import type { ILocalStorage } from '@still-alive/local-storage';

let storage: SqliteStorage | null = null;
let initialized = false;

/**
 * 获取本地存储实例
 */
export function getLocalStorage(): ILocalStorage {
  if (!storage) {
    storage = new SqliteStorage();
  }
  return storage;
}

/**
 * 初始化本地存储
 */
export async function initializeLocalStorage(): Promise<void> {
  if (initialized) return;

  const localStorage = getLocalStorage();
  await localStorage.initialize();
  initialized = true;
}

/**
 * 检查本地存储是否已初始化
 */
export function isLocalStorageInitialized(): boolean {
  return initialized;
}

/**
 * 清理本地存储 (用于登出)
 */
export async function clearLocalStorage(): Promise<void> {
  const localStorage = getLocalStorage();
  await localStorage.clearAll();
}
