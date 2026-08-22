import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { feedback } from '../../shared/feedback';
import type { DayKey, Media, ReadingNoteSource } from '@still-alive/types';
import { toDayKey } from '../../shared/core/day-key';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import RichTextEditor from './rich-text-editor.dom';
import type { EditorCommand, EditorCommandType, EditorMediaSource } from './rich-text-editor.types';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles, editorTheme } from '../../shared/theme/app-theme';
import { persistPickedMedia, persistVoiceRecording } from '../../infrastructure/files/local-media';
import { resolveDeviceLocation } from '../../infrastructure/platform/device-location';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { extractEmbeddedMediaIds } from './embedded-media';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { MusicShareCard } from '../../application/components/music-share-card';
import { ReadingShareCard } from '../../application/components/reading-share-card';
import { createMusicShare, extractMusicShares, withMusicShare, withoutMusicShares } from '../../application/music-share';
import type { MusicShare } from '../../application/music-share';
import { withReadingSourceQuote, withoutReadingSourceQuote } from '../../application/reading-share';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';

export default function EditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { dayKey: requestedDayKey, musicTrackId, personId, postId, sourceBookId, sourceExcerptId } = useLocalSearchParams<{ dayKey?: string; musicTrackId?: string; personId?: string; postId?: string; sourceBookId?: string; sourceExcerptId?: string }>();
  const { bookExcerpts, books, createPerson, discardMedia, getPersonIdsByPost, loadDraft, media, musicTracks, people, posts, readingNoteSources, ready, saveDraft, saveMedia, savePost, saveReadingNoteSource, today, todayCheckIn, updatePost } = useAppState();
  const initializedRef = useRef(false);
  const allowExitRef = useRef(false);
  const initialBodyRef = useRef('');
  const initialPersonIdsRef = useRef<string[]>([]);
  const initialLocationRef = useRef<string | null>(null);
  const initialMusicShareRef = useRef<MusicShare | null>(null);
  const createdMediaRef = useRef<Media[]>([]);
  const bodyTouchedRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftQueueRef = useRef(Promise.resolve());
  const pendingDraftSaveRef = useRef<Promise<void> | null>(null);
  const commandIdRef = useRef(0);
  const [body, setBody] = useState('');
  const [musicShare, setMusicShare] = useState<MusicShare | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [command, setCommand] = useState<EditorCommand | null>(null);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [showTextSize, setShowTextSize] = useState(false);
  const [imageSourcePickerOpen, setImageSourcePickerOpen] = useState(false);
  const [replaceImageSourcePickerOpen, setReplaceImageSourcePickerOpen] = useState(false);
  const [replaceImageId, setReplaceImageId] = useState<string | null>(null);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState('');
  const [locating, setLocating] = useState<'address' | 'city' | null>(null);
  const [draftStatus, setDraftStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [audioSaving, setAudioSaving] = useState(false);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [relationsLoading, setRelationsLoading] = useState(Boolean(postId));
  const editingPost = posts.find((item) => item.id === postId);
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const targetDay = editingPost?.dayKey ?? validPastDay(requestedDayKey, today);
  const isPastEntry = !postId && targetDay !== today;
  const sourceBook = sourceBookId ? books.find((book) => book.id === sourceBookId) ?? null : null;
  const sourceExcerpt = sourceExcerptId && sourceBook ? bookExcerpts.find((excerpt) => excerpt.id === sourceExcerptId && excerpt.bookId === sourceBook.id) ?? null : null;
  const readingSource = useMemo<ReadingNoteSource | null>(() => {
    if (postId) return readingNoteSources.find((source) => source.postId === postId) ?? null;
    if (!sourceBook || (sourceExcerptId && !sourceExcerpt)) return null;
    return {
      postId: '',
      bookId: sourceBook.id,
      excerptIds: sourceExcerpt ? [sourceExcerpt.id] : [],
      quoteSnapshots: [{ bookTitle: sourceBook.title, text: sourceExcerpt?.text ?? '', location: sourceExcerpt?.location ?? null }],
    };
  }, [postId, readingNoteSources, sourceBook, sourceExcerpt, sourceExcerptId]);
  const readingSourceBook = sourceBook ?? (readingSource?.bookId ? books.find((book) => book.id === readingSource.bookId) ?? null : null);
  const headerSubtitle = draftStatus || (readingSource ? '写下这段阅读留给你的感受' : musicShare ? '写下这首歌留给你的感受' : postId ? '修改并完善这条记录' : isPastEntry ? '补写那天想留下的内容' : '写下此刻想留下的内容');
  const editorBusy = saving || audioSaving || mediaSaving || Boolean(locating) || relationsLoading;

  useEffect(() => {
    if (!ready || initializedRef.current) return;
    if (postId) {
      const post = posts.find((item) => item.id === postId);
      if (!post) {
        feedback.alert('日记不存在', '它可能已经被删除。', [{ text: '返回', onPress: () => { allowExitRef.current = true; router.back(); } }]);
        return;
      }
      initializedRef.current = true;
      const sharedMusic = extractMusicShares(post.bodyMarkdown)[0] ?? null;
      const currentReadingSource = readingNoteSources.find((source) => source.postId === post.id) ?? null;
      const currentBook = currentReadingSource?.bookId ? books.find((book) => book.id === currentReadingSource.bookId) ?? null : null;
      const visibleBody = withoutReadingSourceQuote(withoutMusicShares(post.bodyMarkdown), currentReadingSource, currentBook);
      initialBodyRef.current = visibleBody;
      initialMusicShareRef.current = sharedMusic;
      initialLocationRef.current = post.locationName;
      setBody(visibleBody);
      setMusicShare(sharedMusic);
      setLocationName(post.locationName);
      void getPersonIdsByPost(post.id).then((ids) => {
        initialPersonIdsRef.current = ids;
        setSelectedPersonIds(ids);
        setRelationsLoading(false);
        setInitialized(true);
      }).catch((cause: unknown) => {
        setRelationsLoading(false);
        feedback.alert('人物关联加载失败', cause instanceof Error ? cause.message : '请返回后重试。', [{ text: '返回', onPress: () => { allowExitRef.current = true; router.back(); } }]);
      });
      return;
    }
    const hasReadingSource = Boolean(sourceBook && (!sourceExcerptId || sourceExcerpt));
    if ((sourceBookId || sourceExcerptId) && !hasReadingSource) {
      initializedRef.current = true;
      feedback.alert('阅读来源不存在', '书籍或书摘可能已被删除。', [{ text: '返回', onPress: () => { allowExitRef.current = true; router.back(); } }]);
      return;
    }
    const sharedTrack = musicTrackId ? musicTracks.find((track) => track.id === musicTrackId) : null;
    if (musicTrackId && !sharedTrack) {
      initializedRef.current = true;
      feedback.alert('歌曲不存在', '它可能已经被删除。', [{ text: '返回', onPress: () => { allowExitRef.current = true; router.back(); } }]);
      return;
    }
    if (targetDay === today && !todayCheckIn && !hasReadingSource && !sharedTrack) {
      router.replace('/');
      return;
    }
    initializedRef.current = true;
    void loadDraft(targetDay).then((draft) => {
      const draftBody = draft?.bodyMarkdown ?? '';
      const sharedMusic = sharedTrack ? createMusicShare(sharedTrack) : extractMusicShares(draftBody)[0] ?? null;
      const visibleBody = withoutReadingSourceQuote(withoutMusicShares(draftBody), readingSource, sourceBook);
      initialBodyRef.current = visibleBody;
      initialMusicShareRef.current = sharedMusic;
      setBody(visibleBody);
      setMusicShare(sharedMusic);
      setRelationsLoading(false);
      setInitialized(true);
    }).catch((cause: unknown) => {
      feedback.alert('草稿加载失败', cause instanceof Error ? cause.message : '请返回后重试。', [{ text: '返回', onPress: () => { allowExitRef.current = true; router.back(); } }]);
    });
  }, [bookExcerpts, books, getPersonIdsByPost, loadDraft, musicTrackId, musicTracks, postId, posts, readingNoteSources, readingSource, ready, router, sourceBook, sourceBookId, sourceExcerpt, sourceExcerptId, targetDay, today, todayCheckIn]);

  useEffect(() => {
    if (personId && people.some((person) => person.id === personId)) {
      setSelectedPersonIds((current) => current.includes(personId) ? current : [...current, personId]);
    }
  }, [people, personId]);

  useEffect(() => {
    if (activeFormats.includes('table')) {
      setShowMore(false);
      setShowTextSize(false);
    }
  }, [activeFormats]);

  useEffect(() => {
    if (postId || !initialized || !bodyTouchedRef.current) return;
    setDraftStatus('保存中…');
    draftTimerRef.current = setTimeout(() => {
      const task = draftQueueRef.current.catch(() => undefined).then(() => saveDraft(withReadingSourceQuote(withMusicShare(body, musicShare), readingSource, readingSourceBook), targetDay));
      draftQueueRef.current = task;
      pendingDraftSaveRef.current = task;
      void task.then(() => {
        if (pendingDraftSaveRef.current === task) setDraftStatus('刚刚已保存');
      }).catch(() => {
        if (pendingDraftSaveRef.current === task) setDraftStatus('草稿保存失败');
      }).finally(() => {
        if (pendingDraftSaveRef.current === task) pendingDraftSaveRef.current = null;
      });
    }, 450);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    };
  }, [body, initialized, musicShare, postId, readingSource, readingSourceBook, saveDraft, targetDay]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowExitRef.current) return;
    if (editorBusy || recorderState.isRecording) {
      event.preventDefault();
      feedback.alert(recorderState.isRecording ? '正在录音' : '正在处理内容', recorderState.isRecording ? '停止录音后才能离开这条记录。' : '请等待当前操作完成后再离开。');
      return;
    }
    if (!createdMediaRef.current.length && !hasUnsavedContent(body, musicShare, postId, initialBodyRef.current, initialMusicShareRef.current, selectedPersonIds, initialPersonIdsRef.current, locationName, initialLocationRef.current)) return;
    event.preventDefault();
    feedback.alert(
      postId ? '放弃这次修改？' : '先退出编写？',
      postId ? '尚未保存的修改会丢失。' : '正文会保留在本地草稿中，下次可以继续。',
      [
        { text: '继续编写', style: 'cancel' },
        {
          text: postId ? '放弃修改' : '退出，保留草稿',
          style: postId ? 'destructive' : 'default',
          onPress: () => {
            const leave = () => navigation.dispatch(event.data.action);
            if (!postId) {
              const task = draftQueueRef.current.catch(() => undefined).then(() => saveDraft(withReadingSourceQuote(withMusicShare(body, musicShare), readingSource, readingSourceBook), targetDay));
              draftQueueRef.current = task;
              void task.then(async () => {
                const created = createdMediaRef.current;
                createdMediaRef.current = [];
                await Promise.all(created.map(discardMedia)).catch(() => undefined);
                allowExitRef.current = true;
                leave();
              }).catch((cause: unknown) => {
                feedback.alert('草稿保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
              });
              return;
            }
            const created = createdMediaRef.current;
            createdMediaRef.current = [];
            void Promise.all(created.map(discardMedia)).catch(() => undefined).then(() => {
              allowExitRef.current = true;
              leave();
            });
          },
        },
      ],
    );
  }), [body, discardMedia, editorBusy, locationName, musicShare, navigation, postId, readingSource, readingSourceBook, recorderState.isRecording, saveDraft, selectedPersonIds, targetDay]);

  const editorMedia = useMemo<EditorMediaSource[]>(() => {
    const ids = new Set(extractEmbeddedMediaIds(body));
    return media.filter((item) => ids.has(item.id)).map((item) => ({ id: item.id, mimeType: item.mimeType, uri: item.localPath }));
  }, [body, media]);

  const handleBodyChange = (markdown: string) => {
    bodyTouchedRef.current = true;
    setBody(markdown);
  };

  const sendCommand = (type: EditorCommandType, value?: EditorCommand['value']) => {
    commandIdRef.current += 1;
    setCommand({ id: commandIdRef.current, type, value });
  };

  const setTextSize = (type: 'paragraph' | 'heading1' | 'heading2' | 'heading3') => {
    sendCommand(type);
    setShowTextSize(false);
  };

  const handleSave = async () => {
    if (editorBusy) return;
    const value = body.trim();
    if (!value && !musicShare && !readingSource) {
      feedback.alert('还没有内容', '写下一点内容或录一段语音后再记下。');
      return;
    }
    const savedBody = withReadingSourceQuote(withMusicShare(value, musicShare), readingSource, readingSourceBook);
    try {
      setSaving(true);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
      await draftQueueRef.current.catch(() => undefined);
      if (postId) await updatePost(postId, savedBody, selectedPersonIds, locationName);
      else {
        const createdPost = await savePost(savedBody, selectedPersonIds, targetDay, locationName);
        if (readingSource) await saveReadingNoteSource({ ...readingSource, postId: createdPost.id });
      }
      const created = createdMediaRef.current;
      createdMediaRef.current = [];
      await Promise.all(created.map(discardMedia)).catch(() => undefined);
      allowExitRef.current = true;
      Keyboard.dismiss();
      if (musicTrackId && !postId) router.replace('/');
      else if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (cause: unknown) {
      setSaving(false);
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const beginRecording = async () => {
    try {
      if (!await ensureAppPermission('microphone')) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      sendCommand('recordingStart');
      setDraftStatus('正在录音…');
    } catch (cause: unknown) {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      feedback.alert('录音失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const startRecording = async () => {
    if (editorBusy || recorderState.isRecording) return;
    if (Platform.OS === 'web') {
      feedback.alert('当前设备暂不支持', '请在 iOS 或 Android 客户端中录入语音。');
      return;
    }
    await beginRecording();
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;
    let importedAudio: Media | null = null;
    try {
      setAudioSaving(true);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('录音文件没有生成');
      const item = await persistVoiceRecording(uri);
      importedAudio = item;
      await saveMedia(item);
      const durationMs = Math.max(recorderState.durationMillis, Math.round(audioRecorder.currentTime * 1000));
      createdMediaRef.current = [...createdMediaRef.current, item];
      sendCommand('audio', { durationMs, id: item.id, uri: await mediaDataUrl(item) });
      setDraftStatus('语音已保存到本机');
    } catch (cause: unknown) {
      if (importedAudio) {
        createdMediaRef.current = createdMediaRef.current.filter((item) => item.id !== importedAudio?.id);
        await discardMedia(importedAudio).catch(() => undefined);
      }
      sendCommand('recordingCancel');
      feedback.alert('语音保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
      setDraftStatus('本地草稿');
    } finally {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      setAudioSaving(false);
    }
  };

  const handleRecordPress = () => {
    if (recorderState.isRecording) void stopRecording();
    else void startRecording();
  };

  const openPersonPicker = () => {
    Keyboard.dismiss();
    setPersonPickerOpen(true);
  };

  const selectPerson = (person: { id: string; name: string }) => {
    const alreadySelected = selectedPersonIds.includes(person.id);
    if (alreadySelected) {
      setSelectedPersonIds((current) => current.filter((id) => id !== person.id));
      setPersonPickerOpen(false);
      return;
    }
    if (!alreadySelected && selectedPersonIds.length >= 10) {
      feedback.alert('最多提及 10 个人物', '这条记录已经提及了 10 个人物。');
      return;
    }
    setSelectedPersonIds((current) => [...current, person.id]);
    sendCommand('mention', person.name);
    setPersonPickerOpen(false);
  };

  const handleCreatePerson = async () => {
    const name = newPersonName.trim();
    if (!name) return;
    if (selectedPersonIds.length >= 10) {
      feedback.alert('最多提及 10 个人物', '这条记录已经提及了 10 个人物。');
      return;
    }
    try {
      const person = await createPerson(name);
      setNewPersonName('');
      selectPerson(person);
    } catch (cause: unknown) {
      feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const remainingMediaSlots = () => {
    const currentCount = [...body.matchAll(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/g)].length;
    const remaining = 9 - currentCount;
    if (remaining <= 0) {
      feedback.alert('最多添加 9 个媒体', '可以先删除一张图片或一个视频，再添加新的媒体。');
      return 0;
    }
    return remaining;
  };

  const importPickedMedia = async (assets: ImagePickerAsset[], limit: number) => {
    const importedItems: Media[] = [];
    try {
      setMediaSaving(true);
      setDraftStatus('正在保存媒体…');
      for (const asset of assets.slice(0, limit)) {
        const item = await persistPickedMedia(asset);
        importedItems.push(item);
        await saveMedia(item);
        createdMediaRef.current = [...createdMediaRef.current, item];
      }
      const editorMediaItems = await Promise.all(importedItems.map(async (item) => ({ id: item.id, mimeType: item.mimeType, uri: await editorMediaUri(item), alt: item.mimeType.startsWith('video/') ? '视频' : '照片' })));
      sendCommand('images', editorMediaItems);
      setDraftStatus('媒体已保存到本机');
    } catch (cause: unknown) {
      await Promise.all(importedItems.map(discardMedia)).catch(() => undefined);
      const failedIds = new Set(importedItems.map((item) => item.id));
      createdMediaRef.current = createdMediaRef.current.filter((item) => !failedIds.has(item.id));
      feedback.alert('媒体保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
      setDraftStatus('本地草稿');
    } finally {
      setMediaSaving(false);
    }
  };

  const openImageSourcePicker = () => {
    if (editorBusy || !remainingMediaSlots()) return;
    Keyboard.dismiss();
    setImageSourcePickerOpen(true);
  };

  const handleTakePhoto = async () => {
    setImageSourcePickerOpen(false);
    if (editorBusy) return;
    const remaining = remainingMediaSlots();
    if (!remaining) return;

    if (!await ensureAppPermission('camera')) return;

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled) return;
    await importPickedMedia(result.assets, remaining);
  };

  const handlePickImages = async () => {
    setImageSourcePickerOpen(false);
    if (editorBusy) return;
    const remaining = remainingMediaSlots();
    if (!remaining) return;

    if (!await ensureAppPermission('photos')) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
      quality: 0.9,
      selectionLimit: remaining,
    });
    if (result.canceled) return;
    await importPickedMedia(result.assets, remaining);
  };

  const handleReplaceImage = (mediaId: string) => {
    if (editorBusy) return;
    setReplaceImageId(mediaId);
    setReplaceImageSourcePickerOpen(true);
  };

  const replaceImageFromSource = async (source: 'camera' | 'photos') => {
    const mediaId = replaceImageId;
    setReplaceImageSourcePickerOpen(false);
    setReplaceImageId(null);
    if (!mediaId || editorBusy) return;
    let replacement: Media | null = null;
    if (!await ensureAppPermission(source)) return;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled) return;
    try {
      setMediaSaving(true);
      setDraftStatus('正在替换媒体…');
      replacement = await persistPickedMedia(result.assets[0]);
      await saveMedia(replacement);
      createdMediaRef.current = [...createdMediaRef.current, replacement];
      sendCommand('replaceImage', { ...replacement, alt: replacement.mimeType.startsWith('video/') ? '视频' : '照片', mimeType: replacement.mimeType, previousId: mediaId, uri: await editorMediaUri(replacement) });
      setDraftStatus('媒体已替换');
    } catch (cause: unknown) {
      if (replacement) {
        createdMediaRef.current = createdMediaRef.current.filter((item) => item.id !== replacement?.id);
        await discardMedia(replacement).catch(() => undefined);
      }
      feedback.alert('媒体替换失败', cause instanceof Error ? cause.message : '请稍后重试。');
      setDraftStatus('本地草稿');
    } finally {
      setMediaSaving(false);
    }
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      feedback.alert('链接格式不正确', '请输入以 http:// 或 https:// 开头的地址。');
      return;
    }
    sendCommand('link', url);
    setLinkPickerOpen(false);
  };

  const openLinkPicker = () => {
    Keyboard.dismiss();
    setLinkPickerOpen(true);
  };

  const openLocationPicker = () => {
    Keyboard.dismiss();
    setCustomLocation(locationName ?? '');
    setLocationPickerOpen(true);
  };

  const useCurrentLocation = async (detail: 'address' | 'city') => {
    try {
      setLocating(detail);
      if (!await ensureAppPermission('location')) return;
      const location = await resolveDeviceLocation();
      setLocationName(detail === 'city' ? location.city : location.address);
      setLocationPickerOpen(false);
    } catch (cause: unknown) {
      feedback.alert('暂时无法定位', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setLocating(null);
    }
  };

  const useCustomLocation = () => {
    const value = customLocation.trim();
    if (!value) return;
    setLocationName(value);
    setLocationPickerOpen(false);
  };

  const confirmDeleteTable = () => {
    feedback.alert('删除整个表格？', '表格中的全部内容都会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '删除表格', style: 'destructive', onPress: () => sendCommand('tableDelete') },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppKeyboardAvoidingView style={styles.flex}>
        <ToolPageHeader
          backDisabled={editorBusy}
          onBack={() => router.back()}
          right={<ToolPageHeaderTextAction disabled={editorBusy || recorderState.isRecording} emphasized label={saving ? '保存中' : mediaSaving ? '处理媒体' : audioSaving ? '保存语音' : relationsLoading ? '加载中' : '完成'} onPress={() => void handleSave()} />}
          subtitle={headerSubtitle}
          title={readingSource && !postId ? '阅读随感' : musicShare && !postId ? '分享音乐' : postId ? '编辑记录' : isPastEntry ? '补写记录' : '新建记录'}
        />

        {initialized && readingSource ? <View style={styles.readingShare}><ReadingShareCard source={readingSource} variant="composer" /></View> : null}
        {initialized && musicShare ? <View style={styles.musicShare}><MusicShareCard share={musicShare} variant="composer" /></View> : null}

        {initialized ? (
          <RichTextEditor
            audioSaving={audioSaving}
            command={command}
            disabled={editorBusy}
            dom={{ allowFileAccess: true, keyboardDisplayRequiresUserAction: false, style: styles.domEditor }}
            initialMarkdown={initialBodyRef.current}
            media={editorMedia}
            onChange={handleBodyChange}
            onFormatsChange={setActiveFormats}
            onMention={openPersonPicker}
            onReplaceImage={(mediaId) => void handleReplaceImage(mediaId)}
            onStopRecording={() => void stopRecording()}
            placeholder={readingSource ? '这段阅读让你想到了什么？\n从这里写下感受…' : musicShare ? '这首歌让你想起了什么？\n从这里写下感受…' : `${isPastEntry ? '那天' : '今天'}有什么，想让以后的自己记得？\n从这里开始写…`}
            readLocalFile={readLocalFile}
            recordingDurationMs={recorderState.isRecording ? recorderState.durationMillis : null}
            theme={editorTheme()}
          />
        ) : <View style={styles.domEditor} />}

        <View collapsable={false} pointerEvents={editorBusy ? 'none' : 'auto'} style={[styles.meta, editorBusy && styles.disabledControl]}>
          <Pressable accessibilityLabel={locationName ? `地点：${locationName}` : '添加地点'} accessibilityRole="button" onPress={openLocationPicker} style={({ pressed }) => [styles.locationButton, pressed && styles.locationButtonPressed]}>
            <SymbolView name={{ android: 'location_on', ios: 'mappin.and.ellipse', web: 'location_on' }} size={14} tintColor={locationName ? colors.life : colors.inkFaint} type="hierarchical" />
            <Text numberOfLines={1} style={[styles.locationButtonText, locationName && styles.locationButtonTextActive]}>{locationName ?? '所在位置'}</Text>
          </Pressable>
          <Text style={styles.metaText}>{markdownTextLength(body)} 字</Text>
        </View>

        <View collapsable={false} pointerEvents={editorBusy ? 'none' : 'auto'} style={[styles.toolbarStage, editorBusy && styles.disabledControl]}>
          {activeFormats.includes('table') ? (
            <View accessibilityLabel="表格操作" style={styles.tableContextBar}>
              <TableActionButton androidIcon="add_row_below" icon="rectangle.split.1x2" label="添加行" text="+ 行" onPress={() => sendCommand('tableAddRow')} />
              <TableActionButton androidIcon="remove" icon="minus" label="删除当前行" text="- 行" onPress={() => sendCommand('tableDeleteRow')} />
              <TableActionButton androidIcon="add_column_right" icon="rectangle.split.2x1" label="添加列" text="+ 列" onPress={() => sendCommand('tableAddColumn')} />
              <TableActionButton androidIcon="remove" icon="minus" label="删除当前列" text="- 列" onPress={() => sendCommand('tableDeleteColumn')} />
              <TableActionButton androidIcon="delete" destructive icon="trash" label="删除整个表格" text="删除表格" onPress={confirmDeleteTable} />
            </View>
          ) : null}

          {showTextSize && showMore && !activeFormats.includes('table') ? (
            <View accessibilityLabel="字号选项" style={styles.tableContextBar}>
              <TableActionButton active={activeFormats.includes('paragraph')} androidIcon="format_paragraph" icon="paragraphsign" label="正文" text="正文" onPress={() => setTextSize('paragraph')} />
              <TableActionButton active={activeFormats.includes('heading1')} androidIcon="format_size" icon="textformat.size.larger" label="标题 1" text="标题 1" onPress={() => setTextSize('heading1')} />
              <TableActionButton active={activeFormats.includes('heading2')} androidIcon="format_size" icon="textformat.size.larger" label="标题 2" text="标题 2" onPress={() => setTextSize('heading2')} />
              <TableActionButton active={activeFormats.includes('heading3')} androidIcon="format_size" icon="textformat.size.larger" label="标题 3" text="标题 3" onPress={() => setTextSize('heading3')} />
            </View>
          ) : null}

          {showMore && !activeFormats.includes('table') ? (
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.moreBar} contentContainerStyle={styles.expandedToolbarContent}>
              <ToolButton androidIcon="undo" icon="arrow.uturn.backward" label="撤销" onPress={() => sendCommand('undo')} />
              <ToolButton androidIcon="redo" icon="arrow.uturn.forward" label="重做" onPress={() => sendCommand('redo')} />
              <ToolButton active={showTextSize} androidIcon="format_size" icon="textformat.size.larger" label="字号" onPress={() => setShowTextSize((value) => !value)} />
              <ToolButton active={activeFormats.includes('italic')} androidIcon="format_italic" icon="italic" label="斜体" onPress={() => sendCommand('italic')} />
              <ToolButton active={activeFormats.includes('strikethrough')} androidIcon="format_strikethrough" icon="strikethrough" label="删除线" onPress={() => sendCommand('strikethrough')} />
              <ToolButton active={activeFormats.includes('inlineCode')} androidIcon="code" icon="chevron.left.forwardslash.chevron.right" label="行内代码" onPress={() => sendCommand('inlineCode')} />
              <ToolButton active={activeFormats.includes('quote')} androidIcon="format_quote" icon="text.quote" label="引用" onPress={() => sendCommand('quote')} />
              <ToolButton active={activeFormats.includes('bulletList')} androidIcon="format_list_bulleted" icon="list.bullet" label="无序列表" onPress={() => sendCommand('bulletList')} />
              <ToolButton active={activeFormats.includes('orderedList')} androidIcon="format_list_numbered" icon="list.number" label="有序列表" onPress={() => sendCommand('orderedList')} />
              <ToolButton active={activeFormats.includes('taskList')} androidIcon="checklist" icon="checklist" label={activeFormats.includes('taskList') ? '取消工作事项' : '工作事项'} onPress={() => sendCommand('taskList')} />
              <ToolButton active={activeFormats.includes('codeBlock')} androidIcon="data_object" icon="curlybraces" label="代码块" onPress={() => sendCommand('codeBlock')} />
              <ToolButton active={activeFormats.includes('link')} androidIcon="link" icon="link" label={activeFormats.includes('link') ? '编辑链接' : '链接'} onPress={openLinkPicker} />
              {activeFormats.includes('link') ? <ToolButton androidIcon="link" icon="link" label="取消链接" onPress={() => sendCommand('unlink')} /> : null}
              <ToolButton androidIcon="horizontal_rule" icon="minus" label="分隔线" onPress={() => sendCommand('horizontalRule')} />
              <ToolButton androidIcon="table" icon="tablecells" label="表格" onPress={() => sendCommand('table')} />
            </ScrollView>
          ) : null}

          <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.toolbar} contentContainerStyle={styles.toolbarContent}>
            <ToolButton active={activeFormats.includes('bold')} androidIcon="format_bold" icon="bold" label="粗体" onPress={() => sendCommand('bold')} />
            <ToolButton androidIcon="alternate_email" icon="at" label="提及人物" onPress={openPersonPicker} />
            <ToolButton androidIcon="perm_media" icon="photo.on.rectangle" label="插入图片或视频" onPress={openImageSourcePicker} />
            <ToolButton active={recorderState.isRecording} androidIcon="mic" icon="mic" label={recorderState.isRecording ? '停止录音' : '插入语音'} onPress={handleRecordPress} />
            <ToolButton active={showMore} androidIcon="more_horiz" icon="ellipsis" label="更多格式" onPress={() => { setShowMore((value) => !value); setShowTextSize(false); }} />
          </ScrollView>
        </View>

        <DraggableBottomSheet accessibilityLabel="选择媒体来源，向下拖动关闭" accessibilityRole="menu" onClose={() => setImageSourcePickerOpen(false)} open={imageSourcePickerOpen} sheetStyle={styles.imageSourceSheet}>
              <ImageSourceOption label="拍摄照片或视频" onPress={() => void handleTakePhoto()} />
              <ImageSourceOption label="从手机相册选择" onPress={() => void handlePickImages()} />
              <Pressable accessibilityRole="button" onPress={() => setImageSourcePickerOpen(false)} style={({ pressed }) => [styles.imageSourceCancel, pressed && styles.imageSourceOptionPressed]}><Text style={styles.imageSourceCancelText}>取消</Text></Pressable>
        </DraggableBottomSheet>

        <DraggableBottomSheet accessibilityLabel="选择替换媒体来源，向下拖动关闭" accessibilityRole="menu" onClose={() => { setReplaceImageSourcePickerOpen(false); setReplaceImageId(null); }} open={replaceImageSourcePickerOpen} sheetStyle={styles.imageSourceSheet}>
              <ImageSourceOption label="拍摄照片或视频" onPress={() => void replaceImageFromSource('camera')} />
              <ImageSourceOption label="从手机相册选择" onPress={() => void replaceImageFromSource('photos')} />
              <Pressable accessibilityRole="button" onPress={() => { setReplaceImageSourcePickerOpen(false); setReplaceImageId(null); }} style={({ pressed }) => [styles.imageSourceCancel, pressed && styles.imageSourceOptionPressed]}><Text style={styles.imageSourceCancelText}>取消</Text></Pressable>
        </DraggableBottomSheet>

        <DraggableBottomSheet keyboardAvoiding onClose={() => setPersonPickerOpen(false)} open={personPickerOpen} sheetStyle={styles.personSheet}>
              <View style={styles.personSheetHeader}>
                <View>
                  <Text style={styles.personSheetTitle}>提到谁？</Text>
                  <Text style={styles.personCount}>已关联 {selectedPersonIds.length} / 10</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setPersonPickerOpen(false)} style={styles.sheetClose}><Text style={styles.sheetCloseText}>完成</Text></Pressable>
              </View>
              <ScrollView style={styles.personList} keyboardShouldPersistTaps="handled">
                {people.map((person) => {
                  const selected = selectedPersonIds.includes(person.id);
                  return <Pressable key={person.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectPerson(person)} style={styles.personRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text></View>
                    <View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personRelation}>{person.relationToMe ?? '还没有填写关系'}</Text></View>
                    <Text style={[styles.personSelect, selected && styles.personSelected]}>{selected ? '取消关联' : '提到'}</Text>
                  </Pressable>;
                })}
              </ScrollView>
              <View style={styles.quickCreate}>
                <TextInput onChangeText={setNewPersonName} onSubmitEditing={() => void handleCreatePerson()} placeholder="输入名字，快速创建人物" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.personInput} value={newPersonName} />
                <Pressable accessibilityRole="button" disabled={!newPersonName.trim()} onPress={() => void handleCreatePerson()} style={styles.createButton}><Text style={styles.createButtonText}>创建</Text></Pressable>
              </View>
        </DraggableBottomSheet>

        <DraggableBottomSheet keyboardAvoiding onClose={() => setLocationPickerOpen(false)} open={locationPickerOpen} sheetStyle={styles.locationSheet}>
              <Text style={styles.locationSheetTitle}>所在位置</Text>
              <Text style={styles.locationSheetHint}>默认只记录城市；详细地址需要主动选择。地点只保存在本地，不会保存经纬度。</Text>
              <LocationOption androidIcon="location_off" icon="location.slash" label="不记录位置" onPress={() => { setLocationName(null); setLocationPickerOpen(false); }} />
              <LocationOption androidIcon="location_city" disabled={Boolean(locating)} icon="building.2.fill" label={locating === 'city' ? '正在获取当前城市…' : '使用当前城市'} onPress={() => void useCurrentLocation('city')} />
              <LocationOption androidIcon="my_location" disabled={Boolean(locating)} icon="location.fill" label={locating === 'address' ? '正在获取详细地址…' : '使用详细地址'} onPress={() => void useCurrentLocation('address')} />
              <View style={styles.customLocationBlock}>
                <Text style={styles.customLocationLabel}>自定义位置</Text>
                <View style={styles.customLocationRow}>
                  <TextInput maxLength={80} onChangeText={setCustomLocation} onSubmitEditing={useCustomLocation} placeholder="例如 家里、颐和园、公司" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.customLocationInput} value={customLocation} />
                  <Pressable accessibilityRole="button" disabled={!customLocation.trim()} onPress={useCustomLocation} style={[styles.customLocationApply, !customLocation.trim() && styles.saveButtonDisabled]}><Text style={styles.customLocationApplyText}>使用</Text></Pressable>
                </View>
              </View>
        </DraggableBottomSheet>

        <Modal animationType="fade" onRequestClose={() => setLinkPickerOpen(false)} transparent visible={linkPickerOpen}>
          <AppKeyboardAvoidingView style={styles.flex}>
            <Pressable style={styles.centeredBackdrop} onPress={() => setLinkPickerOpen(false)}>
              <Pressable style={styles.linkCard} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.linkTitle}>插入链接</Text>
              <Text style={styles.linkHint}>选中文字后添加链接；未选中时将插入链接文字。</Text>
              <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={setLinkUrl} placeholder="https://" placeholderTextColor={colors.inkFaint} style={styles.linkInput} value={linkUrl} />
              <View style={styles.linkActions}>
                <Pressable accessibilityRole="button" onPress={() => setLinkPickerOpen(false)} style={styles.linkAction}><Text style={styles.linkCancel}>取消</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={insertLink} style={styles.linkAction}><Text style={styles.linkConfirm}>插入</Text></Pressable>
              </View>
              </Pressable>
            </Pressable>
          </AppKeyboardAvoidingView>
        </Modal>
      </AppKeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function readLocalFile(uri: string): Promise<string> {
  return new File(uri).base64();
}

async function mediaDataUrl(item: Media): Promise<string> {
  return `data:${item.mimeType || 'application/octet-stream'};base64,${await readLocalFile(item.localPath)}`;
}

async function editorMediaUri(item: Media): Promise<string> {
  return item.mimeType.startsWith('video/') ? item.localPath : mediaDataUrl(item);
}

function TableActionButton({ active = false, androidIcon, destructive = false, icon, label, onPress, text }: { active?: boolean; androidIcon: AndroidSymbol; destructive?: boolean; icon: SFSymbol; label: string; onPress(): void; text: string }) {
  const tintColor = destructive ? colors.danger : active ? colors.life : colors.inkSoft;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.tableAction, active && styles.tableActionActive, destructive && styles.tableActionDestructive, pressed && styles.tableActionPressed]}>
      <SymbolView name={{ android: androidIcon, ios: icon, web: androidIcon }} size={15} tintColor={tintColor} type="hierarchical" />
      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.tableActionText, active && styles.tableActionTextActive, destructive && styles.tableActionTextDestructive]}>{text}</Text>
    </Pressable>
  );
}

