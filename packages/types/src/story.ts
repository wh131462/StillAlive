export type StoryCategory =
  | 'accident'
  | 'illness'
  | 'mental'
  | 'nature'
  | 'other';

export type StoryStatus = 'pending' | 'approved' | 'rejected';

export interface Story {
  id: string;
  title: string | null;
  content: string;
  approximateDate: string | null;
  category: StoryCategory | null;
  hasSensitiveContent: boolean;
  resonanceCount: number;
  status: StoryStatus;
  createdAt: string;
  publishedAt: string | null;
}

export interface StoryWithAuthorContext extends Story {
  authorUserId: string | null;
  contactEmail: string | null;
}

export interface CreateStoryRequest {
  title?: string;
  content: string;
  approximateDate?: string;
  category?: StoryCategory;
  contactEmail?: string;
}

export interface ResonanceRequest {
  storyId: string;
  deviceId?: string;
}
