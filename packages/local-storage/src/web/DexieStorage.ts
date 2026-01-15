/**
 * Web 本地存储实现 (Dexie.js / IndexedDB)
 * 用于 Web 应用
 */

import Dexie, { Table } from 'dexie';
import {
  ILocalStorage,
  LocalCheckin,
  LocalPerson,
  LocalSettings,
  PendingChange,
  DEFAULT_SETTINGS,
} from '../types';

/**
 * StillAlive 数据库定义
 */
class StillAliveDB extends Dexie {
  checkins!: Table<LocalCheckin>;
  people!: Table<LocalPerson>;
  settings!: Table<{ key: string; value: string }>;

  constructor() {
    super('stillalive');

    this.version(1).stores({
      // 索引定义
      checkins: 'id, date, syncStatus, updatedAt',
      people: 'id, birthday, syncStatus, updatedAt, isDeleted',
      settings: 'key',
    });
  }
}

export class DexieStorage implements ILocalStorage {
  private db: StillAliveDB;

  constructor() {
    this.db = new StillAliveDB();
  }

  // ============ 初始化 ============

  async initialize(): Promise<void> {
    await this.db.open();
    await this.initializeSettings();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private async initializeSettings(): Promise<void> {
    const existing = await this.db.settings.get('initialized');

    if (!existing) {
      await this.db.settings.bulkPut([
        { key: 'reminderEnabled', value: String(DEFAULT_SETTINGS.reminderEnabled) },
        { key: 'reminderTime', value: DEFAULT_SETTINGS.reminderTime },
        { key: 'theme', value: DEFAULT_SETTINGS.theme },
        { key: 'lastSyncAt', value: String(DEFAULT_SETTINGS.lastSyncAt) },
        { key: 'initialized', value: 'true' },
      ]);
    }
  }

  // ============ 打卡操作 ============

  async getCheckin(date: string): Promise<LocalCheckin | null> {
    const result = await this.db.checkins.where('date').equals(date).first();
    return result || null;
  }

  async getAllCheckins(): Promise<LocalCheckin[]> {
    return await this.db.checkins.orderBy('date').reverse().toArray();
  }

  async getCheckinsByMonth(year: number, month: number): Promise<LocalCheckin[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    return await this.db.checkins
      .where('date')
      .between(startDate, endDate, true, true)
      .reverse()
      .toArray();
  }

  async getCheckinsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<LocalCheckin[]> {
    return await this.db.checkins
      .where('date')
      .between(startDate, endDate, true, true)
      .reverse()
      .toArray();
  }

  async saveCheckin(checkin: LocalCheckin): Promise<void> {
    await this.db.checkins.put(checkin);
  }

  async deleteCheckin(id: string): Promise<void> {
    await this.db.checkins.delete(id);
  }

  // ============ 人物操作 ============

  async getPerson(id: string): Promise<LocalPerson | null> {
    const result = await this.db.people.get(id);
    if (result && !result.isDeleted) {
      return result;
    }
    return null;
  }

  async getAllPeople(): Promise<LocalPerson[]> {
    return await this.db.people
      .filter((p) => !p.isDeleted)
      .reverse()
      .sortBy('createdAt');
  }

  async getTodayBirthdays(todayMMDD: string): Promise<LocalPerson[]> {
    return await this.db.people
      .where('birthday')
      .equals(todayMMDD)
      .filter((p) => !p.isDeleted)
      .toArray();
  }

  async savePerson(person: LocalPerson): Promise<void> {
    await this.db.people.put(person);
  }

  async deletePerson(id: string): Promise<void> {
    // 软删除
    const person = await this.db.people.get(id);
    if (person) {
      await this.db.people.update(id, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending',
      });
    }
  }

  async hardDeletePerson(id: string): Promise<void> {
    await this.db.people.delete(id);
  }

  // ============ 同步相关 ============

