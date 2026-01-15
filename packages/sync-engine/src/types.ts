/**
 * 同步引擎类型定义
 */

import type { LocalCheckin, LocalPerson } from '@still-alive/local-storage';

// ============ 同步配置 ============

export interface SyncConfig {
  /** 是否启用自动同步 */
  autoSync: boolean;
  /** 同步间隔 (毫秒) */
  syncInterval: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟 (毫秒) */
  retryDelay: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSync: true,
  syncInterval: 30 * 60 * 1000, // 30 分钟
  maxRetries: 3,
  retryDelay: 5000, // 5 秒
};

// ============ 同步请求/响应 ============

/** 变更项 */
export interface SyncChange {
  collection: 'checkins' | 'people';
  operation: 'upsert' | 'delete';
  data: LocalCheckin | LocalPerson | { id: string };
  localUpdatedAt: number;
}

/** Push 请求 */
export interface SyncPushRequest {
  lastSyncAt: number;
  changes: SyncChange[];
}

/** Push 响应 */
export interface SyncPushResponse {
  syncedAt: number;
  accepted: string[];
  conflicts: SyncConflict[];
}

/** Pull 请求 */
export interface SyncPullRequest {
  lastSyncAt: number;
}

/** Pull 响应 */
export interface SyncPullResponse {
  checkins: LocalCheckin[];
  people: LocalPerson[];
  serverTime: number;
}

/** 同步状态响应 */
export interface SyncStatusResponse {
  checkinsCount: number;
  peopleCount: number;
  lastServerUpdate: number;
}

// ============ 冲突处理 ============

/** 同步冲突 */
export interface SyncConflict {
  id: string;
  collection: 'checkins' | 'people';
  serverData: LocalCheckin | LocalPerson;
}

/** 冲突信息 (用于 UI 展示) */
export interface ConflictInfo {
  id: string;
  collection: 'checkins' | 'people';
  localVersion: LocalCheckin | LocalPerson;
  serverVersion: LocalCheckin | LocalPerson;
}

/** 冲突解决策略 */
export type ConflictResolution = 'keep_local' | 'keep_server';

// ============ 同步结果 ============

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflicts: ConflictInfo[];
  error?: string;
}

// ============ 同步状态 ============

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: number;
  pendingCount: number;
  error?: string;
}
