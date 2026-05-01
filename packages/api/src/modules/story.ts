import type {
  CreateStoryRequest,
  ResonanceRequest,
  Story,
  StoryCategory,
} from '@stillalive/types';
import type { HttpClient } from '../client';

export class StoryApi {
  constructor(private http: HttpClient) {}

  list(params?: { category?: StoryCategory; cursor?: string; limit?: number }) {
    const query: Record<string, string> = {};
    if (params?.category) query.category = params.category;
    if (params?.cursor) query.cursor = params.cursor;
    if (params?.limit) query.limit = String(params.limit);
    return this.http.get<Story[]>('/stories', query);
  }

  detail(id: string) {
    return this.http.get<Story>(`/stories/${id}`);
  }

  random() {
    return this.http.get<Story>('/stories/random');
  }

  submit(data: CreateStoryRequest) {
    return this.http.post<{ id: string }>('/stories', data);
  }

  resonate(data: ResonanceRequest) {
    return this.http.post<{ resonanceCount: number }>(
      `/stories/${data.storyId}/resonance`,
      { deviceId: data.deviceId },
    );
  }

  myStories() {
    return this.http.get<Story[]>('/stories/mine');
  }
}
