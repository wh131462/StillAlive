import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { AppState as NativeAppState, Linking } from 'react-native';
import type { AlbumMedia, Birthday, CheckIn, DayKey, Draft, Media, Person, PersonAlbum, PersonTagAssignment, Post, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import { toDayKey } from '@still-alive/core';
import { SQLiteStillAliveRepository } from '../data/sqlite-repository';
import type { BackupSnapshot } from '../data/sqlite-repository';
import type { AppPreferences, HomeMemory } from '../data/sqlite-repository';
import { cleanupOrphanedAlbumFiles, deletePersonAlbumDirectory } from '../data/local-media';
import { MBTI_TYPES, validateBirthday } from '../domain/person-profile';
import { cancelBirthdayNotifications, reconcileBirthdayNotifications } from '../domain/birthday-notifications';
import { cancelMemoryNotifications, reconcileMemoryNotifications } from '../domain/memory-notifications';
import { expoBirthdayNotificationAdapter, expoMemoryNotificationAdapter, initializeBirthdayNotificationChannel, initializeMemoryNotificationChannel } from '../data/expo-birthday-notifications';
import { extractEmbeddedMediaIds, extractImageMediaIds } from '../domain/embedded-media';
import { deletePasswordVaultStorage } from '../data/password-vault-storage';

const DEFAULT_PREFERENCES: AppPreferences = {
  onboardingCompleted: false,
  nickname: '',
  profileBio: '',
  profileSignature: '',
  profileGender: null,
  appearanceTheme: 'moss',
  selfNameStyle: 'fresh',
  friendNameStyle: 'journal',
  birthDate: '',
  birthDateCalendar: 'solar',
  birthDateIsLeapMonth: false,
  profileAvatarMediaId: null,
  profileMbti: '',
  profileCustomTagIds: [],
  globalMemoryEnabled: true,
  lastExportAt: null,
  lastExportPostCount: 0,
  backupReminderShownAt: null,
  birthdayNotificationsEnabled: false,
  birthdayReminderHour: 9,
  birthdayReminderMinute: 0,
  birthdayNotificationError: null,
  memoryNotificationsEnabled: false,
  memoryNotificationError: null,
};

interface AppStateValue {
  today: DayKey;
  todayCheckIn: CheckIn | null;
  checkIns: CheckIn[];
  posts: Post[];
  people: Person[];
  media: Media[];
  tagDefinitions: TagDefinition[];
  tagGroups: TagGroup[];
  tagSystemSettings: TagSystemSetting[];
  personTags: PersonTagAssignment[];
  albums: PersonAlbum[];
  albumMedia: AlbumMedia[];
  homeMemory: HomeMemory | null;
  preferences: AppPreferences;
  notificationPermission: 'granted' | 'denied' | 'undetermined';
  shouldShowBackupReminder: boolean;
  ready: boolean;
  error: string | null;
  checkInToday(city: string | null): Promise<void>;
  savePost(bodyMarkdown: string, personIds?: string[], dayKey?: DayKey, locationName?: string | null): Promise<void>;
  updatePost(postId: string, bodyMarkdown: string, personIds?: string[], locationName?: string | null): Promise<void>;
  deletePost(postId: string): Promise<void>;
  getPersonIdsByPost(postId: string): Promise<string[]>;
  getPostsByPerson(personId: string): Promise<Post[]>;
  saveMedia(item: Media): Promise<void>;
  replaceMedia(mediaId: string, replacement: Media): Promise<void>;
  discardMedia(media: Media): Promise<void>;
  createPerson(name: string): Promise<Person>;
  updatePerson(personId: string, changes: Pick<Person, 'name' | 'avatarMediaId' | 'gender' | 'relationToMe' | 'impression' | 'birthday'>, mbti?: string | null, customTagIds?: string[]): Promise<void>;
  deletePerson(personId: string): Promise<void>;
  setPersonMemoryEnabled(personId: string, enabled: boolean): Promise<void>;
  createTag(name: string, groupId?: string | null): Promise<TagDefinition>;
  renameTag(tagId: string, name: string): Promise<void>;
  deleteTag(tagId: string): Promise<void>;
  createTagGroup(name: string): Promise<TagGroup>;
  renameTagGroup(groupId: string, name: string): Promise<void>;
  deleteTagGroup(groupId: string): Promise<void>;
  countPeopleByTag(tagId: string): Promise<number>;
  updateTagSystems(settings: TagSystemSetting[]): Promise<void>;
  createAlbum(personId: string | null, name: string): Promise<PersonAlbum>;
  updateAlbum(albumId: string, changes: Partial<Pick<PersonAlbum, 'name' | 'coverMediaId' | 'sortOrder'>>): Promise<void>;
  deleteAlbum(albumId: string): Promise<void>;
  addPhotoToAlbum(albumId: string, item: Media): Promise<void>;
  reorderAlbumPhotos(albumId: string, orderedMediaIds: string[]): Promise<void>;
  removePhotoFromAlbum(albumId: string, mediaId: string): Promise<void>;
  saveDraft(bodyMarkdown: string, dayKey?: DayKey): Promise<void>;
  loadDraft(dayKey?: DayKey): Promise<Draft | null>;
  createBackupSnapshot(): Promise<BackupSnapshot>;
  restoreBackupSnapshot(snapshot: BackupSnapshot): Promise<void>;
  updatePreferences(changes: Partial<AppPreferences>): Promise<void>;
  setBirthdayNotificationsEnabled(enabled: boolean): Promise<void>;
  retryBirthdayNotifications(): Promise<void>;
  setMemoryNotificationsEnabled(enabled: boolean): Promise<void>;
  retryMemoryNotifications(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  recordBackupExport(): Promise<void>;
  dismissBackupReminder(): Promise<void>;
  deleteAllLocalData(): Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const repository = useMemo(() => new SQLiteStillAliveRepository(database), [database]);
  const databaseReadyRef = useRef(false);
  const [today, setToday] = useState<DayKey>(() => toDayKey(new Date()));
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [tagSystemSettings, setTagSystemSettings] = useState<TagSystemSetting[]>([]);
  const [personTags, setPersonTagsState] = useState<PersonTagAssignment[]>([]);
  const [albums, setAlbums] = useState<PersonAlbum[]>([]);
  const [albumMedia, setAlbumMedia] = useState<AlbumMedia[]>([]);
  const [homeMemory, setHomeMemory] = useState<HomeMemory | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncBirthdayNotifications = useCallback(async (storedPeople: Person[], storedPreferences: AppPreferences, requestPermission = false) => {
    try {
      await reconcileBirthdayNotifications(repository, expoBirthdayNotificationAdapter, storedPeople, storedPreferences.birthdayNotificationsEnabled, storedPreferences.birthdayReminderHour, storedPreferences.birthdayReminderMinute, requestPermission);
      const permission = await expoBirthdayNotificationAdapter.getPermission();
      setNotificationPermission(permission);
      if (storedPreferences.birthdayNotificationError) {
        await repository.updatePreferences({ birthdayNotificationError: null });
        setPreferences((current) => ({ ...current, birthdayNotificationError: null }));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '生日通知调度失败';
      setNotificationPermission(await expoBirthdayNotificationAdapter.getPermission());
      await repository.updatePreferences({ birthdayNotificationError: message });
      setPreferences((current) => ({ ...current, birthdayNotificationError: message }));
      throw cause;
    }
  }, [repository]);

  const syncMemoryNotifications = useCallback(async (storedPosts: Post[], storedPreferences: AppPreferences, requestPermission = false) => {
    try {
      await reconcileMemoryNotifications(repository, expoMemoryNotificationAdapter, storedPosts, storedPreferences.memoryNotificationsEnabled, requestPermission);
      setNotificationPermission(await expoMemoryNotificationAdapter.getPermission());
      if (storedPreferences.memoryNotificationError) {
        await repository.updatePreferences({ memoryNotificationError: null });
        setPreferences((current) => ({ ...current, memoryNotificationError: null }));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '回忆通知调度失败';
      setNotificationPermission(await expoMemoryNotificationAdapter.getPermission());
      await repository.updatePreferences({ memoryNotificationError: message });
      setPreferences((current) => ({ ...current, memoryNotificationError: message }));
      throw cause;
    }
  }, [repository]);

  useEffect(() => {
    void Promise.all([initializeBirthdayNotificationChannel(), initializeMemoryNotificationChannel()]).catch(() => undefined);
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active' && databaseReadyRef.current) {
        setToday(toDayKey(new Date()));
        void (async () => {
          const storedPeople = await repository.listPeople();
          const storedPosts = await repository.listPosts();
          const storedPreferences = await repository.getPreferences();
          await syncBirthdayNotifications(storedPeople, storedPreferences).catch(() => undefined);
          await syncMemoryNotifications(storedPosts, storedPreferences).catch(() => undefined);
        })().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [repository, syncBirthdayNotifications, syncMemoryNotifications]);

  useEffect(() => {
    let active = true;
    databaseReadyRef.current = false;
    setReady(false);
    void (async () => {
      const checkIn = await repository.getCheckIn(today);
      const storedCheckIns = await repository.listCheckIns();
      const storedPosts = await repository.listPosts();
      const storedPeople = await repository.listPeople();
      const storedMedia = await repository.listMedia();
      const memory = await repository.getHomeMemory(today);
      const storedPreferences = await repository.getPreferences();
      const storedTags = await repository.listTagDefinitions();
      const storedTagGroups = await repository.listTagGroups();
      const storedTagSystems = await repository.listTagSystemSettings();
      const storedPersonTags = await repository.listPersonTagAssignments();
      const storedAlbums = await repository.listAlbums();
      const storedAlbumMedia = await repository.listAlbumMedia();
      if (active) {
        setError(null);
        setTodayCheckIn(checkIn);
        setCheckIns(storedCheckIns);
        setPosts(storedPosts);
        setPeople(storedPeople);
        setMedia(storedMedia);
        setTagDefinitions(storedTags);
        setTagGroups(storedTagGroups);
        setTagSystemSettings(storedTagSystems);
        setPersonTagsState(storedPersonTags);
        setAlbums(storedAlbums);
        setAlbumMedia(storedAlbumMedia);
        try { cleanupOrphanedAlbumFiles(storedMedia); } catch { /* 不阻塞主数据加载 */ }
        setHomeMemory(memory);
        const hasExistingContent = storedCheckIns.length > 0 || storedPosts.length > 0;
        const effectivePreferences = hasExistingContent && !storedPreferences.onboardingCompleted
          ? { ...storedPreferences, onboardingCompleted: true }
          : storedPreferences;
        setPreferences(effectivePreferences);
        void (async () => {
          await syncBirthdayNotifications(storedPeople, effectivePreferences).catch(() => undefined);
          await syncMemoryNotifications(storedPosts, effectivePreferences).catch(() => undefined);
          if (memory) await repository.markMemoryShown(memory).catch(() => undefined);
          if (effectivePreferences.onboardingCompleted !== storedPreferences.onboardingCompleted) await repository.updatePreferences({ onboardingCompleted: true }).catch(() => undefined);
          setReady(true);
          databaseReadyRef.current = true;
        })().catch(() => {
          setReady(true);
          databaseReadyRef.current = true;
        });
      }
    })().catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : '本地数据加载失败');
        databaseReadyRef.current = true;
        setReady(true);
      });
    return () => { active = false; };
  }, [repository, syncBirthdayNotifications, syncMemoryNotifications, today]);

  const checkInToday = useCallback(async (city: string | null) => {
    if (city && city.length > 40) throw new Error('城市名称不能超过 40 字');
    const checkIn = await repository.checkIn(today, city);
    setTodayCheckIn(checkIn);
    setCheckIns(await repository.listCheckIns());
  }, [repository, today]);

  const savePost = useCallback(async (bodyMarkdown: string, personIds: string[] = [], dayKey: DayKey = today, locationName: string | null = null) => {
    validatePost(bodyMarkdown, personIds, locationName);
    const now = new Date().toISOString();
    const post: Post = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      dayKey,
      bodyMarkdown,
      locationName,
      createdAt: now,
      updatedAt: now,
    };
    await repository.createPost(post, personIds);
    const storedPosts = await repository.listPosts();
    setPosts(storedPosts);
    const memory = await repository.getHomeMemory(today);
    setHomeMemory(memory);
    if (memory) void repository.markMemoryShown(memory).catch(() => undefined);
    void syncMemoryNotifications(storedPosts, await repository.getPreferences()).catch(() => undefined);
  }, [repository, syncMemoryNotifications, today]);

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

  const updatePost = useCallback(async (postId: string, bodyMarkdown: string, personIds: string[] = [], locationName: string | null = null) => {
    validatePost(bodyMarkdown, personIds, locationName);
    const existing = posts.find((post) => post.id === postId);
    if (!existing) throw new Error('要编辑的日记不存在');
    const nextPost = { ...existing, bodyMarkdown, locationName, updatedAt: new Date().toISOString() };
    await repository.updatePost(nextPost, personIds);
    const storedPosts = await repository.listPosts();
    setPosts(storedPosts);
    const nextMediaIds = new Set(extractEmbeddedMediaIds(bodyMarkdown));
    const removedMediaIds = extractEmbeddedMediaIds(existing.bodyMarkdown).filter((id) => !nextMediaIds.has(id));
    await cleanupUnreferencedMedia(removedMediaIds);
  }, [cleanupUnreferencedMedia, posts, repository]);

  const deletePost = useCallback(async (postId: string) => {
    const existing = posts.find((post) => post.id === postId);
    if (!existing) return;
    await cancelMemoryNotifications(repository, expoMemoryNotificationAdapter, postId);
    await repository.deletePost(postId);
    const storedPosts = await repository.listPosts();
    setPosts(storedPosts);
    setHomeMemory((current) => current?.post.id === postId ? null : current);
    await cleanupUnreferencedMedia(extractEmbeddedMediaIds(existing.bodyMarkdown));
    void syncMemoryNotifications(storedPosts, await repository.getPreferences()).catch(() => undefined);
  }, [cleanupUnreferencedMedia, posts, repository, syncMemoryNotifications]);

  const getPersonIdsByPost = useCallback((postId: string) => repository.listPersonIdsByPost(postId), [repository]);

  const createPerson = useCallback(async (name: string) => {
    if (!name.trim()) throw new Error('人物名字不能为空');
    const now = new Date().toISOString();
    const person: Person = {
      id: `person_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      avatarMediaId: null,
      gender: null,
      relationToMe: null,
      impression: null,
      birthday: null,
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

  const updatePerson = useCallback(async (personId: string, changes: Pick<Person, 'name' | 'avatarMediaId' | 'gender' | 'relationToMe' | 'impression' | 'birthday'>, mbti?: string | null, customTagIds?: string[]) => {
    if (!changes.name.trim()) throw new Error('人物名字不能为空');
    if ((changes.impression?.length ?? 0) > 100) throw new Error('一句话印象最多 100 字');
    const existing = people.find((person) => person.id === personId);
    if (!existing) throw new Error('要编辑的人物不存在');
    if (changes.birthday) validateBirthday(changes.birthday);
    if (mbti && !MBTI_TYPES.includes(mbti as typeof MBTI_TYPES[number])) throw new Error('MBTI 类型无效');
    const previousAvatarId = existing.avatarMediaId;
    await repository.updatePerson({ ...existing, ...changes, name: changes.name.trim(), updatedAt: new Date().toISOString() });
    if (mbti !== undefined || customTagIds !== undefined) await repository.setPersonTags(personId, mbti ?? null, customTagIds ?? []);
    const storedPeople = await repository.listPeople();
    setPeople(storedPeople);
    setPersonTagsState(await repository.listPersonTagAssignments());
    void syncBirthdayNotifications(storedPeople, await repository.getPreferences()).catch(() => undefined);
    if (previousAvatarId && previousAvatarId !== changes.avatarMediaId) await cleanupUnreferencedMedia([previousAvatarId]);
  }, [cleanupUnreferencedMedia, people, repository, syncBirthdayNotifications]);

  const deletePerson = useCallback(async (personId: string) => {
    const existing = people.find((person) => person.id === personId);
    if (!existing) return;
    const albumPhotoIds = albumMedia.filter((relation) => albums.some((album) => album.id === relation.albumId && album.personId === personId)).map((relation) => relation.mediaId);
    const albumPhotos = media.filter((item) => albumPhotoIds.includes(item.id));
    await cancelBirthdayNotifications(repository, expoBirthdayNotificationAdapter, personId);
    await repository.deletePerson(personId);
    const storedPeople = await repository.listPeople();
    setPeople(storedPeople);
    if (existing.avatarMediaId) await cleanupUnreferencedMedia([existing.avatarMediaId]);
    for (const item of albumPhotos) {
      await repository.deleteMedia(item.id);
      try { const file = new File(item.localPath); if (file.exists) file.delete(); } catch { /* 数据记录已删除 */ }
    }
    try { deletePersonAlbumDirectory(personId); } catch { /* 数据记录已删除 */ }
    setAlbums(await repository.listAlbums());
    setAlbumMedia(await repository.listAlbumMedia());
    setPersonTagsState(await repository.listPersonTagAssignments());
    setMedia(await repository.listMedia());
    setHomeMemory((current) => current?.kind === 'person' && current.person.id === personId ? null : current);
    void syncBirthdayNotifications(storedPeople, await repository.getPreferences()).catch(() => undefined);
  }, [albumMedia, albums, cleanupUnreferencedMedia, media, people, repository, syncBirthdayNotifications]);

  const createTag = useCallback(async (name: string, groupId: string | null = null) => {
    const normalizedName = normalizeTagName(name);
    if (groupId && !tagGroups.some((group) => group.id === groupId)) throw new Error('标签组不存在');
    const now = new Date().toISOString();
    const tag: TagDefinition = { id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), normalizedName: groupId ? `${groupId}:${normalizedName}` : normalizedName, groupId, createdAt: now, updatedAt: now };
    await repository.createTagDefinition(tag);
    setTagDefinitions(await repository.listTagDefinitions());
    return tag;
  }, [repository, tagGroups]);

  const renameTag = useCallback(async (tagId: string, name: string) => {
    const tag = tagDefinitions.find((item) => item.id === tagId);
    if (!tag) throw new Error('标签不存在');
    const normalizedName = normalizeTagName(name);
    await repository.updateTagDefinition({ ...tag, name: name.trim(), normalizedName: tag.groupId ? `${tag.groupId}:${normalizedName}` : normalizedName, updatedAt: new Date().toISOString() });
    setTagDefinitions(await repository.listTagDefinitions());
  }, [repository, tagDefinitions]);

  const deleteTag = useCallback(async (tagId: string) => {
    await repository.deleteTagDefinition(tagId);
    const storedPreferences = await repository.getPreferences();
    if (storedPreferences.profileCustomTagIds.includes(tagId)) await repository.updatePreferences({ profileCustomTagIds: storedPreferences.profileCustomTagIds.filter((id) => id !== tagId) });
    setPreferences(await repository.getPreferences());
    setTagDefinitions(await repository.listTagDefinitions());
    setPersonTagsState(await repository.listPersonTagAssignments());
  }, [repository]);

  const createTagGroup = useCallback(async (name: string) => {
    const normalizedName = normalizeTagName(name);
    if (tagGroups.some((group) => group.name.toLocaleLowerCase() === normalizedName)) throw new Error('标签组名称已存在');
    const now = new Date().toISOString();
    const group: TagGroup = { id: `tag_group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), kind: 'group', createdAt: now, updatedAt: now };
    await repository.createTagGroup(group);
    setTagGroups(await repository.listTagGroups());
    return group;
  }, [repository, tagGroups]);

  const renameTagGroup = useCallback(async (groupId: string, name: string) => {
    const group = tagGroups.find((item) => item.id === groupId);
    if (!group) throw new Error('标签组不存在');
    normalizeTagName(name);
    await repository.updateTagGroup({ ...group, name: name.trim(), updatedAt: new Date().toISOString() });
    setTagGroups(await repository.listTagGroups());
  }, [repository, tagGroups]);

  const deleteTagGroup = useCallback(async (groupId: string) => {
    const optionIds = tagDefinitions.filter((tag) => tag.groupId === groupId).map((tag) => tag.id);
    await repository.deleteTagGroup(groupId);
    const storedPreferences = await repository.getPreferences();
    if (storedPreferences.profileCustomTagIds.some((id) => optionIds.includes(id))) await repository.updatePreferences({ profileCustomTagIds: storedPreferences.profileCustomTagIds.filter((id) => !optionIds.includes(id)) });
    setPreferences(await repository.getPreferences());
    setTagGroups(await repository.listTagGroups());
    setTagDefinitions(await repository.listTagDefinitions());
    setPersonTagsState(await repository.listPersonTagAssignments());
  }, [repository, tagDefinitions]);

  const countPeopleByTag = useCallback((tagId: string) => repository.countPeopleByTag(tagId), [repository]);

  const updateTagSystems = useCallback(async (settings: TagSystemSetting[]) => {
    await repository.updateTagSystemSettings(settings);
    setTagSystemSettings(await repository.listTagSystemSettings());
  }, [repository]);

  const createAlbum = useCallback(async (personId: string | null, name: string) => {
    const normalized = name.trim();
    if (!normalized || normalized.length > 40) throw new Error('相册名称需为 1—40 字');
    const now = new Date().toISOString();
    const album: PersonAlbum = { id: `album_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, personId, name: normalized, coverMediaId: null, sortOrder: albums.filter((item) => item.personId === personId).length, createdAt: now, updatedAt: now };
    await repository.createAlbum(album);
    try {
      const directory = personId
        ? new Directory(Paths.document, 'people', personId, 'albums', album.id)
        : new Directory(Paths.document, 'self', 'albums', album.id);
      directory.create({ idempotent: true, intermediates: true });
    } catch (cause) {
      await repository.deleteAlbum(album.id);
      throw cause;
    }
    setAlbums(await repository.listAlbums());
    return album;
  }, [albums, repository]);

  const updateAlbum = useCallback(async (albumId: string, changes: Partial<Pick<PersonAlbum, 'name' | 'coverMediaId' | 'sortOrder'>>) => {
    const album = albums.find((item) => item.id === albumId);
    if (!album) throw new Error('相册不存在');
    const name = changes.name?.trim() ?? album.name;
    if (!name || name.length > 40) throw new Error('相册名称需为 1—40 字');
    await repository.updateAlbum({ ...album, ...changes, name, updatedAt: new Date().toISOString() });
    setAlbums(await repository.listAlbums());
  }, [albums, repository]);

  const deleteAlbum = useCallback(async (albumId: string) => {
    const album = albums.find((item) => item.id === albumId);
    if (!album) return;
    const ids = albumMedia.filter((item) => item.albumId === albumId).map((item) => item.mediaId);
    const files = media.filter((item) => ids.includes(item.id));
    await repository.deleteAlbum(albumId);
    for (const item of files) try { const file = new File(item.localPath); if (file.exists) file.delete(); } catch { /* 数据记录已删除 */ }
    try { deletePersonAlbumDirectory(album.personId, album.id); } catch { /* 数据记录已删除 */ }
    setAlbums(await repository.listAlbums());
    setAlbumMedia(await repository.listAlbumMedia());
    setMedia(await repository.listMedia());
  }, [albumMedia, albums, media, repository]);

  const addPhotoToAlbum = useCallback(async (albumId: string, item: Media) => {
    const sortOrder = albumMedia.filter((relation) => relation.albumId === albumId).length;
    await repository.addAlbumMedia({ albumId, mediaId: item.id, sortOrder, addedAt: new Date().toISOString() }, item);
    setMedia(await repository.listMedia());
    setAlbumMedia(await repository.listAlbumMedia());
  }, [albumMedia, repository]);

  const reorderAlbumPhotos = useCallback(async (albumId: string, orderedMediaIds: string[]) => {
    const current = albumMedia.filter((item) => item.albumId === albumId);
    if (new Set(orderedMediaIds).size !== current.length || current.some((item) => !orderedMediaIds.includes(item.mediaId))) throw new Error('照片排序数据无效');
    await repository.updateAlbumMedia(albumId, orderedMediaIds.map((mediaId, sortOrder) => ({ albumId, mediaId, sortOrder, addedAt: current.find((item) => item.mediaId === mediaId)?.addedAt ?? new Date().toISOString() })));
    setAlbumMedia(await repository.listAlbumMedia());
  }, [albumMedia, repository]);

  const removePhotoFromAlbum = useCallback(async (albumId: string, mediaId: string) => {
    const item = media.find((candidate) => candidate.id === mediaId);
    await repository.removeAlbumMedia(albumId, mediaId);
    if (item) try { const file = new File(item.localPath); if (file.exists) file.delete(); } catch { /* 数据记录已删除 */ }
    const storedAlbumMedia = await repository.listAlbumMedia();
    const album = albums.find((candidate) => candidate.id === albumId);
    if (album?.coverMediaId === mediaId) await repository.updateAlbum({ ...album, coverMediaId: storedAlbumMedia.find((relation) => relation.albumId === albumId)?.mediaId ?? null, updatedAt: new Date().toISOString() });
    setAlbums(await repository.listAlbums());
    setAlbumMedia(storedAlbumMedia);
    setMedia(await repository.listMedia());
  }, [albums, media, repository]);

  const getPostsByPerson = useCallback((personId: string) => repository.listPostsByPerson(personId), [repository]);

  const saveMedia = useCallback(async (item: Media) => {
    await repository.createMedia(item);
    setMedia((current) => [item, ...current]);
  }, [repository]);

  const replaceMedia = useCallback(async (mediaId: string, replacement: Media) => {
    const existing = media.find((item) => item.id === mediaId);
    if (!existing) {
      try { const file = new File(replacement.localPath); if (file.exists) file.delete(); } catch { /* 新文件尚未进入数据层 */ }
      throw new Error('要替换的图片不存在');
    }
    const next = { ...replacement, id: mediaId };
    try {
      await repository.updateMedia(next);
    } catch (cause) {
      try { const file = new File(replacement.localPath); if (file.exists) file.delete(); } catch { /* 不覆盖原始错误 */ }
      throw cause;
    }
    setMedia((current) => current.map((item) => item.id === mediaId ? next : item));
    if (existing.localPath !== next.localPath) {
      try { const file = new File(existing.localPath); if (file.exists) file.delete(); } catch { /* 数据已指向新文件 */ }
    }
  }, [media, repository]);

  const discardMedia = useCallback((item: Media) => cleanupUnreferencedMedia([item.id], [item]), [cleanupUnreferencedMedia]);

  const saveDraft = useCallback(async (bodyMarkdown: string, dayKey: DayKey = today) => {
    const existing = await repository.getDraft(dayKey);
    const draft: Draft = {
      id: `draft_${dayKey}`,
      dayKey,
      bodyMarkdown,
      updatedAt: new Date().toISOString(),
    };
    await repository.saveDraft(draft);
    if (existing) {
      const nextMediaIds = new Set(extractEmbeddedMediaIds(bodyMarkdown));
      const removedMediaIds = extractEmbeddedMediaIds(existing.bodyMarkdown).filter((id) => !nextMediaIds.has(id));
      await cleanupUnreferencedMedia(removedMediaIds);
    }
  }, [cleanupUnreferencedMedia, repository, today]);

  const loadDraft = useCallback(async (dayKey: DayKey = today) => {
    return repository.getDraft(dayKey);
  }, [repository, today]);

  const createBackupSnapshot = useCallback(() => repository.exportBackupSnapshot(), [repository]);

  const updatePreferences = useCallback(async (changes: Partial<AppPreferences>) => {
    await repository.updatePreferences(changes);
    const stored = await repository.getPreferences();
    setPreferences(stored);
    if ('birthdayNotificationsEnabled' in changes || 'birthdayReminderHour' in changes || 'birthdayReminderMinute' in changes) await syncBirthdayNotifications(people, stored, changes.birthdayNotificationsEnabled === true);
    if ('memoryNotificationsEnabled' in changes) await syncMemoryNotifications(posts, stored, changes.memoryNotificationsEnabled === true);
    if ('globalMemoryEnabled' in changes) {
      const memory = await repository.getHomeMemory(today);
      setHomeMemory(memory);
      if (memory) void repository.markMemoryShown(memory).catch(() => undefined);
    }
  }, [people, posts, repository, syncBirthdayNotifications, syncMemoryNotifications, today]);

  const setBirthdayNotificationsEnabled = useCallback(async (enabled: boolean) => {
    await repository.updatePreferences({ birthdayNotificationsEnabled: enabled });
    const stored = await repository.getPreferences();
    setPreferences(stored);
    await syncBirthdayNotifications(people, stored, enabled);
  }, [people, repository, syncBirthdayNotifications]);

  const retryBirthdayNotifications = useCallback(async () => {
    const stored = await repository.getPreferences();
    await syncBirthdayNotifications(await repository.listPeople(), stored, false);
  }, [repository, syncBirthdayNotifications]);

  const setMemoryNotificationsEnabled = useCallback(async (enabled: boolean) => {
    await repository.updatePreferences({ memoryNotificationsEnabled: enabled });
    const stored = await repository.getPreferences();
    setPreferences(stored);
    await syncMemoryNotifications(posts, stored, enabled);
  }, [posts, repository, syncMemoryNotifications]);

  const retryMemoryNotifications = useCallback(async () => {
    const stored = await repository.getPreferences();
    await syncMemoryNotifications(await repository.listPosts(), stored, false);
  }, [repository, syncMemoryNotifications]);

  const openNotificationSettings = useCallback(() => Linking.openSettings(), []);

  const recordBackupExport = useCallback(async () => {
    await updatePreferences({ lastExportAt: new Date().toISOString(), lastExportPostCount: posts.length, backupReminderShownAt: null });
  }, [posts.length, updatePreferences]);

  const dismissBackupReminder = useCallback(async () => {
    await updatePreferences({ backupReminderShownAt: new Date().toISOString() });
  }, [updatePreferences]);

  const restoreBackupSnapshot = useCallback(async (snapshot: BackupSnapshot) => {
    const oldMedia = media;
    const oldPeople = people;
    const oldPosts = posts;
    const oldPreferences = preferences;
    await cancelBirthdayNotifications(repository, expoBirthdayNotificationAdapter);
    await cancelMemoryNotifications(repository, expoMemoryNotificationAdapter);
    try {
      await repository.replaceFromBackup(snapshot);
    } catch (cause) {
      void syncBirthdayNotifications(oldPeople, oldPreferences).catch(() => undefined);
      void syncMemoryNotifications(oldPosts, oldPreferences).catch(() => undefined);
      throw cause;
    }
    const [checkIn, storedCheckIns, storedPosts, storedPeople, storedMedia, memory, storedPreferences, storedTags, storedTagGroups, storedTagSystems, storedPersonTags, storedAlbums, storedAlbumMedia] = await Promise.all([
      repository.getCheckIn(today),
      repository.listCheckIns(),
      repository.listPosts(),
      repository.listPeople(),
      repository.listMedia(),
      repository.getHomeMemory(today),
      repository.getPreferences(),
      repository.listTagDefinitions(),
      repository.listTagGroups(),
      repository.listTagSystemSettings(),
      repository.listPersonTagAssignments(),
      repository.listAlbums(),
      repository.listAlbumMedia(),
    ]);
    setTodayCheckIn(checkIn);
    setCheckIns(storedCheckIns);
    setPosts(storedPosts);
    setPeople(storedPeople);
    setMedia(storedMedia);
    setHomeMemory(memory);
    setPreferences(storedPreferences);
    setTagDefinitions(storedTags);
    setTagGroups(storedTagGroups);
    setTagSystemSettings(storedTagSystems);
    setPersonTagsState(storedPersonTags);
    setAlbums(storedAlbums);
    setAlbumMedia(storedAlbumMedia);
    if (memory) void repository.markMemoryShown(memory).catch(() => undefined);
    void syncBirthdayNotifications(storedPeople, storedPreferences).catch(() => undefined);
    void syncMemoryNotifications(storedPosts, storedPreferences).catch(() => undefined);

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
  }, [media, people, posts, preferences, repository, syncBirthdayNotifications, syncMemoryNotifications, today]);

  const deleteAllLocalData = useCallback(async () => {
    const storedMedia = media;
    await cancelBirthdayNotifications(repository, expoBirthdayNotificationAdapter);
    await cancelMemoryNotifications(repository, expoMemoryNotificationAdapter);
    const failures: unknown[] = [];
    let vaultDeleted = false;
    try {
      await deletePasswordVaultStorage();
      vaultDeleted = true;
    } catch (cause) {
      failures.push(cause);
    }
    let dataDeleted = false;
    try {
      await repository.deleteAllData();
      dataDeleted = true;
    } catch (cause) {
      failures.push(cause);
    }
    if (!dataDeleted) throw new Error(vaultDeleted ? '密码本已删除，但日记数据删除失败，请重试' : '密码本和日记数据删除失败，请重试');
    setTodayCheckIn(null);
    setCheckIns([]);
    setPosts([]);
    setPeople([]);
    setMedia([]);
    setTagDefinitions([]);
    setTagGroups([]);
    setTagSystemSettings([]);
    setPersonTagsState([]);
    setAlbums([]);
    setAlbumMedia([]);
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
        if (item instanceof Directory && (item.name === 'media' || item.name === 'people' || item.name === 'self' || item.name.startsWith('media-restored-'))) item.delete();
      }
    } catch {
      // 已删除数据库引用；系统暂时占用的缓存目录可由系统后续回收。
    }
    if (failures.length) throw new Error('日记数据已删除，但密码本清理失败，请重试删除全部本地数据');
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
    tagDefinitions,
    tagGroups,
    tagSystemSettings,
    personTags,
    albums,
    albumMedia,
    homeMemory,
    preferences,
    notificationPermission,
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
    replaceMedia,
    discardMedia,
    createPerson,
    updatePerson,
    deletePerson,
    setPersonMemoryEnabled,
    createTag,
    renameTag,
    deleteTag,
    createTagGroup,
    renameTagGroup,
    deleteTagGroup,
    countPeopleByTag,
    updateTagSystems,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    addPhotoToAlbum,
    reorderAlbumPhotos,
    removePhotoFromAlbum,
    saveDraft,
    loadDraft,
    createBackupSnapshot,
    restoreBackupSnapshot,
    updatePreferences,
    setBirthdayNotificationsEnabled,
    retryBirthdayNotifications,
    setMemoryNotificationsEnabled,
    retryMemoryNotifications,
    openNotificationSettings,
    recordBackupExport,
    dismissBackupReminder,
    deleteAllLocalData,
  }), [addPhotoToAlbum, albumMedia, albums, checkInToday, checkIns, countPeopleByTag, createAlbum, createBackupSnapshot, createPerson, createTag, createTagGroup, deleteAlbum, deleteAllLocalData, deletePerson, deletePost, deleteTag, deleteTagGroup, discardMedia, dismissBackupReminder, error, getPersonIdsByPost, getPostsByPerson, homeMemory, loadDraft, media, notificationPermission, openNotificationSettings, people, personTags, posts, preferences, ready, recordBackupExport, removePhotoFromAlbum, renameTag, renameTagGroup, reorderAlbumPhotos, replaceMedia, restoreBackupSnapshot, retryBirthdayNotifications, retryMemoryNotifications, saveDraft, saveMedia, savePost, setBirthdayNotificationsEnabled, setMemoryNotificationsEnabled, setPersonMemoryEnabled, shouldShowBackupReminder, tagDefinitions, tagGroups, tagSystemSettings, today, todayCheckIn, updateAlbum, updatePerson, updatePost, updatePreferences, updateTagSystems]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

function validatePost(bodyMarkdown: string, personIds: string[], locationName: string | null): void {
  if (!bodyMarkdown.trim()) throw new Error('正文、图片或语音至少需要保留一项');
  if (extractImageMediaIds(bodyMarkdown).length > 9) throw new Error('一篇日记最多包含 9 张图片');
  if (new Set(personIds).size > 10) throw new Error('一篇日记最多关联 10 个人物');
  if (locationName && locationName.length > 80) throw new Error('地点名称不能超过 80 字');
}

function normalizeTagName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 24) throw new Error('标签文字需为 1—24 字');
  return trimmed.toLocaleLowerCase();
}
