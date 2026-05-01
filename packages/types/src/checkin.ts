export interface CheckIn {
  id: string;
  userId: string;
  date: string;
  isRetroactive: boolean;
  content: string | null;
  photoUrl: string | null;
  moodTag: string | null;
  createdAt: string;
}

export interface CreateCheckInRequest {
  date?: string;
  content?: string;
  photoUrl?: string;
  moodTag?: string;
}

export interface UpdateCheckInRequest {
  content?: string;
  photoUrl?: string;
  moodTag?: string;
}

export interface CheckInStats {
  totalDays: number;
  consecutiveDays: number;
  recordCount: number;
}

export interface MilestoneInfo {
  days: number;
  achieved: boolean;
  message: string;
}
