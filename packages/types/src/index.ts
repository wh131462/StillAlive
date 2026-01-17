// ============================================
// StillAlive - 共享类型定义
// ============================================

// ==================== 基础类型 ====================

// 心情类型
export type MoodType = 'happy' | 'calm' | 'tired' | 'sad' | 'anxious' | 'excited';

// 性别类型
export type GenderType = 'male' | 'female' | 'other';

// 主题色类型
export type ThemeColorType = 'rose' | 'blue' | 'amber' | 'purple' | 'green' | 'slate';

// ==================== User 类型 ====================

export interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ==================== Checkin 类型 ====================

export interface Checkin {
  id: string;
  userId: string;
  date: Date;
  content?: string;
  photo?: string;
  mood?: MoodType;
  isMakeup: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CheckinStats {
  totalDays: number;
  streak: number;
  totalRecords: number;
  checkinRate: number; // 打卡率 (0-100)
}

// 里程碑类型
export interface Milestone {
  days: number;
  name: string;
  achieved: boolean;
  achievedAt?: Date;
}

// ==================== Person 类型 ====================

export interface Person {
  id: string;
  userId: string;
  groupId?: string;
  name: string;
  gender?: GenderType;
  birthday?: string; // MM-DD
  birthYear?: number;
  photo?: string;
  mbti?: string;
  themeColor?: ThemeColorType;
  impression?: string;
  experience?: string;
  createdAt: Date;
  updatedAt?: Date;
  // 关联
  group?: PersonGroup;
}

export interface PersonGroup {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt?: Date;
  // 统计
  _count?: {
    people: number;
  };
}

// ==================== Emergency Config 类型 ====================

export interface EmergencyConfig {
  id: string;
  userId: string;
  email: string;
  triggerDays: number;
  isEnabled: boolean;
  lastNotifiedAt?: Date;
}

// ==================== Makeup Record 类型 ====================

export interface MakeupRecord {
  id: string;
  userId: string;
  yearMonth: string; // YYYY-MM
  count: number;
}

// ==================== API Response 类型 ====================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== Auth 类型 ====================

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
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// 忘记密码
export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

// ==================== Checkin 响应类型 ====================

export interface CheckinResponse extends Checkin {
  // 打卡响应，继承 Checkin 基本字段
}

// ==================== Checkin 请求类型 ====================

export interface CreateCheckinRequest {
  content?: string;
  photo?: string;
  mood?: MoodType;
}

export interface MakeupCheckinRequest {
  date: string; // YYYY-MM-DD
  content?: string;
  mood?: MoodType;
}

export interface MakeupCountResponse {
  yearMonth: string;
  count: number;
  limit: number;
  remaining: number;
}

// ==================== Person 请求类型 ====================

export interface CreatePersonRequest {
  name: string;
  groupId?: string;
  gender?: GenderType;
  birthday?: string;
  birthYear?: number;
  photo?: string;
  mbti?: string;
  themeColor?: ThemeColorType;
  impression?: string;
  experience?: string;
}

export interface UpdatePersonRequest extends Partial<CreatePersonRequest> {}

// ==================== PersonGroup 请求类型 ====================

export interface CreatePersonGroupRequest {
  name: string;
  icon?: string;
  color?: string;
}

export interface UpdatePersonGroupRequest extends Partial<CreatePersonGroupRequest> {
  sortOrder?: number;
}

// ==================== Settings 类型 ====================

export interface UpdateProfileRequest {
  nickname?: string;
  avatar?: string;
}

export interface UserStats {
  totalDays: number;
  totalPersons: number;
  totalRecords: number;
  longestStreak: number;
  currentStreak: number;
}

// ==================== 热力图数据类型 ====================

export interface HeatmapData {
  date: string; // YYYY-MM-DD
  count: number; // 0-4 表示活跃程度
}

export interface YearHeatmapResponse {
  year: number;
  data: HeatmapData[];
}

// ==================== 常量 ====================

export const MOOD_OPTIONS: { value: MoodType; label: string; emoji: string }[] = [
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'calm', label: '平静', emoji: '😌' },
  { value: 'tired', label: '疲惫', emoji: '😫' },
  { value: 'sad', label: '难过', emoji: '😢' },
  { value: 'anxious', label: '焦虑', emoji: '😰' },
  { value: 'excited', label: '兴奋', emoji: '🤩' },
];

export const THEME_COLORS: { value: ThemeColorType; label: string; class: string }[] = [
  { value: 'rose', label: '玫瑰', class: 'bg-rose-400' },
  { value: 'blue', label: '蓝色', class: 'bg-blue-400' },
  { value: 'amber', label: '琥珀', class: 'bg-amber-400' },
  { value: 'purple', label: '紫色', class: 'bg-purple-400' },
  { value: 'green', label: '绿色', class: 'bg-green-500' },
  { value: 'slate', label: '灰色', class: 'bg-slate-400' },
];

export const MILESTONES: Omit<Milestone, 'achieved' | 'achievedAt'>[] = [
  { days: 7, name: '初心者' },
  { days: 30, name: '坚持者' },
  { days: 100, name: '证明者' },
  { days: 365, name: '史诗' },
  { days: 1000, name: '传说' },
];

export const DEFAULT_GROUPS = ['家人', '朋友', '同事', '其他'];

export const MAKEUP_LIMIT_PER_MONTH = 3;
export const MAKEUP_DAYS_LIMIT = 7; // 只能补签7天内的
