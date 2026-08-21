export interface PasswordVaultEntry {
  id: string;
  name: string;
  username: string;
  password: string;
  url: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordVaultPayloadV1 {
  schemaVersion: 1;
  entries: PasswordVaultEntry[];
}

export interface PasswordVaultEntryDraft {
  name: string;
  username: string;
  password: string;
  url: string;
  note: string;
}

export const EMPTY_PASSWORD_VAULT: PasswordVaultPayloadV1 = { schemaVersion: 1, entries: [] };
