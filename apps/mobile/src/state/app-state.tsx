import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { AppState as NativeAppState } from 'react-native';
import type { CheckIn, DayKey, Draft, Media, Person, Post } from '@still-alive/types';
import { toDayKey } from '@still-alive/core';
import { SQLiteStillAliveRepository } from '../data/sqlite-repository';
import type { BackupSnapshot } from '../data/sqlite-repository';
import type { AppPreferences, HomeMemory } from '../data/sqlite-repository';

const DEFAULT_PREFERENCES: AppPreferences = {
  onboardingCompleted: false,
  nickname: '',
  birthDate: '',
  globalMemoryEnabled: true,
  lastExportAt: null,
  lastExportPostCount: 0,
  backupReminderShownAt: null,
};

interface AppStateValue {
  today: DayKey;
  todayCheckIn: CheckIn | null;
  checkIns: CheckIn[];
  posts: Post[];
  people: Person[];
  media: Media[];
  homeMemory: HomeMemory | null;
  preferences: AppPreferences;
  shouldShowBackupReminder: boolean;
  ready: boolean;
  error: string | null;
  checkInToday(): Promise<void>;
  savePost(bodyMarkdown: string, personIds?: string[], dayKey?: DayKey): Promise<void>;
  updatePost(postId: string, bodyMarkdown: string, personIds?: string[]): Promise<void>;
  deletePost(postId: string): Promise<void>;
  getPersonIdsByPost(postId: string): Promise<string[]>;
  getPostsByPerson(personId: string): Promise<Post[]>;
  saveMedia(item: Media): Promise<void>;
  discardMedia(media: Media): Promise<void>;
  createPerson(name: string): Promise<Person>;
  updatePerson(personId: string, changes: Pick<Person, 'name' | 'avatarMediaId' | 'relationToMe' | 'impression'>): Promise<void>;
  deletePerson(personId: string): Promise<void>;
  setPersonMemoryEnabled(personId: string, enabled: boolean): Promise<void>;
  saveDraft(bodyMarkdown: string, dayKey?: DayKey): Promise<void>;
  loadDraft(dayKey?: DayKey): Promise<string>;
  createBackupSnapshot(): Promise<BackupSnapshot>;
  restoreBackupSnapshot(snapshot: BackupSnapshot): Promise<void>;
  updatePreferences(changes: Partial<AppPreferences>): Promise<void>;
  recordBackupExport(): Promise<void>;
  dismissBackupReminder(): Promise<void>;
  deleteAllLocalData(): Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const repository = useMemo(() => new SQLiteStillAliveRepository(database), [database]);
  const [today, setToday] = useState<DayKey>(() => toDayKey(new Date()));
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [homeMemory, setHomeMemory] = useState<HomeMemory | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toDayKey(new Date()));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    void Promise.all([repository.getCheckIn(today), repository.listCheckIns(), repository.listPosts(), repository.listPeople(), repository.listMedia(), repository.getHomeMemory(today), repository.getPreferences()])
      .then(([checkIn, storedCheckIns, storedPosts, storedPeople, storedMedia, memory, storedPreferences]) => {
        if (!active) return;
        setError(null);
        setTodayCheckIn(checkIn);
        setCheckIns(storedCheckIns);
        setPosts(storedPosts);
        setPeople(storedPeople);
        setMedia(storedMedia);
        setHomeMemory(memory);
        const hasExistingContent = storedCheckIns.length > 0 || storedPosts.length > 0;
        const effectivePreferences = hasExistingContent && !storedPreferences.onboardingCompleted
          ? { ...storedPreferences, onboardingCompleted: true }
          : storedPreferences;
        setPreferences(effectivePreferences);
        if (effectivePreferences.onboardingCompleted !== storedPreferences.onboardingCompleted) void repository.updatePreferences({ onboardingCompleted: true });
        if (memory) void repository.markMemoryShown(memory).catch(() => undefined);
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : '本地数据加载失败');
        setReady(true);
      });
    return () => { active = false; };
  }, [repository, today]);

  const checkInToday = useCallback(async () => {
    const checkIn = await repository.checkIn(today);
    setTodayCheckIn(checkIn);
    setCheckIns(await repository.listCheckIns());
  }, [repository, today]);

  const savePost = useCallback(async (bodyMarkdown: string, personIds: string[] = [], dayKey: DayKey = today) => {
    validatePost(bodyMarkdown, personIds);
    const now = new Date().toISOString();
    const post: Post = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      dayKey,
      bodyMarkdown,
      createdAt: now,
      updatedAt: now,
    };
    await repository.createPost(post, personIds);
    setPosts(await repository.listPosts());
    const memory = await repository.getHomeMemory(today);
    setHomeMemory(memory);
    if (memory) void repository.markMemoryShown(memory).catch(() => undefined);
  }, [repository, today]);

  const cleanupUnreferencedMedia = useCallback(async (mediaIds: string[], fallbackMedia: Media[] = []) => {
    const removable: string[] = [];
    for (const mediaId of new Set(mediaIds)) {
      if (await repository.isMediaReferenced(mediaId)) continue;
      const item = media.find((candidate) => candidate.id === mediaId) ?? fallbackMedia.find((candidate) => candidate.id === mediaId);
      if (item) {
        try {
          const file = new File(item.localPath);
          if (file.exists) file.delete();
        } catch {
          // 数据引用仍会被清理；系统不可访问的孤立文件不影响记录操作。
        }
      }
      await repository.deleteMedia(mediaId);
      removable.push(mediaId);
    }
    if (removable.length) setMedia((current) => current.filter((item) => !removable.includes(item.id)));
  }, [media, repository]);

  const updatePost = useCallback(async (postId: string, bodyMarkdown: string, personIds: string[] = []) => {
    validatePost(bodyMarkdown, personIds);
    const existing = posts.find((post) => post.id === postId);
    if (!existing) throw new Error('要编辑的日记不存在');
    const nextPost = { ...existing, bodyMarkdown, updatedAt: new Date().toISOString() };
    await repository.updatePost(nextPost, personIds);
    const storedPosts = await repository.listPosts();
    setPosts(storedPosts);
    const removedMediaIds = extractMediaIds(existing.bodyMarkdown).filter((id) => !extractMediaIds(bodyMarkdown).includes(id));
    await cleanupUnreferencedMedia(removedMediaIds);
  }, [cleanupUnreferencedMedia, posts, repository]);

  const deletePost = useCallback(async (postId: string) => {
    const existing = posts.find((post) => post.id === postId);
    if (!existing) return;
    await repository.deletePost(postId);
    setPosts(await repository.listPosts());
    setHomeMemory((current) => current?.post.id === postId ? null : current);
    await cleanupUnreferencedMedia(extractMediaIds(existing.bodyMarkdown));
  }, [cleanupUnreferencedMedia, posts, repository]);

  const getPersonIdsByPost = useCallback((postId: string) => repository.listPersonIdsByPost(postId), [repository]);

  const createPerson = useCallback(async (name: string) => {
    if (!name.trim()) throw new Error('人物名字不能为空');
    const now = new Date().toISOString();
    const person: Person = {
      id: `person_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      avatarMediaId: null,
      relationToMe: null,
      impression: null,
      memoryEnabled: true,
      createdAt: now,
      updatedAt: now,
    };
    await repository.createPerson(person);
    setPeople(await repository.listPeople());
    return person;
  }, [repository]);

  const setPersonMemoryEnabled = useCallback(async (personId: string, enabled: boolean) => {
    await repository.setPersonMemoryEnabled(personId, enabled);
    setPeople(await repository.listPeople());
    if (!enabled) setHomeMemory((current) => current?.kind === 'person' && current.person.id === personId ? null : current);
  }, [repository]);

  const updatePerson = useCallback(async (personId: string, changes: Pick<Person, 'name' | 'avatarMediaId' | 'relationToMe' | 'impression'>) => {
    if (!changes.name.trim()) throw new Error('人物名字不能为空');
    if ((changes.impression?.length ?? 0) > 100) throw new Error('一句话印象最多 100 字');
    const existing = people.find((person) => person.id === personId);
    if (!existing) throw new Error('要编辑的人物不存在');
    const previousAvatarId = existing.avatarMediaId;
    await repository.updatePerson({ ...existing, ...changes, name: changes.name.trim(), updatedAt: new Date().toISOString() });
    setPeople(await repository.listPeople());
    if (previousAvatarId && previousAvatarId !== changes.avatarMediaId) await cleanupUnreferencedMedia([previousAvatarId]);
  }, [cleanupUnreferencedMedia, people, repository]);

  const deletePerson = useCallback(async (personId: string) => {
    const existing = people.find((person) => person.id === personId);
    if (!existing) return;
    await repository.deletePerson(personId);
    setPeople(await repository.listPeople());
    if (existing.avatarMediaId) await cleanupUnreferencedMedia([existing.avatarMediaId]);
    setHomeMemory((current) => current?.kind === 'person' && current.person.id === personId ? null : current);
  }, [cleanupUnreferencedMedia, people, repository]);

  const getPostsByPerson = useCallback((personId: string) => repository.listPostsByPerson(personId), [repository]);

  const saveMedia = useCallback(async (item: Media) => {
    await repository.createMedia(item);
    setMedia((current) => [item, ...current]);
  }, [repository]);

  const discardMedia = useCallback((item: Media) => cleanupUnreferencedMedia([item.id], [item]), [cleanupUnreferencedMedia]);

  const saveDraft = useCallback(async (bodyMarkdown: string, dayKey: DayKey = today) => {
    const draft: Draft = {
      id: `draft_${dayKey}`,
      dayKey,
      bodyMarkdown,
      updatedAt: new Date().toISOString(),
    };
    await repository.saveDraft(draft);
  }, [repository, today]);

  const loadDraft = useCallback(async (dayKey: DayKey = today) => {
    const draft = await repository.getDraft(dayKey);
    return draft?.bodyMarkdown ?? '';
  }, [repository, today]);

  const createBackupSnapshot = useCallback(() => repository.exportBackupSnapshot(), [repository]);

  const updatePreferences = useCallback(async (changes: Partial<AppPreferences>) => {
    await repository.updatePreferences(changes);
    const stored = await repository.getPreferences();
    setPreferences(stored);
    if ('globalMemoryEnabled' in changes) {
      const memory = await repository.getHomeMemory(today);
      setHomeMemory(memory);
      if (memory) void repository.markMemoryShown(memory).catch(() => undefined);
    }
  }, [repository, today]);

  const recordBackupExport = useCallback(async () => {
    await updatePreferences({ lastExportAt: new Date().toISOString(), lastExportPostCount: posts.length, backupReminderShownAt: null });
  }, [posts.length, updatePreferences]);

  const dismissBackupReminder = useCallback(async () => {
    await updatePreferences({ backupReminderShownAt: new Date().toISOString() });
  }, [updatePreferences]);

  const restoreBackupSnapshot = useCallback(async (snapshot: BackupSnapshot) => {
    const oldMedia = media;
    await repository.replaceFromBackup(snapshot);
    const [checkIn, storedCheckIns, storedPosts, storedPeople, storedMedia, memory, storedPreferences] = await Promise.all([
      repository.getCheckIn(today),
      repository.listCheckIns(),
      repository.listPosts(),
      repository.listPeople(),
      repository.listMedia(),
      repository.getHomeMemory(today),
      repository.getPreferences(),
    ]);
    setTodayCheckIn(checkIn);
    setCheckIns(storedCheckIns);
    setPosts(storedPosts);
    setPeople(storedPeople);
    setMedia(storedMedia);
    setHomeMemory(memory);
    setPreferences(storedPreferences);
    if (memory) void repository.markMemoryShown(memory).catch(() => undefined);

    const restoredPaths = new Set(storedMedia.map((item) => item.localPath));
    for (const item of oldMedia) {
      if (restoredPaths.has(item.localPath)) continue;
      try {
        const file = new File(item.localPath);
        if (file.exists) file.delete();
      } catch {
        // 数据已经成功恢复；旧的孤立文件可在后续维护时再次清理。
      }
    }
  }, [media, repository, today]);

  const deleteAllLocalData = useCallback(async () => {
    const storedMedia = media;
    await repository.deleteAllData();
    setTodayCheckIn(null);
    setCheckIns([]);
    setPosts([]);
    setPeople([]);
    setMedia([]);
    setHomeMemory(null);
    setPreferences(DEFAULT_PREFERENCES);
    for (const item of storedMedia) {
      try {
        const file = new File(item.localPath);
        if (file.exists) file.delete();
      } catch {
        // 数据记录已经清除；无法访问的孤立文件不再被应用引用。
      }
    }
    try {
      for (const item of Paths.cache.list()) {
        if (item instanceof File && item.name.startsWith('still-alive-') && item.name.endsWith('.zip')) item.delete();
      }
      for (const item of Paths.document.list()) {
        if (item instanceof Directory && (item.name === 'media' || item.name.startsWith('media-restored-'))) item.delete();
      }
    } catch {
      // 已删除数据库引用；系统暂时占用的缓存目录可由系统后续回收。
    }
  }, [media, repository]);

  const shouldShowBackupReminder = useMemo(() => {
    if (posts.length < 7) return false;
    if (!preferences.lastExportAt) return !preferences.backupReminderShownAt;
    if (preferences.backupReminderShownAt && preferences.backupReminderShownAt > preferences.lastExportAt) return false;
    const olderThanThirtyDays = Date.now() - new Date(preferences.lastExportAt).getTime() > 30 * 24 * 60 * 60 * 1000;
    return olderThanThirtyDays && posts.length > preferences.lastExportPostCount;
  }, [posts.length, preferences]);

  const value = useMemo<AppStateValue>(() => ({
    today,
    todayCheckIn,
    checkIns,
    posts,
    people,
    media,
    homeMemory,
    preferences,
    shouldShowBackupReminder,
    ready,
    error,
    checkInToday,
    savePost,
    updatePost,
    deletePost,
    getPersonIdsByPost,
    getPostsByPerson,
    saveMedia,
    discardMedia,
    createPerson,
    updatePerson,
    deletePerson,
    setPersonMemoryEnabled,
    saveDraft,
    loadDraft,
    createBackupSnapshot,
    restoreBackupSnapshot,
    updatePreferences,
    recordBackupExport,
    dismissBackupReminder,
    deleteAllLocalData,
  }), [checkInToday, checkIns, createBackupSnapshot, createPerson, deleteAllLocalData, deletePerson, deletePost, discardMedia, dismissBackupReminder, error, getPersonIdsByPost, getPostsByPerson, homeMemory, loadDraft, media, people, posts, preferences, ready, recordBackupExport, restoreBackupSnapshot, saveDraft, saveMedia, savePost, setPersonMemoryEnabled, shouldShowBackupReminder, today, todayCheckIn, updatePerson, updatePost, updatePreferences]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

function extractMediaIds(markdown: string): string[] {
  return [...markdown.matchAll(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/g)].map((match) => match[1]);
}

function validatePost(bodyMarkdown: string, personIds: string[]): void {
  if (!bodyMarkdown.trim()) throw new Error('正文和图片至少需要保留一项');
  if (extractMediaIds(bodyMarkdown).length > 9) throw new Error('一篇日记最多包含 9 张图片');
  if (new Set(personIds).size > 10) throw new Error('一篇日记最多关联 10 个人物');
}
