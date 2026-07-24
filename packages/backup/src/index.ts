export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupManifest {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  files: Array<{ path: string; checksum: string }>;
}

export interface BackupService {
  export(): Promise<string>;
  restore(archivePath: string): Promise<void>;
}