function ToolButton({ active = false, androidIcon, destructive = false, icon, iconSize = 21, label, onPress }: { active?: boolean; androidIcon: AndroidSymbol; destructive?: boolean; icon: SFSymbol; iconSize?: number; label: string; onPress(): void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.toolButton, active && styles.toolButtonActive, pressed && styles.toolButtonPressed]}>
      <SymbolView
        animationSpec={active ? { effect: { type: 'scale' }, speed: 1.4 } : undefined}
        name={{ android: androidIcon, ios: icon, web: androidIcon }}
        size={iconSize}
        tintColor={destructive ? colors.danger : active ? colors.life : colors.inkSoft}
        type="hierarchical"
      />
    </Pressable>
  );
}

function ImageSourceOption({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.imageSourceOption, pressed && styles.imageSourceOptionPressed]}>
      <Text style={styles.imageSourceOptionText}>{label}</Text>
    </Pressable>
  );
}

function LocationOption({ androidIcon, disabled = false, icon, label, onPress }: { androidIcon: AndroidSymbol; disabled?: boolean; icon: SFSymbol; label: string; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.locationOption, disabled && styles.saveButtonDisabled, pressed && styles.locationButtonPressed]}>
      <View style={styles.locationOptionIcon}><SymbolView name={{ android: androidIcon, ios: icon, web: androidIcon }} size={20} tintColor={colors.life} type="hierarchical" /></View>
      <Text style={styles.locationOptionText}>{label}</Text>
      <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={15} tintColor={colors.inkFaint} type="hierarchical" />
    </Pressable>
  );
}

