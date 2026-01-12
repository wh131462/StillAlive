import type {
  User,
  Checkin,
  CheckinStats,
  Person,
  EmergencyConfig,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  CreateCheckinRequest,
  CreatePersonRequest,
  UpdatePersonRequest,
} from '@still-alive/types';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

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
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request('/auth/login', { method: 'POST', body: data });
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request('/auth/register', { method: 'POST', body: data });
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

  // People
  async getPeople(): Promise<Person[]> {
    return this.request('/people');
  }

  async getTodayBirthdays(): Promise<Person[]> {
    return this.request('/people/birthday/today');
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
}

export const apiClient = new ApiClient();