  async getPendingChanges(): Promise<PendingChange[]> {
    const checkins = await this.db.checkins
      .where('syncStatus')
      .equals('pending')
      .toArray();

    const people = await this.db.people
      .where('syncStatus')
      .equals('pending')
      .toArray();

    const changes: PendingChange[] = [
      ...checkins.map((c) => ({
        id: c.id,
        collection: 'checkins' as const,
        operation: 'upsert' as const,
        data: c,
        timestamp: c.updatedAt,
      })),
      ...people.map((p) => ({
        id: p.id,
        collection: 'people' as const,
        operation: p.isDeleted ? ('delete' as const) : ('upsert' as const),
        data: p.isDeleted ? { id: p.id } : p,
        timestamp: p.updatedAt,
      })),
    ];

    return changes.sort((a, b) => a.timestamp - b.timestamp);
  }

  async markAsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.db.transaction('rw', [this.db.checkins, this.db.people], async () => {
      for (const id of ids) {
        await this.db.checkins.update(id, { syncStatus: 'synced' });
        await this.db.people.update(id, { syncStatus: 'synced' });
      }
    });
  }

  async markAsConflict(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.db.transaction('rw', [this.db.checkins, this.db.people], async () => {
      for (const id of ids) {
        await this.db.checkins.update(id, { syncStatus: 'conflict' });
        await this.db.people.update(id, { syncStatus: 'conflict' });
      }
    });
  }

  async getLastSyncTime(): Promise<number> {
    const result = await this.db.settings.get('lastSyncAt');
    return result ? parseInt(result.value, 10) : 0;
  }

  async setLastSyncTime(time: number): Promise<void> {
    await this.db.settings.put({ key: 'lastSyncAt', value: String(time) });
  }

  // ============ 批量操作 ============

  async bulkUpsertCheckins(checkins: LocalCheckin[]): Promise<void> {
    if (checkins.length === 0) return;
    await this.db.checkins.bulkPut(checkins);
  }

  async bulkUpsertPeople(people: LocalPerson[]): Promise<void> {
    if (people.length === 0) return;
    await this.db.people.bulkPut(people);
  }

  // ============ 设置 ============

  async getSettings(): Promise<LocalSettings> {
    const rows = await this.db.settings.toArray();
    const settings: LocalSettings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      switch (row.key) {
        case 'reminderEnabled':
          settings.reminderEnabled = row.value === 'true';
          break;
        case 'reminderTime':
          settings.reminderTime = row.value;
          break;
        case 'theme':
          settings.theme = row.value as LocalSettings['theme'];
          break;
        case 'lastSyncAt':
          settings.lastSyncAt = parseInt(row.value, 10);
          break;
      }
    }

    return settings;
  }

  async saveSettings(settings: Partial<LocalSettings>): Promise<void> {
    const updates: { key: string; value: string }[] = [];

    if (settings.reminderEnabled !== undefined) {
      updates.push({ key: 'reminderEnabled', value: String(settings.reminderEnabled) });
    }
    if (settings.reminderTime !== undefined) {
      updates.push({ key: 'reminderTime', value: settings.reminderTime });
    }
    if (settings.theme !== undefined) {
      updates.push({ key: 'theme', value: settings.theme });
    }
    if (settings.lastSyncAt !== undefined) {
      updates.push({ key: 'lastSyncAt', value: String(settings.lastSyncAt) });
    }

    if (updates.length > 0) {
      await this.db.settings.bulkPut(updates);
    }
  }

  // ============ 清理 ============

  async clearAll(): Promise<void> {
    await this.db.transaction('rw', [this.db.checkins, this.db.people, this.db.settings], async () => {
      await this.db.checkins.clear();
      await this.db.people.clear();
      await this.db.settings.put({ key: 'lastSyncAt', value: '0' });
    });
  }

  async clearCollection(collection: 'checkins' | 'people'): Promise<void> {
    if (collection === 'checkins') {
      await this.db.checkins.clear();
    } else {
      await this.db.people.clear();
    }
  }
}

// 导出单例获取函数
let instance: DexieStorage | null = null;

export function getDexieStorage(): DexieStorage {
  if (!instance) {
    instance = new DexieStorage();
  }
  return instance;
}
