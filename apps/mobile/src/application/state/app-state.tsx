import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { AppState as NativeAppState, Linking } from 'react-native';
import type { AlbumMedia, Book, BookExcerpt, Birthday, CheckIn, DayKey, Draft, Media, MusicCollectionEntry, MusicPlaylist, MusicPlaylistEntry, MusicTrack, Person, PersonAlbum, PersonBook, PersonTagAssignment, Post, ProfileCollectionRequest, ReadingNoteSource, TagDefinition, TagGroup, TagSystemSetting } from '@still-alive/types';
import { toDayKey } from '../../shared/core/day-key';
import { SQLiteStillAliveRepository } from '../../infrastructure/database/sqlite-repository';
import type { AppPreferences, BackupSnapshot, HomeMemory } from '../../infrastructure/database/database-models';
import { cleanupOrphanedAlbumFiles, deletePersonAlbumDirectory } from '../../infrastructure/files/local-media';
import { extractEmbeddedMusicCover } from '../../infrastructure/files/music-cover-metadata';
import { MBTI_TYPES, validateBirthday } from '../../features/people/person-profile';
import { cancelBirthdayNotifications } from '../../features/people/birthday-notifications';
import { cancelMemoryNotifications } from '../../features/home/memory-notifications';
import { expoBirthdayNotificationAdapter, expoMemoryNotificationAdapter, initializeBirthdayNotificationChannel, initializeMemoryNotificationChannel, requestNotificationPermission } from '../../infrastructure/notifications/expo-notifications';
import { getPersistentNotificationStatus, persistentNotificationSupported, refreshPersistentNotification, setPersistentNotificationEnabled } from '../../infrastructure/notifications/android-persistent-notification';
import { extractEmbeddedMediaIds } from '../../features/journal/embedded-media';
import { importEncryptedMusicTrack, isEncryptedMusicName } from '../../features/music/music-import-coordinator';
import { deletePasswordVaultStorage } from '../../features/vault/password-vault-storage';
import { deleteProfileCollectionPrivateKey, deleteProfileCollectionPrivateKeys, saveProfileCollectionPrivateKey } from '../../features/profile-collection/profile-collection-key-storage';
import type { AppStateValue } from './app-state.types';
import { DEFAULT_PREFERENCES } from './default-preferences';
import { normalizeTagName, validatePost } from './app-state-validation';
import { useNotificationSync } from './use-notification-sync';

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
  const [personBooks, setPersonBooksState] = useState<PersonBook[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicCollectionEntries, setMusicCollectionEntries] = useState<MusicCollectionEntry[]>([]);
  const [musicPlaylists, setMusicPlaylists] = useState<MusicPlaylist[]>([]);
  const [musicPlaylistEntries, setMusicPlaylistEntries] = useState<MusicPlaylistEntry[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookExcerpts, setBookExcerpts] = useState<BookExcerpt[]>([]);
  const [readingNoteSources, setReadingNoteSources] = useState<ReadingNoteSource[]>([]);
  const [homeMemory, setHomeMemory] = useState<HomeMemory | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [persistentNotificationRunning, setPersistentNotificationRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { syncBirthdayNotifications, syncMemoryNotifications } = useNotificationSync(repository, setPreferences, setNotificationPermission);

  const cleanupExpiredProfileCollectionRequests = useCallback(async () => {
    const requestIds = await repository.deleteExpiredProfileCollectionRequests(new Date().toISOString());
    await deleteProfileCollectionPrivateKeys(requestIds);
  }, [repository]);

  useEffect(() => {
    void Promise.all([initializeBirthdayNotificationChannel(), initializeMemoryNotificationChannel()]).catch(() => undefined);
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active' && databaseReadyRef.current) {
        const activeToday = toDayKey(new Date());
        setToday(activeToday);
        void (async () => {
          await cleanupExpiredProfileCollectionRequests().catch(() => undefined);
          const [checkIn, storedCheckIns, storedPeople, storedPosts, storedPreferences] = await Promise.all([
            repository.getCheckIn(activeToday),
            repository.listCheckIns(),
            repository.listPeople(),
            repository.listPosts(),
            repository.getPreferences(),
          ]);
          setTodayCheckIn(checkIn);
          setCheckIns(storedCheckIns);
          setPosts(storedPosts);
          await syncBirthdayNotifications(storedPeople, storedPreferences).catch(() => undefined);
          await syncMemoryNotifications(storedPosts, storedPreferences).catch(() => undefined);
          if (storedPreferences.persistentNotificationEnabled) await refreshPersistentNotification().catch(() => undefined);
          setPersistentNotificationRunning((await getPersistentNotificationStatus()).running);
        })().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [cleanupExpiredProfileCollectionRequests, repository, syncBirthdayNotifications, syncMemoryNotifications]);

  useEffect(() => {
    let active = true;
    databaseReadyRef.current = false;
    setReady(false);
    void (async () => {
      await cleanupExpiredProfileCollectionRequests().catch(() => undefined);
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
      const storedPersonBooks = await repository.listPersonBooks();
      const storedMusicTracks = await repository.listMusicTracks();
      const storedMusicCollectionEntries = await repository.listMusicCollectionEntries();
      const storedMusicPlaylists = await repository.listMusicPlaylists();
      const storedMusicPlaylistEntries = await repository.listMusicPlaylistEntries();
      const storedBooks = await repository.listBooks();
      const storedBookExcerpts = await repository.listBookExcerpts();
      const storedReadingNoteSources = await repository.listReadingNoteSources();
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
        setPersonBooksState(storedPersonBooks);
        setMusicTracks(storedMusicTracks);
        setMusicCollectionEntries(storedMusicCollectionEntries);
        setMusicPlaylists(storedMusicPlaylists);
        setMusicPlaylistEntries(storedMusicPlaylistEntries);
        setBooks(storedBooks);
        setBookExcerpts(storedBookExcerpts);
        setReadingNoteSources(storedReadingNoteSources);
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
  }, [cleanupExpiredProfileCollectionRequests, repository, syncBirthdayNotifications, syncMemoryNotifications, today]);

  useEffect(() => {
    if (!ready || !persistentNotificationSupported) return;
    void setPersistentNotificationEnabled(preferences.persistentNotificationEnabled)
      .then(() => getPersistentNotificationStatus())
      .then((status) => setPersistentNotificationRunning(status.running))
      .catch(() => setPersistentNotificationRunning(false));
  }, [preferences.persistentNotificationEnabled, ready]);

  useEffect(() => {
    if (!ready || !preferences.persistentNotificationEnabled) return;
    void refreshPersistentNotification().catch(() => undefined);
  }, [checkIns, posts, preferences.persistentNotificationEnabled, ready, today]);

  const checkInToday = useCallback(async () => {
    const checkIn = await repository.checkIn(today);
    setTodayCheckIn(checkIn);
    setCheckIns(await repository.listCheckIns());
    return checkIn;
  }, [repository, today]);

  const updateCheckInCity = useCallback(async (checkInId: string, city: string) => {
    if (!city || city.length > 40) throw new Error('城市名称必须为 1–40 字');
    await repository.updateCheckInCity(checkInId, city);
    setTodayCheckIn((current) => current?.id === checkInId ? { ...current, city } : current);
    setCheckIns((current) => current.map((item) => item.id === checkInId ? { ...item, city } : item));
  }, [repository]);

  const savePost = useCallback(async (bodyMarkdown: string, personIds: string[] = [], dayKey: DayKey = today, locationName: string | null = null): Promise<Post> => {
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
    return post;
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
    setReadingNoteSources((current) => current.filter((source) => source.postId !== postId));
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

  const setPersonBooks = useCallback(async (personId: string, bookIds: string[]) => {
    if (!people.some((person) => person.id === personId)) throw new Error('人物不存在或已删除');
    const availableBookIds = new Set(books.map((book) => book.id));
    const nextBookIds = [...new Set(bookIds)].filter((bookId) => availableBookIds.has(bookId));
    await repository.setPersonBooks(personId, nextBookIds);
    setPersonBooksState(await repository.listPersonBooks());
  }, [books, people, repository]);

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

  const createProfileCollectionRequest = useCallback(async (request: ProfileCollectionRequest, privateKeyJwk: string) => {
    await saveProfileCollectionPrivateKey(request.id, privateKeyJwk);
    try {
      await repository.createProfileCollectionRequest(request);
    } catch (cause) {
      await deleteProfileCollectionPrivateKey(request.id).catch(() => undefined);
      throw cause;
    }
  }, [repository]);

  const getProfileCollectionRequest = useCallback((requestId: string) => repository.getProfileCollectionRequest(requestId), [repository]);

  const deleteProfileCollectionRequest = useCallback(async (requestId: string) => {
    await repository.deleteProfileCollectionRequest(requestId);
    await deleteProfileCollectionPrivateKey(requestId).catch(() => undefined);
  }, [repository]);

  const applyProfileCollectionImport = useCallback(async (requestId: string, person: Person, mbti: string | null, customTagIds: string[], newTagNames: string[]) => {
    if (!person.name.trim()) throw new Error('人物名字不能为空');
    if (person.birthday) validateBirthday(person.birthday);
    if (mbti && !MBTI_TYPES.includes(mbti as typeof MBTI_TYPES[number])) throw new Error('MBTI 类型无效');
    const knownTagIds = new Set(tagDefinitions.map((tag) => tag.id));
    if (customTagIds.some((tagId) => !knownTagIds.has(tagId))) throw new Error('人物标签已经发生变化，请重新创建邀请');
    const normalizedNames = [...new Set(newTagNames.map(normalizeTagName))];
    const existingTags = new Map(tagDefinitions.filter((tag) => !tag.groupId).map((tag) => [tag.normalizedName, tag]));
    const now = new Date().toISOString();
    const newTags = normalizedNames.filter((name) => !existingTags.has(name)).map((normalizedName, index) => ({
      id: `tag_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 10)}`,
      name: newTagNames.find((name) => normalizeTagName(name) === normalizedName)!.trim(),
      normalizedName,
      groupId: null,
      createdAt: now,
      updatedAt: now,
    } satisfies TagDefinition));
    const importedTagIds = normalizedNames.map((name) => existingTags.get(name)?.id ?? newTags.find((tag) => tag.normalizedName === name)!.id);
    const nextPerson = { ...person, name: person.name.trim(), updatedAt: new Date().toISOString() };
    await repository.applyProfileCollectionUpdate(requestId, nextPerson, mbti, [...new Set([...customTagIds, ...importedTagIds])], newTags, new Date().toISOString());
    const storedPeople = await repository.listPeople();
    setPeople(storedPeople);
    setPersonTagsState(await repository.listPersonTagAssignments());
    setTagDefinitions(await repository.listTagDefinitions());
    await deleteProfileCollectionPrivateKey(requestId).catch(() => undefined);
    void syncBirthdayNotifications(storedPeople, await repository.getPreferences()).catch(() => undefined);
  }, [repository, syncBirthdayNotifications, tagDefinitions]);

  const deletePerson = useCallback(async (personId: string) => {
    const existing = people.find((person) => person.id === personId);
    if (!existing) return;
    const albumPhotoIds = albumMedia.filter((relation) => albums.some((album) => album.id === relation.albumId && album.personId === personId)).map((relation) => relation.mediaId);
    const albumPhotos = media.filter((item) => albumPhotoIds.includes(item.id));
    await cancelBirthdayNotifications(repository, expoBirthdayNotificationAdapter, personId);
    const deletedTrackIds = await repository.deletePerson(personId);
    const storedPeople = await repository.listPeople();
    setPeople(storedPeople);
    const deletedMusicAssets = deletedTrackIds
      .map((trackId) => musicTracks.find((track) => track.id === trackId))
      .filter((track): track is MusicTrack => Boolean(track))
      .map((track) => media.find((item) => item.id === track.mediaId))
      .filter((item): item is Media => Boolean(item));
    if (deletedMusicAssets.length) await cleanupUnreferencedMedia(deletedMusicAssets.map((item) => item.id), deletedMusicAssets);
    if (existing.avatarMediaId) await cleanupUnreferencedMedia([existing.avatarMediaId]);
    for (const item of albumPhotos) {
      await repository.deleteMedia(item.id);
      try { const file = new File(item.localPath); if (file.exists) file.delete(); } catch { /* 数据记录已删除 */ }
    }
    try { deletePersonAlbumDirectory(personId); } catch { /* 数据记录已删除 */ }
    setAlbums(await repository.listAlbums());
    setAlbumMedia(await repository.listAlbumMedia());
    setPersonBooksState(await repository.listPersonBooks());
    setPersonTagsState(await repository.listPersonTagAssignments());
    setMedia(await repository.listMedia());
    setHomeMemory((current) => current?.kind === 'person' && current.person.id === personId ? null : current);
    void syncBirthdayNotifications(storedPeople, await repository.getPreferences()).catch(() => undefined);
    setMusicCollectionEntries(await repository.listMusicCollectionEntries());
    setMusicTracks(await repository.listMusicTracks());
  }, [albumMedia, albums, cleanupUnreferencedMedia, media, musicTracks, people, repository, syncBirthdayNotifications]);

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

  const importMusicTrack = useCallback(async (item: Media, personId: string | null = null) => {
    if (isEncryptedMusicName(item.originalName ?? '')) {
      const unlocked = await importEncryptedMusicTrack(item, repository, personId);
      const [storedMedia, storedTracks, storedEntries] = await Promise.all([repository.listMedia(), repository.listMusicTracks(), repository.listMusicCollectionEntries()]);
      setMedia(storedMedia);
      setMusicTracks(storedTracks);
      setMusicCollectionEntries(storedEntries);
      return unlocked.track;
    }
    if (personId && !people.some((person) => person.id === personId)) throw new Error('人物不存在或已删除');
    const now = new Date().toISOString();
    const track: MusicTrack = {
      id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      mediaId: item.id,
      coverMediaId: null,
      title: item.originalName?.replace(/\.[^.]+$/, '') || '未命名音乐',
      artist: null,
      album: null,
      durationMs: null,
      createdAt: now,
      updatedAt: now,
    };
    const collections: MusicCollectionEntry[] = [
      { trackId: track.id, targetType: 'self', targetId: null, createdAt: now },
      ...(personId ? [{ trackId: track.id, targetType: 'person' as const, targetId: personId, createdAt: now }] : []),
    ];
    let coverMedia: Media | null = null;
    try {
      coverMedia = await extractEmbeddedMusicCover(item);
      track.coverMediaId = coverMedia?.id ?? null;
      await repository.importMusicTrack(item, track, collections, coverMedia);
    } catch (cause) {
      try { const file = new File(item.localPath); if (file.exists) file.delete(); } catch { /* 不覆盖原始错误 */ }
      if (coverMedia) {
        try { const file = new File(coverMedia.localPath); if (file.exists) file.delete(); } catch { /* 不覆盖原始错误 */ }
      }
      throw cause;
    }
    const [storedMedia, storedTracks, storedEntries] = await Promise.all([repository.listMedia(), repository.listMusicTracks(), repository.listMusicCollectionEntries()]);
    setMedia(storedMedia);
    setMusicTracks(storedTracks);
    setMusicCollectionEntries(storedEntries);
    return track;
  }, [people, repository]);

  const createMusicTrack = useCallback(async (track: MusicTrack, collection?: MusicCollectionEntry) => {
    await repository.createMusicTrack(track, collection);
    setMusicTracks(await repository.listMusicTracks());
    setMusicCollectionEntries(await repository.listMusicCollectionEntries());
  }, [repository]);

  const updateMusicTrack = useCallback(async (track: MusicTrack) => {
    await repository.updateMusicTrack(track);
    setMusicTracks(await repository.listMusicTracks());
  }, [repository]);

  const setMusicTrackCover = useCallback(async (trackId: string, cover: Media | null) => {
    const track = musicTracks.find((item) => item.id === trackId);
    if (!track) throw new Error('歌曲不存在或已删除');
    const previousCoverId = track.coverMediaId;
    if (cover) await repository.createMedia(cover);
    try {
      await repository.updateMusicTrack({ ...track, coverMediaId: cover?.id ?? null, updatedAt: new Date().toISOString() });
    } catch (cause) {
      if (cover) await repository.deleteMedia(cover.id).catch(() => undefined);
      throw cause;
    }
    setMusicTracks(await repository.listMusicTracks());
    if (cover) setMedia((current) => [...current, cover]);
    if (previousCoverId) await cleanupUnreferencedMedia([previousCoverId]);
  }, [cleanupUnreferencedMedia, musicTracks, repository]);

  const deleteMusicTrack = useCallback(async (trackId: string) => {
    const track = musicTracks.find((item) => item.id === trackId);
    await repository.deleteMusicTrack(trackId);
    setMusicTracks(await repository.listMusicTracks());
    setMusicCollectionEntries(await repository.listMusicCollectionEntries());
    if (track) {
      const assets = [media.find((item) => item.id === track.mediaId), track.coverMediaId ? media.find((item) => item.id === track.coverMediaId) : null].filter((item): item is Media => Boolean(item));
      if (assets.length) await cleanupUnreferencedMedia(assets.map((item) => item.id), assets);
      setMedia(await repository.listMedia());
    }
  }, [cleanupUnreferencedMedia, media, musicTracks, repository]);

  const addMusicCollectionEntry = useCallback(async (entry: MusicCollectionEntry) => {
    await repository.addMusicCollectionEntry(entry);
    setMusicCollectionEntries(await repository.listMusicCollectionEntries());
  }, [repository]);

  const removeMusicCollectionEntry = useCallback(async (trackId: string, targetType: MusicCollectionEntry['targetType'], targetId: string | null) => {
    const track = musicTracks.find((item) => item.id === trackId);
    const assets = track ? [media.find((item) => item.id === track.mediaId), track.coverMediaId ? media.find((item) => item.id === track.coverMediaId) : null].filter((item): item is Media => Boolean(item)) : [];
    const deletedTrack = await repository.removeMusicCollectionEntry(trackId, targetType, targetId);
    const [storedTracks, storedEntries] = await Promise.all([repository.listMusicTracks(), repository.listMusicCollectionEntries()]);
    setMusicTracks(storedTracks);
    setMusicCollectionEntries(storedEntries);
    if (deletedTrack && assets.length) await cleanupUnreferencedMedia(assets.map((item) => item.id), assets);
  }, [cleanupUnreferencedMedia, media, musicTracks, repository]);

  const createMusicPlaylist = useCallback(async (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 40) throw new Error('歌单名称必须为 1–40 字');
    const now = new Date().toISOString();
    const playlist: MusicPlaylist = {
      id: `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      name: normalizedName,
      coverMediaId: null,
      createdAt: now,
      updatedAt: now,
    };
    await repository.createMusicPlaylist(playlist);
    setMusicPlaylists(await repository.listMusicPlaylists());
    return playlist;
  }, [repository]);

  const renameMusicPlaylist = useCallback(async (playlistId: string, name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 40) throw new Error('歌单名称必须为 1–40 字');
    const playlist = musicPlaylists.find((item) => item.id === playlistId);
    if (!playlist) throw new Error('歌单不存在或已删除');
    await repository.updateMusicPlaylist({ ...playlist, name: normalizedName, updatedAt: new Date().toISOString() });
    setMusicPlaylists(await repository.listMusicPlaylists());
  }, [musicPlaylists, repository]);

  const setMusicPlaylistCover = useCallback(async (playlistId: string, cover: Media | null) => {
    const playlist = musicPlaylists.find((item) => item.id === playlistId);
    if (!playlist) throw new Error('歌单不存在或已删除');
    const previousCoverId = playlist.coverMediaId;
    if (cover) await repository.createMedia(cover);
    try {
      await repository.updateMusicPlaylist({ ...playlist, coverMediaId: cover?.id ?? null, updatedAt: new Date().toISOString() });
    } catch (cause) {
      if (cover) await repository.deleteMedia(cover.id).catch(() => undefined);
      throw cause;
    }
    setMusicPlaylists(await repository.listMusicPlaylists());
    if (cover) setMedia((current) => [...current, cover]);
    if (previousCoverId) await cleanupUnreferencedMedia([previousCoverId]);
  }, [cleanupUnreferencedMedia, musicPlaylists, repository]);

  const deleteMusicPlaylist = useCallback(async (playlistId: string) => {
    const playlist = musicPlaylists.find((item) => item.id === playlistId);
    await repository.deleteMusicPlaylist(playlistId);
    const [storedPlaylists, storedEntries] = await Promise.all([repository.listMusicPlaylists(), repository.listMusicPlaylistEntries()]);
    setMusicPlaylists(storedPlaylists);
    setMusicPlaylistEntries(storedEntries);
    if (playlist?.coverMediaId) {
      await cleanupUnreferencedMedia([playlist.coverMediaId]);
      setMedia(await repository.listMedia());
    }
  }, [cleanupUnreferencedMedia, musicPlaylists, repository]);

  const addMusicTracksToPlaylist = useCallback(async (playlistId: string, trackIds: string[]) => {
    const playlist = musicPlaylists.find((item) => item.id === playlistId);
    if (!playlist) throw new Error('歌单不存在或已删除');
    const validTrackIds = new Set((await repository.listMusicTracks()).map((track) => track.id));
    const existingTrackIds = new Set(musicPlaylistEntries.filter((entry) => entry.playlistId === playlistId).map((entry) => entry.trackId));
    const addedAt = Date.now();
    const entries = [...new Set(trackIds)]
      .filter((trackId) => validTrackIds.has(trackId) && !existingTrackIds.has(trackId))
      .map((trackId, index): MusicPlaylistEntry => ({ playlistId, trackId, addedAt: new Date(addedAt + index).toISOString() }));
    if (!entries.length) return;
    await repository.addMusicPlaylistEntries(entries);
    await repository.updateMusicPlaylist({ ...playlist, updatedAt: new Date().toISOString() });
    const [storedPlaylists, storedEntries] = await Promise.all([repository.listMusicPlaylists(), repository.listMusicPlaylistEntries()]);
    setMusicPlaylists(storedPlaylists);
    setMusicPlaylistEntries(storedEntries);
  }, [musicPlaylistEntries, musicPlaylists, repository]);

  const removeMusicTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    const playlist = musicPlaylists.find((item) => item.id === playlistId);
    if (!playlist) return;
    await repository.removeMusicPlaylistEntry(playlistId, trackId);
    await repository.updateMusicPlaylist({ ...playlist, updatedAt: new Date().toISOString() });
    const [storedPlaylists, storedEntries] = await Promise.all([repository.listMusicPlaylists(), repository.listMusicPlaylistEntries()]);
    setMusicPlaylists(storedPlaylists);
    setMusicPlaylistEntries(storedEntries);
  }, [musicPlaylists, repository]);

  const createBook = useCallback(async (book: Book) => {
    await repository.createBook(book);
    setBooks(await repository.listBooks());
  }, [repository]);

  const updateBook = useCallback(async (book: Book) => {
    await repository.updateBook(book);
    setBooks(await repository.listBooks());
  }, [repository]);

  const deleteBook = useCallback(async (bookId: string) => {
    const book = books.find((item) => item.id === bookId);
    const assets = book ? [book.fileMediaId, book.coverMediaId].filter((id): id is string => Boolean(id)) : [];
    await repository.deleteBook(bookId);
    setBooks(await repository.listBooks());
    setPersonBooksState(await repository.listPersonBooks());
    setBookExcerpts(await repository.listBookExcerpts());
    if (assets.length) {
      await cleanupUnreferencedMedia(assets);
      setMedia(await repository.listMedia());
    }
  }, [books, cleanupUnreferencedMedia, repository]);

  const createBookExcerpt = useCallback(async (excerpt: BookExcerpt) => {
    await repository.createBookExcerpt(excerpt);
    setBookExcerpts(await repository.listBookExcerpts());
  }, [repository]);

  const updateBookExcerpt = useCallback(async (excerpt: BookExcerpt) => {
    await repository.updateBookExcerpt(excerpt);
    setBookExcerpts(await repository.listBookExcerpts());
  }, [repository]);

  const deleteBookExcerpt = useCallback(async (excerptId: string) => {
    await repository.deleteBookExcerpt(excerptId);
    setBookExcerpts(await repository.listBookExcerpts());
  }, [repository]);

  const getReadingNoteSource = useCallback((postId: string) => repository.getReadingNoteSource(postId), [repository]);
  const saveReadingNoteSource = useCallback(async (source: ReadingNoteSource) => {
    await repository.saveReadingNoteSource(source);
    setReadingNoteSources((current) => [...current.filter((item) => item.postId !== source.postId), source]);
  }, [repository]);

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

  const setPersistentNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (!persistentNotificationSupported) throw new Error('当前环境不支持常驻快捷栏');
    if (enabled) {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') throw new Error('系统通知权限未开启');
    }
    try {
      await setPersistentNotificationEnabled(enabled);
      await repository.updatePreferences({ persistentNotificationEnabled: enabled });
    } catch (cause) {
      await setPersistentNotificationEnabled(!enabled).catch(() => undefined);
      throw cause;
    }
    setPreferences(await repository.getPreferences());
    setPersistentNotificationRunning((await getPersistentNotificationStatus()).running);
  }, [repository]);

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
    const [checkIn, storedCheckIns, storedPosts, storedPeople, storedMedia, memory, storedPreferences, storedTags, storedTagGroups, storedTagSystems, storedPersonTags, storedAlbums, storedAlbumMedia, storedPersonBooks, storedMusicTracks, storedMusicCollectionEntries, storedMusicPlaylists, storedMusicPlaylistEntries, storedBooks, storedBookExcerpts, storedReadingNoteSources] = await Promise.all([
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
      repository.listPersonBooks(),
      repository.listMusicTracks(),
      repository.listMusicCollectionEntries(),
      repository.listMusicPlaylists(),
      repository.listMusicPlaylistEntries(),
      repository.listBooks(),
      repository.listBookExcerpts(),
      repository.listReadingNoteSources(),
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
    setPersonBooksState(storedPersonBooks);
    setMusicTracks(storedMusicTracks);
    setMusicCollectionEntries(storedMusicCollectionEntries);
    setMusicPlaylists(storedMusicPlaylists);
    setMusicPlaylistEntries(storedMusicPlaylistEntries);
    setBooks(storedBooks);
    setBookExcerpts(storedBookExcerpts);
    setReadingNoteSources(storedReadingNoteSources);
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
    const profileCollectionRequestIds = await repository.listProfileCollectionRequestIds();
    await cancelBirthdayNotifications(repository, expoBirthdayNotificationAdapter);
    await cancelMemoryNotifications(repository, expoMemoryNotificationAdapter);
    await setPersistentNotificationEnabled(false).catch(() => undefined);
    setPersistentNotificationRunning(false);
    const failures: unknown[] = [];
    let vaultDeleted = false;
    try {
      await deletePasswordVaultStorage();
      await deleteProfileCollectionPrivateKeys(profileCollectionRequestIds);
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
    setMusicTracks([]);
    setMusicCollectionEntries([]);
    setMusicPlaylists([]);
    setMusicPlaylistEntries([]);
    setBooks([]);
    setBookExcerpts([]);
    setReadingNoteSources([]);
    setPersonBooksState([]);
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
    personBooks,
    musicTracks,
    musicCollectionEntries,
    musicPlaylists,
    musicPlaylistEntries,
    books,
    bookExcerpts,
    readingNoteSources,
    homeMemory,
    preferences,
    notificationPermission,
    persistentNotificationRunning,
    persistentNotificationSupported,
    shouldShowBackupReminder,
    ready,
    error,
    checkInToday,
    updateCheckInCity,
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
    setPersonBooks,
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
    setPersistentNotificationsEnabled,
    openNotificationSettings,
    recordBackupExport,
    dismissBackupReminder,
    deleteAllLocalData,
    createProfileCollectionRequest,
    getProfileCollectionRequest,
    deleteProfileCollectionRequest,
    applyProfileCollectionImport,
    importMusicTrack,
    createMusicTrack,
    updateMusicTrack,
    setMusicTrackCover,
    deleteMusicTrack,
    addMusicCollectionEntry,
    removeMusicCollectionEntry,
    createMusicPlaylist,
    renameMusicPlaylist,
    setMusicPlaylistCover,
    deleteMusicPlaylist,
    addMusicTracksToPlaylist,
    removeMusicTrackFromPlaylist,
    createBook,
    updateBook,
    deleteBook,
    createBookExcerpt,
    updateBookExcerpt,
    deleteBookExcerpt,
    getReadingNoteSource,
    saveReadingNoteSource,
  }), [addMusicCollectionEntry, addMusicTracksToPlaylist, addPhotoToAlbum, albumMedia, albums, applyProfileCollectionImport, bookExcerpts, books, checkInToday, checkIns, countPeopleByTag, createAlbum, createBackupSnapshot, createBook, createBookExcerpt, createMusicPlaylist, createMusicTrack, createPerson, createProfileCollectionRequest, createTag, createTagGroup, deleteAlbum, deleteAllLocalData, deleteBook, deleteBookExcerpt, deleteMusicPlaylist, deleteMusicTrack, deletePerson, deletePost, deleteProfileCollectionRequest, deleteTag, deleteTagGroup, discardMedia, dismissBackupReminder, error, getPersonIdsByPost, getPostsByPerson, getProfileCollectionRequest, getReadingNoteSource, homeMemory, importMusicTrack, loadDraft, media, musicCollectionEntries, musicPlaylistEntries, musicPlaylists, musicTracks, notificationPermission, openNotificationSettings, people, personBooks, persistentNotificationRunning, personTags, posts, preferences, readingNoteSources, ready, recordBackupExport, removeMusicCollectionEntry, removeMusicTrackFromPlaylist, removePhotoFromAlbum, renameMusicPlaylist, renameTag, renameTagGroup, reorderAlbumPhotos, replaceMedia, restoreBackupSnapshot, retryBirthdayNotifications, retryMemoryNotifications, saveDraft, saveMedia, savePost, saveReadingNoteSource, setBirthdayNotificationsEnabled, setMemoryNotificationsEnabled, setMusicPlaylistCover, setMusicTrackCover, setPersistentNotificationsEnabled, setPersonBooks, setPersonMemoryEnabled, shouldShowBackupReminder, tagDefinitions, tagGroups, tagSystemSettings, today, todayCheckIn, updateAlbum, updateBook, updateBookExcerpt, updateCheckInCity, updateMusicTrack, updatePerson, updatePreferences, updateTagSystems]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
