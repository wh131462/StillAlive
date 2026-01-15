/**
 * Mobile 本地存储实现 (expo-sqlite)
 * 用于 React Native / Expo 应用
 */

import * as SQLite from 'expo-sqlite';
import {
  ILocalStorage,
  LocalCheckin,
  LocalPerson,
  LocalSettings,
  PendingChange,
  SyncStatus,
  DEFAULT_SETTINGS,
} from '../types';

const DB_NAME = 'stillalive.db';

export class SqliteStorage implements ILocalStorage {
  private db: SQLite.SQLiteDatabase | null = null;

  // ============ 初始化 ============

  async initialize(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);

    // 创建表结构
    await this.db.execAsync(`
      -- 打卡记录表
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        date TEXT UNIQUE NOT NULL,
        content TEXT,
        photo TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        syncStatus TEXT DEFAULT 'pending',
        serverVersion INTEGER
      );

      -- 人物档案表
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT,
        birthday TEXT,
        birthYear INTEGER,
        photo TEXT,
        mbti TEXT,
        impression TEXT,
        experience TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        syncStatus TEXT DEFAULT 'pending',
        serverVersion INTEGER,
        isDeleted INTEGER DEFAULT 0
      );

      -- 同步元数据表
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- 设置表
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- 索引
      CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);
      CREATE INDEX IF NOT EXISTS idx_checkins_sync ON checkins(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_people_birthday ON people(birthday);
      CREATE INDEX IF NOT EXISTS idx_people_sync ON people(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_people_deleted ON people(isDeleted);
    `);

    // 初始化默认设置
    await this.initializeSettings();
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  private async initializeSettings(): Promise<void> {
    const existing = await this.db!.getFirstAsync<{ key: string }>(
      "SELECT key FROM settings WHERE key = 'initialized'"
    );

    if (!existing) {
      // 插入默认设置
      await this.db!.runAsync(
        "INSERT INTO settings (key, value) VALUES ('reminderEnabled', ?)",
        [String(DEFAULT_SETTINGS.reminderEnabled)]
      );
      await this.db!.runAsync(
        "INSERT INTO settings (key, value) VALUES ('reminderTime', ?)",
        [DEFAULT_SETTINGS.reminderTime]
      );
      await this.db!.runAsync(
        "INSERT INTO settings (key, value) VALUES ('theme', ?)",
        [DEFAULT_SETTINGS.theme]
      );
      await this.db!.runAsync(
        "INSERT INTO settings (key, value) VALUES ('lastSyncAt', ?)",
        [String(DEFAULT_SETTINGS.lastSyncAt)]
      );
      await this.db!.runAsync(
        "INSERT INTO settings (key, value) VALUES ('initialized', 'true')"
      );
    }
  }

  // ============ 打卡操作 ============

  async getCheckin(date: string): Promise<LocalCheckin | null> {
    const result = await this.db!.getFirstAsync<LocalCheckin>(
      'SELECT * FROM checkins WHERE date = ?',
      [date]
    );
    return result || null;
  }

  async getAllCheckins(): Promise<LocalCheckin[]> {
    return await this.db!.getAllAsync<LocalCheckin>(
      'SELECT * FROM checkins ORDER BY date DESC'
    );
  }

  async getCheckinsByMonth(year: number, month: number): Promise<LocalCheckin[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    return await this.db!.getAllAsync<LocalCheckin>(
      'SELECT * FROM checkins WHERE date >= ? AND date <= ? ORDER BY date DESC',
      [startDate, endDate]
    );
  }

  async getCheckinsByDateRange(startDate: string, endDate: string): Promise<LocalCheckin[]> {
    return await this.db!.getAllAsync<LocalCheckin>(
      'SELECT * FROM checkins WHERE date >= ? AND date <= ? ORDER BY date DESC',
      [startDate, endDate]
    );
  }

  async saveCheckin(checkin: LocalCheckin): Promise<void> {
    await this.db!.runAsync(
      `INSERT OR REPLACE INTO checkins
       (id, date, content, photo, createdAt, updatedAt, syncStatus, serverVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checkin.id,
        checkin.date,
        checkin.content || null,
        checkin.photo || null,
        checkin.createdAt,
        checkin.updatedAt,
        checkin.syncStatus,
        checkin.serverVersion || null,
      ]
    );
  }

  async deleteCheckin(id: string): Promise<void> {
    await this.db!.runAsync('DELETE FROM checkins WHERE id = ?', [id]);
  }

  // ============ 人物操作 ============

  async getPerson(id: string): Promise<LocalPerson | null> {
    const result = await this.db!.getFirstAsync<LocalPerson>(
      'SELECT * FROM people WHERE id = ? AND isDeleted = 0',
      [id]
    );
    return result ? this.transformPerson(result) : null;
  }

  async getAllPeople(): Promise<LocalPerson[]> {
    const results = await this.db!.getAllAsync<LocalPerson>(
      'SELECT * FROM people WHERE isDeleted = 0 ORDER BY createdAt DESC'
    );
    return results.map(this.transformPerson);
  }

  async getTodayBirthdays(todayMMDD: string): Promise<LocalPerson[]> {
    const results = await this.db!.getAllAsync<LocalPerson>(
      'SELECT * FROM people WHERE birthday = ? AND isDeleted = 0',
      [todayMMDD]
    );
    return results.map(this.transformPerson);
  }

  async savePerson(person: LocalPerson): Promise<void> {
    await this.db!.runAsync(
      `INSERT OR REPLACE INTO people
       (id, name, gender, birthday, birthYear, photo, mbti, impression, experience,
        createdAt, updatedAt, syncStatus, serverVersion, isDeleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        person.id,
        person.name,
        person.gender || null,
        person.birthday || null,
        person.birthYear || null,
        person.photo || null,
        person.mbti || null,
        person.impression || null,
        person.experience || null,
        person.createdAt,
        person.updatedAt,
        person.syncStatus,
        person.serverVersion || null,
        person.isDeleted ? 1 : 0,
      ]
    );
  }

