export type Gender = 'male' | 'female' | 'other';

export interface Person {
  id: string;
  userId: string;
  name: string;
  gender: Gender | null;
  birthday: string | null;
  birthdayLunar: boolean;
  photoUrl: string | null;
  mbti: string | null;
  themeColor: string;
  impression: string | null;
  groupId: string | null;
  createdAt: string;
}

export interface PersonGroup {
  id: string;
  userId: string;
  name: string;
  isPreset: boolean;
}

export interface ImportantDate {
  id: string;
  personId: string;
  date: string;
  label: string;
  isLunar: boolean;
}

export interface SharedMemory {
  id: string;
  personId: string;
  content: string;
  date: string | null;
  createdAt: string;
}

export interface CreatePersonRequest {
  name: string;
  gender?: Gender;
  birthday?: string;
  birthdayLunar?: boolean;
  photoUrl?: string;
  mbti?: string;
  themeColor?: string;
  impression?: string;
  groupId?: string;
}
