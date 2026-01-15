/**
 * 同步管理器
 * 负责本地数据与服务器的同步
 */

import type { ILocalStorage, PendingChange, LocalCheckin, LocalPerson } from '@still-alive/local-storage';
import type {
  SyncConfig,
  SyncResult,
  SyncStatus,
  SyncState,
  ConflictInfo,
  ConflictResolution,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
} from './types';
import { DEFAULT_SYNC_CONFIG } from './types';

/** 同步 API 接口 (由 api-client 实现) */
export interface ISyncApi {
  syncPush(data: SyncPushRequest): Promise<SyncPushResponse>;
  syncPull(data: SyncPullRequest): Promise<SyncPullResponse>;
}

/** 同步事件监听器 */
export interface SyncEventListener {
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: Error) => void;
  onConflict?: (conflicts: ConflictInfo[]) => void;
  onStatusChange?: (status: SyncStatus) => void;
}

export class SyncManager {
  private storage: ILocalStorage;
  private api: ISyncApi;
  private config: SyncConfig;
  private listener?: SyncEventListener;

  private state: SyncState = 'idle';
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private pendingConflicts: ConflictInfo[] = [];

  constructor(
    storage: ILocalStorage,
    api: ISyncApi,
    config?: Partial<SyncConfig>
  ) {
    this.storage = storage;
    this.api = api;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  // ============ 公共 API ============

  /**
   * 设置事件监听器
   */
  setListener(listener: SyncEventListener): void {
    this.listener = listener;
  }

  /**
   * 启动自动同步
   */
  startAutoSync(): void {
    if (!this.config.autoSync) return;
    if (this.syncTimer) return;

    // 立即执行一次同步
    this.sync();

    // 定期同步
    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.syncInterval);

    // 监听网络恢复 (仅浏览器环境)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }
  }

  /**
   * 手动触发同步
   */
  async sync(): Promise<SyncResult> {
    // 检查是否正在同步
    if (this.state === 'syncing') {
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: 'Already syncing',
      };
    }

    // 检查网络状态
    if (!this.isOnline()) {
      this.setState('offline');
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: 'Offline',
      };
    }

    this.setState('syncing');
    this.listener?.onSyncStart?.();

    try {
      // 1. Push 本地变更到服务器
      const pushResult = await this.pushChanges();

      // 2. Pull 服务器变更到本地
      const pullResult = await this.pullChanges();

      // 3. 更新同步时间
      await this.storage.setLastSyncTime(Date.now());

      const result: SyncResult = {
        success: true,
        syncedCount: pushResult.syncedCount + pullResult.syncedCount,
        conflicts: [...pushResult.conflicts, ...pullResult.conflicts],
      };

      // 处理冲突
      if (result.conflicts.length > 0) {
        this.pendingConflicts = result.conflicts;
        this.listener?.onConflict?.(result.conflicts);
      }

      this.setState('idle');
      this.listener?.onSyncComplete?.(result);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      this.setState('error');
      this.listener?.onSyncError?.(error instanceof Error ? error : new Error(message));

      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: message,
      };
    }
  }

  /**
   * 获取同步状态
   */
  async getStatus(): Promise<SyncStatus> {
    const lastSyncAt = await this.storage.getLastSyncTime();
    const pending = await this.storage.getPendingChanges();

    return {
      state: this.state,
      lastSyncAt,
      pendingCount: pending.length,
      error: this.state === 'error' ? 'Sync failed' : undefined,
    };
  }

  /**
   * 获取待处理的冲突
   */
  getPendingConflicts(): ConflictInfo[] {
    return this.pendingConflicts;
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    const conflict = this.pendingConflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    if (resolution === 'keep_server') {
      // 使用服务器版本覆盖本地
      if (conflict.collection === 'checkins') {
        await this.storage.saveCheckin({
          ...(conflict.serverVersion as LocalCheckin),
          syncStatus: 'synced',
        });
      } else {
        await this.storage.savePerson({
          ...(conflict.serverVersion as LocalPerson),
          syncStatus: 'synced',
        });
      }
    } else {
      // 保留本地版本，标记为待同步
      await this.storage.markAsSynced([conflictId]);
    }

    // 移除已解决的冲突
    this.pendingConflicts = this.pendingConflicts.filter(
      (c) => c.id !== conflictId
    );
  }

  /**
   * 解决所有冲突 (批量)
   */
  async resolveAllConflicts(resolution: ConflictResolution): Promise<void> {
    for (const conflict of this.pendingConflicts) {
      await this.resolveConflict(conflict.id, resolution);
    }
  }

  // ============ 私有方法 ============

  /**
   * 推送本地变更到服务器
   */
  private async pushChanges(): Promise<{
    syncedCount: number;
    conflicts: ConflictInfo[];
  }> {
    const pendingChanges = await this.storage.getPendingChanges();

    if (pendingChanges.length === 0) {
      return { syncedCount: 0, conflicts: [] };
    }

    const lastSyncAt = await this.storage.getLastSyncTime();

    const request: SyncPushRequest = {
      lastSyncAt,
      changes: pendingChanges.map((change) => ({
        collection: change.collection,
        operation: change.operation,
        data: change.data,
        localUpdatedAt: change.timestamp,
      })),
    };

    const response = await this.api.syncPush(request);

    // 标记已同步的记录
    if (response.accepted.length > 0) {
      await this.storage.markAsSynced(response.accepted);
    }

    // 处理冲突
    const conflicts: ConflictInfo[] = response.conflicts.map((c) => {
      const localChange = pendingChanges.find((p) => p.id === c.id);
      return {
        id: c.id,
        collection: c.collection,
        localVersion: localChange?.data as LocalCheckin | LocalPerson,
        serverVersion: c.serverData,
      };
    });

    // 标记冲突记录
    if (conflicts.length > 0) {
      await this.storage.markAsConflict(conflicts.map((c) => c.id));
    }

    return {
      syncedCount: response.accepted.length,
      conflicts,
    };
  }

  /**
   * 从服务器拉取变更
   */
  private async pullChanges(): Promise<{
    syncedCount: number;
    conflicts: ConflictInfo[];
  }> {
    const lastSyncAt = await this.storage.getLastSyncTime();

    const request: SyncPullRequest = { lastSyncAt };
    const response = await this.api.syncPull(request);

    let syncedCount = 0;

    // 更新本地打卡记录
    if (response.checkins.length > 0) {
      const checkinsToSave = response.checkins.map((c) => ({
        ...c,
        syncStatus: 'synced' as const,
      }));
      await this.storage.bulkUpsertCheckins(checkinsToSave);
      syncedCount += response.checkins.length;
    }

    // 更新本地人物记录
    if (response.people.length > 0) {
      const peopleToSave = response.people.map((p) => ({
        ...p,
        syncStatus: 'synced' as const,
      }));
      await this.storage.bulkUpsertPeople(peopleToSave);
      syncedCount += response.people.length;
    }

    return { syncedCount, conflicts: [] };
  }

  /**
   * 检查网络状态
   */
  private isOnline(): boolean {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    // 非浏览器环境默认在线
    return true;
  }

  /**
   * 设置同步状态
   */
  private setState(state: SyncState): void {
    this.state = state;
    this.notifyStatusChange();
  }

  /**
   * 通知状态变化
   */
  private async notifyStatusChange(): Promise<void> {
    const status = await this.getStatus();
    this.listener?.onStatusChange?.(status);
  }

  /**
   * 网络恢复处理
   */
  private handleOnline = (): void => {
    // 网络恢复后立即同步
    this.sync();
  };
}
