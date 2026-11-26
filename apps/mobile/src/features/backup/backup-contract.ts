export const BACKUP_SCHEMA_VERSION = 16;

export interface BackupManifest {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  files: Array<{ path: string; checksum: string }>;
}
