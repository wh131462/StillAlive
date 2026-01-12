// User types
export interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  createdAt: Date;
}

// Checkin types
export interface Checkin {
  id: string;
  userId: string;
  date: Date;
  content?: string;
  photo?: string;
  createdAt: Date;
}

export interface CheckinStats {
  totalDays: number;
  streak: number;
  totalRecords: number;
}

// Person types
export interface Person {
  id: string;
  userId: string;
  name: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: string; // MM-DD
  birthYear?: number;
  photo?: string;
  mbti?: string;
  impression?: string;
  experience?: string;
  createdAt: Date;
}

// Emergency config types
export interface EmergencyConfig {
  id: string;
  userId: string;
  email: string;
  triggerDays: number;
  isEnabled: boolean;
  lastNotifiedAt?: Date;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Checkin request types
export interface CreateCheckinRequest {
  content?: string;
  photo?: string;
}

// Person request types
export interface CreatePersonRequest {
  name: string;
  gender?: string;
  birthday?: string;
  birthYear?: number;
  photo?: string;
  mbti?: string;
  impression?: string;
  experience?: string;
}

export interface UpdatePersonRequest extends Partial<CreatePersonRequest> {}