  async deletePerson(id: string): Promise<void> {
    // 软删除
    const now = Date.now();
    await this.db!.runAsync(
      "UPDATE people SET isDeleted = 1, updatedAt = ?, syncStatus = 'pending' WHERE id = ?",
      [now, id]
    );
  }

  async hardDeletePerson(id: string): Promise<void> {
    await this.db!.runAsync('DELETE FROM people WHERE id = ?', [id]);
  }

  private transformPerson(row: any): LocalPerson {
    return {
      ...row,
      isDeleted: row.isDeleted === 1,
    };
  }

  // ============ 同步相关 ============

  async getPendingChanges(): Promise<PendingChange[]> {
    const checkins = await this.db!.getAllAsync<LocalCheckin>(
      "SELECT * FROM checkins WHERE syncStatus = 'pending'"
    );

    const people = await this.db!.getAllAsync<LocalPerson>(
      "SELECT * FROM people WHERE syncStatus = 'pending'"
    );

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
        data: p.isDeleted ? { id: p.id } : this.transformPerson(p),
        timestamp: p.updatedAt,
      })),
    ];

    return changes.sort((a, b) => a.timestamp - b.timestamp);
  }

  async markAsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    await this.db!.runAsync(
      `UPDATE checkins SET syncStatus = 'synced' WHERE id IN (${placeholders})`,
      ids
    );
    await this.db!.runAsync(
      `UPDATE people SET syncStatus = 'synced' WHERE id IN (${placeholders})`,
      ids
    );
  }

  async markAsConflict(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    await this.db!.runAsync(
      `UPDATE checkins SET syncStatus = 'conflict' WHERE id IN (${placeholders})`,
      ids
    );
    await this.db!.runAsync(
      `UPDATE people SET syncStatus = 'conflict' WHERE id IN (${placeholders})`,
      ids
    );
  }

  async getLastSyncTime(): Promise<number> {
    const result = await this.db!.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'lastSyncAt'"
    );
    return result ? parseInt(result.value, 10) : 0;
  }

  async setLastSyncTime(time: number): Promise<void> {
    await this.db!.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('lastSyncAt', ?)",
      [String(time)]
    );
  }

  // ============ 批量操作 ============

  async bulkUpsertCheckins(checkins: LocalCheckin[]): Promise<void> {
    if (checkins.length === 0) return;

    for (const checkin of checkins) {
      await this.saveCheckin(checkin);
    }
  }

  async bulkUpsertPeople(people: LocalPerson[]): Promise<void> {
    if (people.length === 0) return;

    for (const person of people) {
      await this.savePerson(person);
    }
  }

  // ============ 设置 ============

  async getSettings(): Promise<LocalSettings> {
    const rows = await this.db!.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );

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
    if (settings.reminderEnabled !== undefined) {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('reminderEnabled', ?)",
        [String(settings.reminderEnabled)]
      );
    }
    if (settings.reminderTime !== undefined) {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('reminderTime', ?)",
        [settings.reminderTime]
      );
    }
    if (settings.theme !== undefined) {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)",
        [settings.theme]
      );
    }
    if (settings.lastSyncAt !== undefined) {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('lastSyncAt', ?)",
        [String(settings.lastSyncAt)]
      );
    }
  }

  // ============ 清理 ============

  async clearAll(): Promise<void> {
    await this.db!.execAsync(`
      DELETE FROM checkins;
      DELETE FROM people;
      DELETE FROM sync_meta;
      UPDATE settings SET value = '0' WHERE key = 'lastSyncAt';
    `);
  }

  async clearCollection(collection: 'checkins' | 'people'): Promise<void> {
    await this.db!.runAsync(`DELETE FROM ${collection}`);
  }
}

// 导出单例获取函数
let instance: SqliteStorage | null = null;

export function getSqliteStorage(): SqliteStorage {
  if (!instance) {
    instance = new SqliteStorage();
  }
  return instance;
}
