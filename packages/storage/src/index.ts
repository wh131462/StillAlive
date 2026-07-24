import type { CheckIn, DayKey, Draft, Media, Person, Post } from '@still-alive/types';

export interface StillAliveRepository {
  checkIn(dayKey: DayKey): Promise<CheckIn>;
  getCheckIn(dayKey: DayKey): Promise<CheckIn | null>;
  listCheckIns(): Promise<CheckIn[]>;
  createPost(post: Post, personIds?: string[]): Promise<void>;
  updatePost(post: Post, personIds?: string[]): Promise<void>;
  deletePost(postId: string): Promise<void>;
  listPersonIdsByPost(postId: string): Promise<string[]>;
  listPosts(): Promise<Post[]>;
  listPostsByDay(dayKey: DayKey): Promise<Post[]>;
  listPostsByPerson(personId: string): Promise<Post[]>;
  saveDraft(draft: Draft): Promise<void>;
  getDraft(dayKey: DayKey): Promise<Draft | null>;
  listMedia(): Promise<Media[]>;
  createMedia(media: Media): Promise<void>;
  deleteMedia(mediaId: string): Promise<void>;
  isMediaReferenced(mediaId: string): Promise<boolean>;
  listPeople(): Promise<Person[]>;
  createPerson(person: Person): Promise<void>;
  updatePerson(person: Person): Promise<void>;
  deletePerson(personId: string): Promise<void>;
  setPersonMemoryEnabled(personId: string, enabled: boolean): Promise<void>;
}
