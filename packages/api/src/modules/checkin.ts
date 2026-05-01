import type {
  CheckIn,
  CheckInStats,
  CreateCheckInRequest,
  UpdateCheckInRequest,
} from '@stillalive/types';
import type { HttpClient } from '../client';

export class CheckInApi {
  constructor(private http: HttpClient) {}

  checkIn(data?: CreateCheckInRequest) {
    return this.http.post<CheckIn>('/checkins', data);
  }

  retroactive(date: string, data?: CreateCheckInRequest) {
    return this.http.post<CheckIn>('/checkins/retroactive', { ...data, date });
  }

  update(id: string, data: UpdateCheckInRequest) {
    return this.http.put<CheckIn>(`/checkins/${id}`, data);
  }

  list(params?: { from?: string; to?: string }) {
    return this.http.get<CheckIn[]>('/checkins', params);
  }

  stats() {
    return this.http.get<CheckInStats>('/checkins/stats');
  }

  byDate(date: string) {
    return this.http.get<CheckIn | null>(`/checkins/${date}`);
  }
}
