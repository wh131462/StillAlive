export type DayKey = `${number}-${number}-${number}`;

export interface CheckIn {
  id: string;
  dayKey: DayKey;
  createdAt: string;
}

export interface Post {
  id: string;
  dayKey: DayKey;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  avatarMediaId: string | null;
  relationToMe: string | null;
  impression: string | null;
  memoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  localPath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  checksum: string;
  createdAt: string;
}

export interface Draft {
  id: string;
  dayKey: DayKey;
  bodyMarkdown: string;
  updatedAt: string;
}
