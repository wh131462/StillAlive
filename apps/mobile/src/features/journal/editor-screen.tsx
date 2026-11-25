import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { ImagePickerAsset } from 'expo-image-picker';
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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
import { haptic } from '../../shared/haptics';
import { markNewPost } from '../../shared/new-post-signal';
import type { DayKey, Media, ReadingNoteSource } from '@still-alive/types';
import { toDayKey } from '../../shared/core/day-key';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import RichTextEditor from './rich-text-editor.dom';
import type { EditorCommand, EditorCommandType, EditorMediaSource } from './rich-text-editor.types';
import { useAppState } from '../../application/state/app-state';
import { useAi } from '../../application/ai/ai-provider';
import { buildEditorMessages } from '../../application/ai/ai-tasks';
import type { EditorAiAction } from '../../application/ai/ai-tasks';
import { aiErrorMessage } from '../ai/ai-copy';
import { isAiRequestError } from '../../infrastructure/ai/ai-types';
import * as Clipboard from 'expo-clipboard';
import { createThemedStyles, editorTheme } from '../../shared/theme/app-theme';
import { persistPickedMedia, persistVoiceRecording } from '../../infrastructure/files/local-media';
import { resolveDeviceLocation, warmDeviceLocation } from '../../infrastructure/platform/device-location';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { pickMediaFromCamera, pickMediaFromLibrary } from '../../infrastructure/platform/media-picker';
import { extractEmbeddedMediaIds } from './embedded-media';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { personDisplayName } from '../people/person-profile';
import { MusicShareCard } from '../../application/components/music-share-card';
import { ReadingShareCard } from '../../application/components/reading-share-card';
import { createMusicShare, extractMusicShares, withMusicShare, withoutMusicShares } from '../../application/music-share';
import type { MusicShare } from '../../application/music-share';
import { withReadingSourceQuote, withoutReadingSourceQuote } from '../../application/reading-share';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { DatePickerField, TimePickerField } from '../people/date-time-picker';
import type { DateParts } from '../people/date-time-picker';