function validPastDay(value: string | undefined, today: DayKey): DayKey {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return today;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return toDayKey(parsed) === value ? value as DayKey : today;
}

function hasUnsavedContent(body: string, musicShare: MusicShare | null, postId: string | undefined, initialBody: string, initialMusicShare: MusicShare | null, personIds: string[], initialPersonIds: string[], locationName: string | null, initialLocation: string | null): boolean {
  if (!postId) return body !== initialBody || Boolean(body.trim()) || Boolean(musicShare);
  if (body !== initialBody) return true;
  if (JSON.stringify(musicShare) !== JSON.stringify(initialMusicShare)) return true;
  if (locationName !== initialLocation) return true;
  return [...personIds].sort().join(',') !== [...initialPersonIds].sort().join(',');
}

function markdownTextLength(markdown: string): number {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]*\]\([^)]+\)/g, (value) => value.replace(/^\[|\]\([^)]+\)$/g, ''))
    .replace(/[#>*_~`|\[\]-]/g, '')
    .replace(/\s/g, '')
    .length;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.sheet },
  disabledControl: { opacity: 0.55 },
  saveButtonDisabled: { opacity: 0.6 },
  musicShare: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  readingShare: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  domEditor: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  meta: { minHeight: 34, paddingHorizontal: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { color: colors.inkFaint, fontSize: typography.size.meta },
  locationButton: { maxWidth: '76%', minHeight: 30, paddingRight: spacing.sm, flexDirection: 'row', gap: 5, alignItems: 'center' },
  locationButtonPressed: { opacity: 0.58 },
  locationButtonText: { flexShrink: 1, color: colors.inkFaint, fontSize: typography.size.meta },
  locationButtonTextActive: { color: colors.life, fontWeight: '700' },
  toolbarStage: { paddingHorizontal: spacing.md, paddingTop: 5, paddingBottom: spacing.sm, gap: 8, backgroundColor: colors.sheet },
  toolbar: { height: 58, flexGrow: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 29, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.13, shadowRadius: 16, elevation: 9 },
  toolbarContent: { minWidth: '100%', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 2 },
  moreBar: { flexGrow: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 23, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 6 },
  expandedToolbarContent: { gap: 4, paddingHorizontal: 7, paddingVertical: 6 },
  tableContextBar: { height: 50, padding: 3, flexDirection: 'row', alignItems: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.sm, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  tableAction: { minWidth: 0, minHeight: 44, flex: 1, paddingHorizontal: 3, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.lineSoft },
  tableActionActive: { backgroundColor: colors.lifeLight },
  tableActionDestructive: { borderRightWidth: 0, backgroundColor: colors.dangerLight },
  tableActionPressed: { backgroundColor: colors.paper },
  tableActionText: { flexShrink: 1, color: colors.inkSoft, fontSize: 10, fontWeight: '700' },
  tableActionTextActive: { color: colors.life },
  tableActionTextDestructive: { color: colors.danger },
  toolButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  toolButtonActive: { backgroundColor: colors.lifeLight },
  toolButtonPressed: { backgroundColor: colors.paper, transform: [{ scale: 0.92 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  imageSourceSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  imageSourceOption: { minHeight: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  imageSourceOptionPressed: { opacity: 0.58 },
  imageSourceOptionText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  imageSourceCancel: { minHeight: 54, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  imageSourceCancelText: { color: colors.inkSoft, fontSize: 14, fontWeight: '600' },
  personSheet: { maxHeight: '72%', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  locationSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  locationSheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  locationSheetHint: { marginTop: 5, marginBottom: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  locationOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  locationOptionIcon: { width: 38, alignItems: 'flex-start' },
  locationOptionText: { flex: 1, color: colors.ink, fontSize: 14 },
  customLocationBlock: { marginTop: spacing.lg },
  customLocationLabel: { marginBottom: spacing.sm, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' },
  customLocationRow: { minHeight: 50, paddingLeft: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  customLocationInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 14 },
  customLocationApply: { minWidth: 58, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  customLocationApplyText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginVertical: spacing.md, borderRadius: 2, backgroundColor: colors.line },
  personSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  personSheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  personCount: { marginTop: 4, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  sheetClose: { minWidth: 52, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  sheetCloseText: { color: colors.life, fontSize: 12, fontWeight: '700' },
  personList: { flexGrow: 0 },
  personRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  avatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.life },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 17 },
  personInfo: { flex: 1, marginLeft: spacing.md },
  personName: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  personRelation: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta },
  personSelect: { color: colors.life, fontSize: typography.size.meta },
  personSelected: { color: colors.danger, fontWeight: '700' },
  quickCreate: { minHeight: 58, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  personInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 14 },
  createButton: { minWidth: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  createButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  centeredBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.backdropStrong },
  linkCard: { width: '100%', maxWidth: 420, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  linkTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  linkHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 16 },
  linkInput: { height: 50, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  linkActions: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end' },
  linkAction: { minWidth: 62, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  linkCancel: { color: colors.inkSoft, fontSize: 11 },
  linkConfirm: { color: colors.life, fontSize: 11, fontWeight: '700' },
}));
