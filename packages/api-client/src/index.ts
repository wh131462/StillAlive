import type {
  User,
  Checkin,
  CheckinStats,
  Person,
  PersonGroup,
  EmergencyConfig,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  CreateCheckinRequest,
  CreatePersonRequest,
  UpdatePersonRequest,
  MoodType,
  MakeupCheckinRequest,
  MakeupCountResponse,
  ForgotPasswordRequest,
  VerifyResetCodeRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  HeatmapData,
  CheckinResponse,
} from '@still-alive/types';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
};

const DEFAULT_TIMEOUT = 10000; // 10 seconds

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Request failed');
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }
      throw error;
    }
  }

  // Auth
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request('/auth/login', { method: 'POST', body: data });
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request('/auth/register', { method: 'POST', body: data });
  }

  async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    return this.request('/auth/refresh-token', { method: 'POST', body: data });
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string; code?: string }> {
    return this.request('/auth/forgot-password', { method: 'POST', body: data });
  }

  async verifyResetCode(data: VerifyResetCodeRequest): Promise<{ valid: boolean }> {
    return this.request('/auth/verify-reset-code', { method: 'POST', body: data });
  }

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    return this.request('/auth/reset-password', { method: 'POST', body: data });
  }

  async logout(refreshToken: string): Promise<void> {
    return this.request('/auth/logout', { method: 'POST', body: { refreshToken } });
  }

  // User
  async getMe(): Promise<User> {
    return this.request('/user/me');
  }

  async updateMe(data: Partial<User>): Promise<User> {
    return this.request('/user/me', { method: 'PUT', body: data });
  }

  async getEmergencyConfig(): Promise<EmergencyConfig | null> {
    return this.request('/user/emergency-config');
  }

  async updateEmergencyConfig(data: Partial<EmergencyConfig>): Promise<EmergencyConfig> {
    return this.request('/user/emergency-config', { method: 'PUT', body: data });
  }

  // Checkin
  async checkinToday(data?: CreateCheckinRequest): Promise<Checkin> {
    return this.request('/checkin/today', { method: 'POST', body: data || {} });
  }

  async getTodayCheckin(): Promise<{ checkedIn: boolean; checkin: Checkin | null }> {
    return this.request('/checkin/today');
  }

  async getCheckinHistory(year?: number, month?: number): Promise<Checkin[]> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    return this.request(`/checkin/history?${params}`);
  }

  async getCheckinStats(): Promise<CheckinStats> {
    return this.request('/checkin/stats');
  }

  async makeupCheckin(data: MakeupCheckinRequest): Promise<CheckinResponse> {
    return this.request('/checkin/makeup', { method: 'POST', body: data });
  }

  async getMakeupCount(month?: string): Promise<MakeupCountResponse> {
    const params = month ? `?month=${month}` : '';
    return this.request(`/checkin/makeup-count${params}`);
  }

  async getHeatmap(year: number): Promise<HeatmapData> {
    return this.request(`/checkin/heatmap/${year}`);
  }

  async getCheckinDetail(date: string): Promise<{ checkin: Checkin | null }> {
    return this.request(`/checkin/detail/${date}`);
  }

  async updateCheckinDetail(date: string, data: { content?: string; photo?: string; mood?: MoodType }): Promise<{ checkin: Checkin }> {
    return this.request(`/checkin/detail/${date}`, { method: 'PUT', body: data });
  }

  // People
  async getPeople(options?: { groupId?: string; sortBy?: 'createdAt' | 'birthday' }): Promise<Person[]> {
    const params = new URLSearchParams();
    if (options?.groupId) params.append('groupId', options.groupId);
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    const query = params.toString();
    return this.request(`/people${query ? `?${query}` : ''}`);
  }

  async getTodayBirthdays(): Promise<Person[]> {
    return this.request('/people/birthday/today');
  }

  async getUpcomingBirthdays(): Promise<Person[]> {
    return this.request('/people/birthday/upcoming');
  }

  async searchPeople(keyword: string): Promise<Person[]> {
    return this.request(`/people/search?keyword=${encodeURIComponent(keyword)}`);
  }

  // Person Groups
  async getPersonGroups(): Promise<PersonGroup[]> {
    return this.request('/people/groups');
  }

  async createPersonGroup(data: { name: string; icon?: string; color?: string }): Promise<PersonGroup> {
    return this.request('/people/groups', { method: 'POST', body: data });
  }

  async updatePersonGroup(id: string, data: { name?: string; icon?: string; color?: string; sortOrder?: number }): Promise<PersonGroup> {
    return this.request(`/people/groups/${id}`, { method: 'PUT', body: data });
  }

  async deletePersonGroup(id: string): Promise<void> {
    return this.request(`/people/groups/${id}`, { method: 'DELETE' });
  }

  async getPerson(id: string): Promise<Person> {
    return this.request(`/people/${id}`);
  }

  async createPerson(data: CreatePersonRequest): Promise<Person> {
    return this.request('/people', { method: 'POST', body: data });
  }

  async updatePerson(id: string, data: UpdatePersonRequest): Promise<Person> {
    return this.request(`/people/${id}`, { method: 'PUT', body: data });
  }

  async deletePerson(id: string): Promise<void> {
    return this.request(`/people/${id}`, { method: 'DELETE' });
  }

  // ============ 同步 API ============

  /**
   * 推送本地变更到服务器
   */
  async syncPush(data: SyncPushRequest): Promise<SyncPushResponse> {
    return this.request('/sync/push', { method: 'POST', body: data });
  }

  /**
   * 从服务器拉取变更
   */
  async syncPull(data: SyncPullRequest): Promise<SyncPullResponse> {
    return this.request('/sync/pull', { method: 'POST', body: data });
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatusResponse> {
    return this.request('/sync/status');
  }

  // ============ 增值服务 API ============

  /**
   * 获取每日信息差
   */
  async getDailyInfo(): Promise<DailyInfoResponse> {
    return this.request('/daily-info');
  }

  /**
   * 获取每日信息差历史
   */
  async getDailyInfoHistory(limit = 7): Promise<DailyInfoResponse[]> {
    return this.request(`/daily-info/history?limit=${limit}`);
  }

  /**
   * 生成年度总结
   */
  async generateYearlySummary(year: number): Promise<YearlySummaryResponse> {
    return this.request('/premium/yearly-summary/generate', {
      method: 'POST',
      body: { year },
    });
  }

  /**
   * 获取年度总结
   */
  async getYearlySummary(year: number): Promise<YearlySummaryResponse | null> {
    return this.request(`/premium/yearly-summary/${year}`);
  }
}