export default function EditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { dayKey: requestedDayKey, musicTrackId, personId, postId, sourceBookId, sourceExcerptId } = useLocalSearchParams<{ dayKey?: string; musicTrackId?: string; personId?: string; postId?: string; sourceBookId?: string; sourceExcerptId?: string }>();
  const { bookExcerpts, books, createPerson, deleteReadingNoteSource, discardMedia, getPersonIdsByPost, loadDraft, media, musicTracks, people, posts, readingNoteSources, ready, saveDraft, saveMedia, savePost, saveReadingNoteSource, today, todayCheckIn, updatePost } = useAppState();
  const initializedRef = useRef(false);
  const allowExitRef = useRef(false);
  const initialBodyRef = useRef('');
  const initialPersonIdsRef = useRef<string[]>([]);
  const initialLocationRef = useRef<string | null>(null);
  const locationRequestRef = useRef(0);
  const initialMusicShareRef = useRef<MusicShare | null>(null);
  const initialReadingSourceRef = useRef<ReadingNoteSource | null>(null);
  const createdMediaRef = useRef<Media[]>([]);
  const bodyTouchedRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftQueueRef = useRef(Promise.resolve());
  const pendingDraftSaveRef = useRef<Promise<void> | null>(null);
  const commandIdRef = useRef(0);
  const [body, setBody] = useState('');
  const [musicShare, setMusicShare] = useState<MusicShare | null>(null);
  const [readingSourceRemoved, setReadingSourceRemoved] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [command, setCommand] = useState<EditorCommand | null>(null);
  const ai = useAi();
  const [aiActionSheetOpen, setAiActionSheetOpen] = useState(false);
  const [aiRunningAction, setAiRunningAction] = useState<EditorAiAction | null>(null);
  const [aiPreview, setAiPreview] = useState<{ action: EditorAiAction; text: string } | null>(null);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const aiAbortRef = useRef<AbortController | null>(null);
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
  const [dateCardDraft, setDateCardDraft] = useState<{ value: string; kind: 'date' | 'datetime'; index: number } | null>(null);
  const [dateCardParts, setDateCardParts] = useState<DateParts | null>(null);
  const [dateCardHour, setDateCardHour] = useState(0);
  const [dateCardMinute, setDateCardMinute] = useState(0);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState('');
  const [locating, setLocating] = useState<'address' | 'city' | null>(null);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const draftStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
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
    if (readingSourceRemoved) return null;
    if (postId) return readingNoteSources.find((source) => source.postId === postId) ?? null;
    if (!sourceBook || (sourceExcerptId && !sourceExcerpt)) return null;
    return {
      postId: '',
      bookId: sourceBook.id,
      excerptIds: sourceExcerpt ? [sourceExcerpt.id] : [],
      quoteSnapshots: [{ bookTitle: sourceBook.title, text: sourceExcerpt?.text ?? '', location: sourceExcerpt?.location ?? null }],
    };
  }, [postId, readingNoteSources, readingSourceRemoved, sourceBook, sourceExcerpt, sourceExcerptId]);
  const readingSourceBook = sourceBook ?? (readingSource?.bookId ? books.find((book) => book.id === readingSource.bookId) ?? null : null);
  const headerSubtitle = draftStatus || (readingSource ? '写下这段阅读留给你的感受' : musicShare ? '写下这首歌留给你的感受' : postId ? '修改并完善这条记录' : isPastEntry ? '补写那天想留下的内容' : '写下此刻想留下的内容');
  const editorBusy = saving || saved || audioSaving || mediaSaving || relationsLoading;

  useEffect(() => () => { locationRequestRef.current += 1; }, []);

  useEffect(() => {
    if (!ready || initializedRef.current) return;
    if (postId) {
      const post = posts.find((item) => item.id === postId);
      if (!post) {
        feedback.alert('记录不存在', '它可能已经被删除。', [{ text: '返回', onPress: () => { allowExitRef.current = true; router.back(); } }]);
        return;
      }
      initializedRef.current = true;
      const sharedMusic = extractMusicShares(post.bodyMarkdown)[0] ?? null;
      const currentReadingSource = readingNoteSources.find((source) => source.postId === post.id) ?? null;
      const currentBook = currentReadingSource?.bookId ? books.find((book) => book.id === currentReadingSource.bookId) ?? null : null;
      const visibleBody = withoutReadingSourceQuote(withoutMusicShares(post.bodyMarkdown), currentReadingSource, currentBook);
      initialBodyRef.current = visibleBody;
      initialMusicShareRef.current = sharedMusic;
      initialReadingSourceRef.current = currentReadingSource;
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
    initialReadingSourceRef.current = readingSource;
    const shareEntry = Boolean(hasReadingSource || sharedTrack);
    const draftTask = shareEntry ? saveDraft('', targetDay).then(() => null) : loadDraft(targetDay);
    void draftTask.then((draft) => {
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
  }, [bookExcerpts, books, getPersonIdsByPost, loadDraft, musicTrackId, musicTracks, postId, posts, readingNoteSources, readingSource, ready, router, saveDraft, sourceBook, sourceBookId, sourceExcerpt, sourceExcerptId, targetDay, today, todayCheckIn]);

  useEffect(() => {
    if (personId && people.some((person) => person.id === personId)) {
      setSelectedPersonIds((current) => current.includes(personId) ? current : [...current, personId]);
    }
  }, [people, personId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

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
        if (pendingDraftSaveRef.current === task) {
          setDraftSaveFailed(false);
          setDraftStatus(`已保存 · ${formatClockTime()}`);
          scheduleDraftStatusReset();
        }
      }).catch(() => {
        if (pendingDraftSaveRef.current === task) {
          setDraftSaveFailed(true);
          setDraftStatus('草稿保存失败');
        }
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
    if (!createdMediaRef.current.length && !hasUnsavedContent(body, musicShare, readingSource, postId, initialBodyRef.current, initialMusicShareRef.current, initialReadingSourceRef.current, selectedPersonIds, initialPersonIdsRef.current, locationName, initialLocationRef.current)) return;
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
    return media.filter((item) => ids.has(item.id)).map((item) => ({ id: item.id, mimeType: item.mimeType, uri: editorMediaUri(item) }));
  }, [body, media]);

  const handleBodyChange = (markdown: string) => {
    bodyTouchedRef.current = true;
    setBody(markdown);
  };

  const sendCommand = (type: EditorCommandType, value?: EditorCommand['value']) => {
    commandIdRef.current += 1;
    setCommand({ id: commandIdRef.current, type, value });
  };

  const openDateCardPicker = (value: string, kind: 'date' | 'datetime', index: number) => {
    const date = parseDateCardValue(value);
    setDateCardDraft({ value, kind, index });
    setDateCardParts({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
    setDateCardHour(date.getHours());
    setDateCardMinute(date.getMinutes());
    Keyboard.dismiss();
  };

  const confirmDateCardPicker = () => {
    if (!dateCardDraft || !dateCardParts) return;
    const next = `${dateCardParts.year}-${pad2(dateCardParts.month)}-${pad2(dateCardParts.day)}${dateCardDraft.kind === 'datetime' ? `T${pad2(dateCardHour)}:${pad2(dateCardMinute)}` : ''}`;
    if (dateCardDraft.value) sendCommand('updateDateCard', { from: dateCardDraft.value, to: next, kind: dateCardDraft.kind, index: dateCardDraft.index });
    setDateCardDraft(null);
  };

  const setTextSize = (type: 'paragraph' | 'heading1' | 'heading2' | 'heading3') => {
    sendCommand(type);
    setShowTextSize(false);
  };

  const scheduleDraftStatusReset = () => {
    if (draftStatusTimerRef.current) clearTimeout(draftStatusTimerRef.current);
    draftStatusTimerRef.current = setTimeout(() => {
      draftStatusTimerRef.current = null;
      setDraftStatus('');
    }, 2200);
  };

  const retryDraftSave = () => {
    if (postId) return;
    bodyTouchedRef.current = true;
    setDraftSaveFailed(false);
    setDraftStatus('保存中…');
    const task = draftQueueRef.current.catch(() => undefined).then(() => saveDraft(withReadingSourceQuote(withMusicShare(body, musicShare), readingSource, readingSourceBook), targetDay));
    draftQueueRef.current = task;
    pendingDraftSaveRef.current = task;
    void task.then(() => {
      setDraftSaveFailed(false);
      setDraftStatus(`已保存 · ${formatClockTime()}`);
      scheduleDraftStatusReset();
    }).catch(() => {
      setDraftSaveFailed(true);
      setDraftStatus('草稿保存失败');
    }).finally(() => {
      if (pendingDraftSaveRef.current === task) pendingDraftSaveRef.current = null;
    });
  };

  useEffect(() => () => {
    if (draftStatusTimerRef.current) clearTimeout(draftStatusTimerRef.current);
  }, []);

  const handleSave = async () => {
    if (editorBusy) return;
    const value = body.trim();
    if (!value && !musicShare && !readingSource) {
      feedback.alert('还没有内容', '写下一点内容或录一段语音后再记下。');
      return;
    }
    const savedBody = withReadingSourceQuote(withMusicShare(value, musicShare), readingSource, readingSourceBook);
    closeLocationPicker();
    try {
      setSaving(true);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
      await draftQueueRef.current.catch(() => undefined);
      if (postId) {
        await updatePost(postId, savedBody, selectedPersonIds, locationName);
        if (!readingSource) await deleteReadingNoteSource(postId);
      }
      else {
        const createdPost = await savePost(savedBody, selectedPersonIds, targetDay, locationName);
        markNewPost(createdPost.id);
        if (readingSource) await saveReadingNoteSource({ ...readingSource, postId: createdPost.id });
      }
      const created = createdMediaRef.current;
      createdMediaRef.current = [];
      await Promise.all(created.map(discardMedia)).catch(() => undefined);
      allowExitRef.current = true;
      Keyboard.dismiss();
      setSaving(false);
      setSaved(true);
      setDraftSaveFailed(false);
      setDraftStatus(`已记下 · ${formatClockTime()}`);
      haptic('success');
      await new Promise((resolve) => setTimeout(resolve, 650));
      if (musicTrackId && !postId) router.replace('/');
      else if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (cause: unknown) {
      setSaving(false);
      setSaved(false);
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const saveDraftAfterShareChange = (nextMusicShare: MusicShare | null, nextReadingSource: ReadingNoteSource | null) => {
    if (postId) return;
    bodyTouchedRef.current = true;
    const task = draftQueueRef.current.catch(() => undefined).then(() => saveDraft(withReadingSourceQuote(withMusicShare(body, nextMusicShare), nextReadingSource, readingSourceBook), targetDay));
    draftQueueRef.current = task;
    setDraftStatus('保存中…');
    void task.then(() => setDraftStatus('刚刚已保存')).catch(() => setDraftStatus('草稿保存失败'));
  };

  const removeMusicShare = () => {
    setMusicShare(null);
    saveDraftAfterShareChange(null, readingSource);
  };

  const removeReadingSource = () => {
    setReadingSourceRemoved(true);
    saveDraftAfterShareChange(musicShare, null);
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
      sendCommand('audio', { durationMs, id: item.id, uri: editorMediaUri(item) });
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
      const editorMediaItems = importedItems.map((item) => ({ id: item.id, mimeType: item.mimeType, uri: editorMediaUri(item), alt: item.mimeType.startsWith('video/') ? '视频' : '照片' }));
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

  const handleTakeMedia = async (mediaType: 'images' | 'videos') => {
    setImageSourcePickerOpen(false);
    if (editorBusy) return;
    const remaining = remainingMediaSlots();
    if (!remaining) return;

    const result = await pickMediaFromCamera({ mediaTypes: [mediaType], quality: 0.9 });
    if (result.canceled) return;
    await importPickedMedia(result.assets, remaining);
  };

  const handlePickImages = async () => {
    setImageSourcePickerOpen(false);
    if (editorBusy) return;
    const remaining = remainingMediaSlots();
    if (!remaining) return;

    const result = await pickMediaFromLibrary({
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

  const replaceImageFromSource = async (source: 'camera' | 'photos', mediaType: 'images' | 'videos' = 'images') => {
    const mediaId = replaceImageId;
    setReplaceImageSourcePickerOpen(false);
    setReplaceImageId(null);
    if (!mediaId || editorBusy) return;
    let replacement: Media | null = null;
    const result = source === 'camera'
      ? await pickMediaFromCamera({ mediaTypes: [mediaType], quality: 0.9 })
      : await pickMediaFromLibrary({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled) return;
    try {
      setMediaSaving(true);
      setDraftStatus('正在替换媒体…');
      replacement = await persistPickedMedia(result.assets[0]);
      await saveMedia(replacement);
      createdMediaRef.current = [...createdMediaRef.current, replacement];
      sendCommand('replaceImage', { ...replacement, alt: replacement.mimeType.startsWith('video/') ? '视频' : '照片', mimeType: replacement.mimeType, previousId: mediaId, uri: editorMediaUri(replacement) });
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
    warmDeviceLocation('city');
    setLocationPickerOpen(true);
  };

  const closeLocationPicker = () => {
    locationRequestRef.current += 1;
    setLocating(null);
    setLocationPickerOpen(false);
  };

  const useCurrentLocation = async (detail: 'address' | 'city') => {
    const requestId = ++locationRequestRef.current;
    try {
      setLocating(detail);
      if (!await ensureAppPermission('location')) return;
      if (requestId !== locationRequestRef.current) return;
      const location = await resolveDeviceLocation(detail);
      if (requestId !== locationRequestRef.current) return;
      setLocationName(detail === 'city' ? location.city : location.address);
      closeLocationPicker();
    } catch (cause: unknown) {
      if (requestId !== locationRequestRef.current) return;
      feedback.alert('暂时无法定位', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      if (requestId === locationRequestRef.current) setLocating(null);
    }
  };

  const useCustomLocation = () => {
    const value = customLocation.trim();
    if (!value) return;
    setLocationName(value);
    closeLocationPicker();
  };

  const confirmDeleteTable = () => {
    feedback.alert('删除整个表格？', '表格中的全部内容都会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '删除表格', style: 'destructive', onPress: () => sendCommand('tableDelete') },
    ]);
  };

  const openAiActions = () => {
    if (!ai.enabled) {
      feedback.alert('AI 功能未启用', '启用后可以让 AI 直接写一条，也可以润色、续写或起标题。', [
        { text: '取消', style: 'cancel' },
        { text: '去设置', onPress: () => router.push('/ai-settings' as never) },
      ]);
      return;
    }
    setAiActionSheetOpen(true);
  };

  const runAiAction = async (action: EditorAiAction, options?: { prompt?: string }) => {
    setAiActionSheetOpen(false);
    const draft = body.trim();
    if (action !== 'generate' && !draft) {
      feedback.alert('先写一点内容', '写几句之后，AI 才能接着帮你；也可以直接用「生成一条」。');
      return;
    }
    setAiPreview(null);
    setAiRunningAction(action);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const peopleNames = people.filter((person) => selectedPersonIds.includes(person.id)).map((person) => personDisplayName(person));
    try {
      const result = await ai.chat(buildEditorMessages({
        action,
        draft,
        dayKey: targetDay,
        prompt: options?.prompt ?? aiGeneratePrompt,
        locationName,
        people: peopleNames,
      }), {
        taskId: action === 'generate' ? 'editor.generate' : action === 'polish' ? 'editor.polish' : action === 'continue' ? 'editor.continue' : action === 'title' ? 'editor.title' : 'editor.organize',
        maxOutputTokens: action === 'title' ? 120 : action === 'generate' ? 900 : 800,
        temperature: action === 'generate' ? 0.7 : 0.55,
        signal: controller.signal,
      });
      setAiPreview({ action, text: result.text.trim() });
    } catch (cause) {
      if (!(isAiRequestError(cause) && cause.code === 'cancelled')) feedback.alert('AI 生成失败', aiErrorMessage(cause));
    } finally {
      setAiRunningAction(null);
      aiAbortRef.current = null;
    }
  };

  const cancelAiGeneration = () => {
    aiAbortRef.current?.abort();
    setAiRunningAction(null);
  };

  const applyAiPreview = (mode: 'replace' | 'append') => {
    if (!aiPreview) return;
    sendCommand(mode === 'replace' ? 'replaceBodyMarkdown' : 'appendMarkdown', aiPreview.text);
    haptic('success');
    feedback.notice(mode === 'replace' ? '已替换正文，可撤销' : '已追加到末尾');
    setAiPreview(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ToolPageHeader
          backDisabled={editorBusy}
          onBack={() => router.back()}
          right={<ToolPageHeaderTextAction disabled={editorBusy || recorderState.isRecording} emphasized label={saved ? '已记下' : saving ? '保存中' : mediaSaving ? '处理媒体' : audioSaving ? '保存语音' : relationsLoading ? '加载中' : '完成'} onPress={() => void handleSave()} />}
          subtitle={headerSubtitle}
          title={postId ? '编辑记录' : isPastEntry ? '补写记录' : '新建记录'}
        />

        {initialized && readingSource ? <View style={styles.readingShare}><ReadingShareCard compact={keyboardVisible} onRemove={removeReadingSource} source={readingSource} variant="composer" /></View> : null}
        {initialized && musicShare ? <View style={styles.musicShare}><MusicShareCard onRemove={removeMusicShare} share={musicShare} variant="composer" /></View> : null}

        {initialized ? (
          <RichTextEditor
            audioSaving={audioSaving}
            command={command}
            disabled={editorBusy}
            dom={{ allowFileAccess: true, allowFileAccessFromFileURLs: true, allowingReadAccessToURL: 'file://', keyboardDisplayRequiresUserAction: false, style: styles.domEditor }}
            initialMarkdown={initialBodyRef.current}
            media={editorMedia}
            onChange={handleBodyChange}
            onDateCardPress={openDateCardPicker}
            onFormatsChange={setActiveFormats}
            onMention={openPersonPicker}
            onReplaceImage={(mediaId) => void handleReplaceImage(mediaId)}
            onStopRecording={() => void stopRecording()}
            placeholder={readingSource ? '这段阅读让你想到了什么？\n从这里写下感受…' : musicShare ? '这首歌让你想起了什么？\n从这里写下感受…' : `${isPastEntry ? '那天' : '今天'}有什么，想让以后的自己记得？\n从这里开始写…`}
            recordingDurationMs={recorderState.isRecording ? recorderState.durationMillis : null}
            theme={editorTheme()}
          />
        ) : <View style={styles.domEditor} />}

        <View collapsable={false} pointerEvents={editorBusy ? 'none' : 'auto'} style={[styles.meta, editorBusy && styles.disabledControl]}>
          <Pressable accessibilityLabel={locationName ? `地点：${locationName}` : '添加地点'} accessibilityRole="button" onPress={openLocationPicker} style={({ pressed }) => [styles.locationButton, pressed && styles.locationButtonPressed]}>
            <SymbolView name={{ android: 'location_on', ios: 'mappin.and.ellipse', web: 'location_on' }} size={14} tintColor={locationName ? colors.life : colors.inkFaint} type="hierarchical" />
            <Text numberOfLines={1} style={[styles.locationButtonText, locationName && styles.locationButtonTextActive]}>{locationName ?? '所在位置'}</Text>
          </Pressable>
          <View style={styles.metaRight}>
            {draftSaveFailed ? <Pressable accessibilityRole="button" onPress={retryDraftSave} style={({ pressed }) => [styles.draftRetry, pressed && styles.draftRetryPressed]}><Text style={styles.draftRetryText}>重试保存草稿</Text></Pressable> : null}
            <Text style={styles.metaText}>{markdownTextLength(body)} 字</Text>
          </View>
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
              <ToolButton androidIcon="calendar_month" icon="calendar" label="插入日期" onPress={() => sendCommand('insertDate', currentDateCardValue())} />
              <ToolButton androidIcon="event" icon="calendar.badge.clock" label="插入时间和日历" onPress={() => sendCommand('insertDateTime', currentDateCardValue(true))} />
            </ScrollView>
          ) : null}

          <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.toolbar} contentContainerStyle={styles.toolbarContent}>
            <ToolButton active={activeFormats.includes('bold')} androidIcon="format_bold" icon="bold" label="粗体" onPress={() => sendCommand('bold')} />
            <ToolButton androidIcon="alternate_email" icon="at" label="提及人物" onPress={openPersonPicker} />
            <ToolButton androidIcon="perm_media" icon="photo.on.rectangle" label="插入图片或视频" onPress={openImageSourcePicker} />
            <ToolButton active={recorderState.isRecording} androidIcon="mic" icon="mic" label={recorderState.isRecording ? '停止录音' : '插入语音'} onPress={handleRecordPress} />
            {ai.enabled ? <ToolButton active={Boolean(aiRunningAction)} androidIcon="auto_awesome" icon="sparkles" label={aiRunningAction ? 'AI 生成中' : 'AI 写作'} onPress={openAiActions} /> : null}
            <ToolButton active={showMore} androidIcon="more_horiz" icon="ellipsis" label="更多格式" onPress={() => { setShowMore((value) => !value); setShowTextSize(false); }} />
          </ScrollView>
        </View>

        <DraggableBottomSheet accessibilityLabel="选择媒体来源，向下拖动关闭" accessibilityRole="menu" onClose={() => setImageSourcePickerOpen(false)} open={imageSourcePickerOpen} sheetStyle={styles.imageSourceSheet}>
              <ImageSourceOption label="拍摄照片" onPress={() => void handleTakeMedia('images')} />
              <ImageSourceOption label="拍摄视频" onPress={() => void handleTakeMedia('videos')} />
              <ImageSourceOption label="从手机相册选择" onPress={() => void handlePickImages()} />
              <Pressable accessibilityRole="button" onPress={() => setImageSourcePickerOpen(false)} style={({ pressed }) => [styles.imageSourceCancel, pressed && styles.imageSourceOptionPressed]}><Text style={styles.imageSourceCancelText}>取消</Text></Pressable>
        </DraggableBottomSheet>

        <DraggableBottomSheet accessibilityLabel="选择替换媒体来源，向下拖动关闭" accessibilityRole="menu" onClose={() => { setReplaceImageSourcePickerOpen(false); setReplaceImageId(null); }} open={replaceImageSourcePickerOpen} sheetStyle={styles.imageSourceSheet}>
              <ImageSourceOption label="拍摄照片" onPress={() => void replaceImageFromSource('camera', 'images')} />
              <ImageSourceOption label="拍摄视频" onPress={() => void replaceImageFromSource('camera', 'videos')} />
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
                    <View style={styles.avatar}><Text style={styles.avatarText}>{personDisplayName(person).slice(0, 1)}</Text></View>
                    <View style={styles.personInfo}><Text style={styles.personName}>{personDisplayName(person)}</Text><Text style={styles.personRelation}>{person.relationToMe ?? '还没有填写关系'}</Text></View>
                    <Text style={[styles.personSelect, selected && styles.personSelected]}>{selected ? '取消关联' : '提到'}</Text>
                  </Pressable>;
                })}
              </ScrollView>
              <View style={styles.quickCreate}>
                <TextInput onChangeText={setNewPersonName} onSubmitEditing={() => void handleCreatePerson()} placeholder="输入名字，快速创建人物" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.personInput} value={newPersonName} />
                <Pressable accessibilityRole="button" disabled={!newPersonName.trim()} onPress={() => void handleCreatePerson()} style={styles.createButton}><Text style={styles.createButtonText}>创建</Text></Pressable>
              </View>
        </DraggableBottomSheet>

        <DraggableBottomSheet keyboardAvoiding onClose={closeLocationPicker} open={locationPickerOpen} sheetStyle={styles.locationSheet}>
              <Text style={styles.locationSheetTitle}>所在位置</Text>
              <Text style={styles.locationSheetHint}>默认记录城市，详细地址需主动选择。</Text>
              <LocationOption androidIcon="location_off" icon="location.slash" label="不记录位置" onPress={() => { setLocationName(null); closeLocationPicker(); }} />
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

        <DraggableBottomSheet keyboardAvoiding onClose={() => setDateCardDraft(null)} open={Boolean(dateCardDraft)} sheetStyle={styles.dateCardSheet}>
          <View style={styles.dateCardHeader}>
            <Pressable accessibilityRole="button" onPress={() => setDateCardDraft(null)} style={styles.dateCardHeaderAction}><Text style={styles.dateCardCancel}>取消</Text></Pressable>
            <Text style={styles.dateCardTitle}>{dateCardDraft?.kind === 'datetime' ? '调整时间和日期' : '调整日期'}</Text>
            <Pressable accessibilityRole="button" onPress={confirmDateCardPicker} style={styles.dateCardHeaderAction}><Text style={styles.dateCardConfirm}>完成</Text></Pressable>
          </View>
          {dateCardParts ? <DatePickerField defaultValue={dateCardParts} fieldStyle={styles.dateCardPickerField} label="日期" maximumDate={new Date(2100, 11, 31)} value={dateCardParts} onChange={(value) => setDateCardParts(value)} /> : null}
          {dateCardDraft?.kind === 'datetime' ? <TimePickerField hour={dateCardHour} label="时间" minute={dateCardMinute} onChange={(hour, minute) => { setDateCardHour(hour); setDateCardMinute(minute); }} /> : null}
        </DraggableBottomSheet>

        <DraggableBottomSheet accessibilityLabel="AI 生成中" onClose={cancelAiGeneration} open={Boolean(aiRunningAction) && !aiPreview} sheetStyle={styles.aiSheet}>
          <View style={styles.aiGenerating}><ActivityIndicator color={colors.life} size="small" /><Text style={styles.aiGeneratingTitle}>AI 正在写</Text><Text style={styles.aiGeneratingHint}>生成完成后会先给你预览，不会自动写入正文。</Text><Pressable accessibilityRole="button" onPress={cancelAiGeneration} style={({ pressed }) => [styles.aiGeneratingCancel, pressed && styles.pressed]}><Text style={styles.aiGeneratingCancelText}>取消</Text></Pressable></View>
        </DraggableBottomSheet>

        <DraggableBottomSheet accessibilityLabel="AI 写作" keyboardAvoiding onClose={() => setAiActionSheetOpen(false)} open={aiActionSheetOpen} sheetStyle={styles.aiSheet}>
          <Text style={styles.aiSheetTitle}>AI 写作</Text>
          <Text style={styles.aiSheetHint}>可以直接生成一条新记录；结果先预览，不会自动保存。</Text>
          <View style={styles.aiGenerateBlock}>
            <TextInput
              maxLength={300}
              multiline
              onChangeText={setAiGeneratePrompt}
              placeholder="想写点什么？不填也可以，会按今天来写"
              placeholderTextColor={colors.inkFaint}
              style={styles.aiGenerateInput}
              value={aiGeneratePrompt}
            />
            <View style={styles.aiQuickRow}>
              {['今天下午的散步', '最近有点累', '今天发生的一件小事'].map((sample) => <Pressable accessibilityRole="button" key={sample} onPress={() => setAiGeneratePrompt(sample)} style={({ pressed }) => [styles.aiQuickChip, pressed && styles.pressed]}><Text style={styles.aiQuickText}>{sample}</Text></Pressable>)}
            </View>
            <Pressable accessibilityRole="button" onPress={() => void runAiAction('generate')} style={({ pressed }) => [styles.aiGenerateButton, pressed && styles.pressed]}><Text style={styles.aiGenerateButtonText}>直接生成一条</Text></Pressable>
          </View>
          <View style={styles.aiDividerRow}><View style={styles.aiDivider} /><Text style={styles.aiDividerText}>或基于当前草稿</Text><View style={styles.aiDivider} /></View>
          <AiActionOption disabled={!body.trim()} label="润色这段" hint="更顺、更具体，保留原意" onPress={() => void runAiAction('polish')} />
          <AiActionOption disabled={!body.trim()} label="继续写" hint="接着草稿再写 2–3 句" onPress={() => void runAiAction('continue')} />
          <AiActionOption disabled={!body.trim()} label="起一个标题" hint="不超过 14 个汉字" onPress={() => void runAiAction('title')} />
          <AiActionOption disabled={!body.trim()} label="整理成一条记录" hint="调整顺序、删掉重复" onPress={() => void runAiAction('organize')} />
        </DraggableBottomSheet>

        <DraggableBottomSheet accessibilityLabel="AI 生成结果" onClose={() => setAiPreview(null)} open={Boolean(aiPreview)} sheetStyle={styles.aiSheet}>
          <Text style={styles.aiSheetTitle}>{aiPreview?.action === 'title' ? 'AI 标题' : aiPreview?.action === 'generate' ? 'AI 写的记录' : 'AI 草稿'}</Text>
          <Text style={styles.aiSheetHint}>请确认后再写入正文；写入后仍可用撤销恢复。</Text>
          <ScrollView style={styles.aiPreviewScroll}><Text selectable style={styles.aiPreviewText}>{aiPreview?.text ?? ''}</Text></ScrollView>
          <View style={styles.aiPreviewActions}>
            <Pressable accessibilityRole="button" onPress={() => applyAiPreview('replace')} style={({ pressed }) => [styles.aiPrimary, pressed && styles.pressed]}><Text style={styles.aiPrimaryText}>替换正文</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => applyAiPreview('append')} style={({ pressed }) => [styles.aiSecondary, pressed && styles.pressed]}><Text style={styles.aiSecondaryText}>追加到末尾</Text></Pressable>
          </View>
          <View style={styles.aiPreviewActions}>
            <Pressable accessibilityRole="button" onPress={() => { if (aiPreview) void runAiAction(aiPreview.action); }} style={({ pressed }) => [styles.aiSecondary, pressed && styles.pressed]}><Text style={styles.aiSecondaryText}>再写一版</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { void Clipboard.setStringAsync(aiPreview?.text ?? ''); feedback.notice('已复制'); }} style={({ pressed }) => [styles.aiSecondary, pressed && styles.pressed]}><Text style={styles.aiSecondaryText}>复制</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setAiPreview(null)} style={({ pressed }) => [styles.aiSecondary, pressed && styles.pressed]}><Text style={styles.aiSecondaryText}>丢弃</Text></Pressable>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function editorMediaUri(item: Media): string {
  if (Platform.OS === 'web') return item.localPath;
  const routeName = `${encodeURIComponent(item.id)}${mediaFileExtension(item)}`;
  const query = `uri=${encodeURIComponent(item.localPath)}&mime=${encodeURIComponent(item.mimeType || 'application/octet-stream')}`;
  if (Platform.OS === 'android') return `https://media.stillalive.local/local/${routeName}?${query}`;
  return `stillalive-media://local/${routeName}?${query}`;
}

function mediaFileExtension(item: Media): string {
  const extension = item.localPath.split(/[?#]/, 1)[0]?.match(/\.[a-zA-Z0-9]+$/)?.[0];
  if (extension) return extension.toLowerCase();
  if (item.mimeType === 'video/quicktime') return '.mov';
  if (item.mimeType === 'video/x-m4v') return '.m4v';
  if (item.mimeType.startsWith('video/')) return '.mp4';
  if (item.mimeType === 'audio/mpeg') return '.mp3';
  if (item.mimeType.startsWith('audio/')) return '.m4a';
  if (item.mimeType === 'image/png') return '.png';
  if (item.mimeType === 'image/webp') return '.webp';
  if (item.mimeType === 'image/heic' || item.mimeType === 'image/heif') return '.heic';
  return '.jpg';
}

function AiActionOption({ disabled = false, hint, label, onPress }: { disabled?: boolean; hint: string; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.aiActionOption, disabled && styles.aiActionDisabled, pressed && styles.pressed]}><View style={styles.aiActionCopy}><Text style={styles.aiActionLabel}>{label}</Text><Text style={styles.aiActionHint}>{hint}</Text></View><Text style={styles.aiActionChevron}>›</Text></Pressable>;
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

function pad2(value: number): string { return String(value).padStart(2, '0'); }

function currentDateCardValue(withTime = false): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}${withTime ? `T${pad2(now.getHours())}:${pad2(now.getMinutes())}` : ''}`;
}

function parseDateCardValue(value: string): Date {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = (timePart ?? '').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function hasUnsavedContent(body: string, musicShare: MusicShare | null, readingSource: ReadingNoteSource | null, postId: string | undefined, initialBody: string, initialMusicShare: MusicShare | null, initialReadingSource: ReadingNoteSource | null, personIds: string[], initialPersonIds: string[], locationName: string | null, initialLocation: string | null): boolean {
  if (!postId) return body !== initialBody || Boolean(body.trim()) || JSON.stringify(musicShare) !== JSON.stringify(initialMusicShare) || JSON.stringify(readingSource) !== JSON.stringify(initialReadingSource);
  if (body !== initialBody) return true;
  if (JSON.stringify(musicShare) !== JSON.stringify(initialMusicShare)) return true;
  if (JSON.stringify(readingSource) !== JSON.stringify(initialReadingSource)) return true;
  if (locationName !== initialLocation) return true;
  return [...personIds].sort().join(',') !== [...initialPersonIds].sort().join(',');
}

function markdownTextLength(markdown: string): number {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[(?:date|datetime):[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]*\]\([^)]+\)/g, (value) => value.replace(/^\[|\]\([^)]+\)$/g, ''))
    .replace(/[#>*_~`|\[\]-]/g, '')
    .replace(/\s/g, '')
    .length;
}

function formatClockTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  draftRetry: { minHeight: 32, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.dangerLight },
  draftRetryPressed: { opacity: 0.7 },
  draftRetryText: { color: colors.danger, fontSize: 9, fontWeight: '700' },
  locationButton: { maxWidth: '76%', minHeight: 30, paddingRight: spacing.sm, flexDirection: 'row', gap: 5, alignItems: 'center' },
  locationButtonPressed: { opacity: 0.58 },
  locationButtonText: { flexShrink: 1, color: colors.inkFaint, fontSize: typography.size.meta },
  locationButtonTextActive: { color: colors.life, fontWeight: '700' },
  toolbarStage: { paddingHorizontal: spacing.md, paddingTop: 5, paddingBottom: spacing.sm, gap: 8, backgroundColor: colors.sheet },
  toolbar: { height: 58, flexGrow: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 29, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.13, shadowRadius: 16, elevation: 9 },
  toolbarContent: { minWidth: '100%', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 2 },
  moreBar: { flexGrow: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 23, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 6 },
  expandedToolbarContent: { gap: 4, paddingHorizontal: 7, paddingVertical: 6 },
  tableContextBar: { height: 50, padding: 3, flexDirection: 'row', alignItems: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 6, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
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
  imageSourceCancel: { minHeight: 54, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.paper },
  imageSourceCancelText: { color: colors.inkSoft, fontSize: 14, fontWeight: '600' },
  personSheet: { maxHeight: '72%', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  locationSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  dateCardSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  dateCardHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateCardPickerField: { marginTop: spacing.md },
  dateCardHeaderAction: { width: 56, minHeight: 44, justifyContent: 'center' },
  dateCardTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  dateCardCancel: { color: colors.inkSoft, fontSize: 11 },
  dateCardConfirm: { color: colors.life, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  locationSheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  locationSheetHint: { marginTop: 5, marginBottom: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  locationOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  locationOptionIcon: { width: 38, alignItems: 'flex-start' },
  locationOptionText: { flex: 1, color: colors.ink, fontSize: 14 },
  customLocationBlock: { marginTop: spacing.lg },
  customLocationLabel: { marginBottom: spacing.sm, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' },
  customLocationRow: { minHeight: 50, paddingLeft: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: 6, backgroundColor: colors.paper },
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
  quickCreate: { minHeight: 58, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: 6, backgroundColor: colors.paper },
  personInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 14 },
  createButton: { minWidth: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  createButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  centeredBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.backdropStrong },
  linkCard: { width: '100%', maxWidth: 420, padding: spacing.lg, borderRadius: 6, backgroundColor: colors.sheet },
  linkTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  linkHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 16 },
  linkInput: { height: 50, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: 6, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  linkActions: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end' },
  linkAction: { minWidth: 62, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  linkCancel: { color: colors.inkSoft, fontSize: 11 },
  linkConfirm: { color: colors.life, fontSize: 11, fontWeight: '700' },
  aiSheet: { paddingBottom: spacing.lg },
  aiSheetTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  aiSheetHint: { paddingHorizontal: spacing.lg, marginTop: 5, marginBottom: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  aiGenerateBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  aiGenerateInput: { minHeight: 84, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: typography.size.body, textAlignVertical: 'top' },
  aiQuickRow: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  aiQuickChip: { minHeight: 32, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.sheet },
  aiQuickText: { color: colors.life, fontSize: typography.size.meta },
  aiGenerateButton: { marginTop: spacing.md, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  aiGenerateButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  aiDividerRow: { marginHorizontal: spacing.lg, marginVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiDivider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineSoft },
  aiDividerText: { color: colors.inkFaint, fontSize: typography.size.meta },
  aiActionDisabled: { opacity: 0.4 },
  aiActionOption: { minHeight: 62, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  aiActionCopy: { minWidth: 0, flex: 1 },
  aiActionLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  aiActionHint: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta },
  aiActionChevron: { marginLeft: spacing.md, color: colors.inkFaint, fontSize: 20 },
  aiPreviewScroll: { maxHeight: 240, marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper },
  aiPreviewText: { color: colors.ink, fontSize: typography.size.body, lineHeight: 22 },
  aiPreviewActions: { marginTop: spacing.md, marginHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  aiPrimary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  aiPrimaryText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  aiSecondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.sheet },
  aiSecondaryText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  aiGenerating: { minHeight: 180, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  aiGeneratingTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  aiGeneratingHint: { marginTop: 6, color: colors.inkFaint, fontSize: typography.size.meta, textAlign: 'center' },
  aiGeneratingCancel: { minHeight: 42, marginTop: spacing.lg, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  aiGeneratingCancelText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  pressed: { opacity: 0.7 },
}));