// ============ 同步类型 ============

export interface SyncPushRequest {
  lastSyncAt: number;
  changes: Array<{
    collection: 'checkins' | 'people';
    operation: 'upsert' | 'delete';
    data: unknown;
    localUpdatedAt: number;
  }>;
}

export interface SyncPushResponse {
  syncedAt: number;
  accepted: string[];
  conflicts: Array<{
    id: string;
    collection: 'checkins' | 'people';
    serverData: unknown;
  }>;
}

export interface SyncPullRequest {
  lastSyncAt: number;
}

export interface SyncPullResponse {
  checkins: Checkin[];
  people: Person[];
  serverTime: number;
}

export interface SyncStatusResponse {
  checkinsCount: number;
  peopleCount: number;
  lastServerUpdate: number;
}

// ============ 增值服务类型 ============

export interface DailyNewsItem {
  id: string;
  title: string;
  summary: string;
  category: 'tech' | 'world' | 'finance' | 'science' | 'culture' | 'sports' | 'other';
  source?: string;
  url?: string;
  importance: 1 | 2 | 3;
}

export interface HistoryTodayItem {
  year: number;
  event: string;
  category: 'history' | 'birth' | 'death' | 'invention' | 'culture';
}

export interface DailyInfoResponse {
  date: string;
  news: DailyNewsItem[];
  historyToday: HistoryTodayItem[];
  generatedAt: string;
}

export interface YearlySummaryResponse {
  exists: boolean;
  content?: {
    year: number;
    title: string;
    highlights: string[];
    statistics: {
      totalDays: number;
      longestStreak: number;
      meaningfulMoments: number;
      peopleCherished: number;
    };
    monthlyReview: Array<{
      month: number;
      summary: string;
      keyMoment?: string;
    }>;
    aiInsights: string;
    shareImage?: string;
  };
}

export const apiClient = new ApiClient();
