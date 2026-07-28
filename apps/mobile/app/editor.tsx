import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import {
  Alert,
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
import type { DayKey, Media } from '@still-alive/types';
import { toDayKey } from '@still-alive/core';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import RichTextEditor from '../src/components/rich-text-editor.dom';
import type { EditorCommand, EditorCommandType, EditorMediaSource } from '../src/components/rich-text-editor.types';
import { useAppState } from '../src/state/app-state';
import { persistPickedImage, persistVoiceRecording } from '../src/data/local-media';
import { extractEmbeddedMediaIds } from '../src/domain/embedded-media';

export default function EditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { dayKey: requestedDayKey, personId, postId } = useLocalSearchParams<{ dayKey?: string; personId?: string; postId?: string }>();
  const { createPerson, discardMedia, getPersonIdsByPost, loadDraft, media, people, posts, ready, replaceMedia, saveDraft, saveMedia, savePost, today, todayCheckIn, updatePost } = useAppState();
  const initializedRef = useRef(false);
  const allowExitRef = useRef(false);
  const initialBodyRef = useRef('');
  const initialPersonIdsRef = useRef<string[]>([]);
  const createdAudioRef = useRef<Media[]>([]);
  const commandIdRef = useRef(0);
  const [body, setBody] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [command, setCommand] = useState<EditorCommand | null>(null);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [draftStatus, setDraftStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [audioSaving, setAudioSaving] = useState(false);
  const editingPost = posts.find((item) => item.id === postId);
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const targetDay = editingPost?.dayKey ?? validPastDay(requestedDayKey, today);
  const isPastEntry = !postId && targetDay !== today;
  const headerSubtitle = draftStatus || (postId ? '修改并完善这条记录' : isPastEntry ? '补写那天想留下的内容' : '写下此刻想留下的内容');

  useEffect(() => {
    if (!ready || initializedRef.current) return;
    if (postId) {
      const post = posts.find((item) => item.id === postId);
      if (!post) {
        Alert.alert('日记不存在', '它可能已经被删除。', [{ text: '返回', onPress: () => router.back() }]);
        return;
      }
      initializedRef.current = true;
      initialBodyRef.current = post.bodyMarkdown;
      setBody(post.bodyMarkdown);
      setInitialized(true);
      void getPersonIdsByPost(post.id).then((ids) => {
        initialPersonIdsRef.current = ids;
        setSelectedPersonIds(ids);
      });
      return;
    }
    if (targetDay === today && !todayCheckIn) {
      router.replace('/');
      return;
    }
    initializedRef.current = true;
    void loadDraft(targetDay).then((draft) => {
      initialBodyRef.current = draft?.bodyMarkdown ?? '';
      setBody(draft?.bodyMarkdown ?? '');
      setInitialized(true);
    });
  }, [getPersonIdsByPost, loadDraft, postId, posts, ready, router, targetDay, today, todayCheckIn]);

  useEffect(() => {
    if (personId && people.some((person) => person.id === personId)) {
      setSelectedPersonIds((current) => current.includes(personId) ? current : [...current, personId]);
    }
  }, [people, personId]);

  useEffect(() => {
    if (postId || !body) return;
    setDraftStatus('保存中…');
    const timer = setTimeout(() => {
      void saveDraft(body, targetDay).then(() => setDraftStatus('刚刚已保存'));
    }, 450);
    return () => clearTimeout(timer);
  }, [body, postId, saveDraft, targetDay]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowExitRef.current || (!recorderState.isRecording && !hasUnsavedContent(body, postId, initialBodyRef.current, selectedPersonIds, initialPersonIdsRef.current))) return;
    event.preventDefault();
    if (recorderState.isRecording) {
      Alert.alert('正在录音', '停止录音后才能离开这条记录。');
      return;
    }
    Alert.alert(
      postId ? '放弃这次修改？' : '先退出编写？',
      postId ? '尚未保存的修改会丢失。' : '正文会保留在本地草稿中，下次可以继续。',
      [
        { text: '继续编写', style: 'cancel' },
        {
          text: postId ? '放弃修改' : '退出，保留草稿',
          style: postId ? 'destructive' : 'default',
          onPress: () => {
            allowExitRef.current = true;
            const leave = () => navigation.dispatch(event.data.action);
            if (!postId && body) {
              void saveDraft(body, targetDay).then(leave, leave);
            } else if (postId && createdAudioRef.current.length) {
              void Promise.all(createdAudioRef.current.map(discardMedia)).then(leave, leave);
            } else leave();
          },
        },
      ],
    );
  }), [body, discardMedia, navigation, postId, recorderState.isRecording, saveDraft, selectedPersonIds, targetDay]);

  const editorMedia = useMemo<EditorMediaSource[]>(() => {
    const ids = new Set(extractEmbeddedMediaIds(body));
    return media.filter((item) => ids.has(item.id)).map((item) => ({ id: item.id, uri: item.localPath }));
  }, [body, media]);

  const handleBodyChange = (markdown: string) => {
    setBody(markdown);
    const referencedIds = new Set(extractEmbeddedMediaIds(markdown));
    const removed = createdAudioRef.current.filter((item) => !referencedIds.has(item.id));
    if (!removed.length) return;
    createdAudioRef.current = createdAudioRef.current.filter((item) => referencedIds.has(item.id));
    void Promise.all(removed.map(discardMedia));
  };

  const sendCommand = (type: EditorCommandType, value?: EditorCommand['value']) => {
    commandIdRef.current += 1;
    setCommand({ id: commandIdRef.current, type, value });
  };

  const handleSave = async () => {
    if (audioSaving) return;
    const value = body.trim();
    if (!value) {
      Alert.alert('还没有内容', '写下一点内容或录一段语音后再记下。');
      return;
    }
    try {
      setSaving(true);
      if (postId) await updatePost(postId, value, selectedPersonIds);
      else await savePost(value, selectedPersonIds, targetDay);
      allowExitRef.current = true;
      router.back();
    } catch (cause: unknown) {
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const beginRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('无法使用麦克风', '请在系统设置中允许“仍在”使用麦克风。');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      sendCommand('recordingStart');
      setDraftStatus('正在录音…');
    } catch (cause: unknown) {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      Alert.alert('录音失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const startRecording = async () => {
    if (recorderState.isRecording || audioSaving) return;
    if (Platform.OS === 'web') {
      Alert.alert('当前设备暂不支持', '请在 iOS 或 Android 客户端中录入语音。');
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
      createdAudioRef.current = [...createdAudioRef.current, item];
      sendCommand('audio', { durationMs, id: item.id, uri: item.localPath });
      setDraftStatus('语音已保存到本机');
    } catch (cause: unknown) {
      if (importedAudio) await discardMedia(importedAudio);
      sendCommand('recordingCancel');
      Alert.alert('语音保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
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

  const openPersonPicker = () => setPersonPickerOpen(true);

  const selectPerson = (person: { id: string; name: string }) => {
    const alreadySelected = selectedPersonIds.includes(person.id);
    if (!alreadySelected && selectedPersonIds.length >= 10) {
      Alert.alert('最多提及 10 个人物', '这条记录已经提及了 10 个人物。');
      return;
    }
    if (!alreadySelected) setSelectedPersonIds((current) => [...current, person.id]);
    sendCommand('mention', person.name);
    setPersonPickerOpen(false);
  };

  const handleCreatePerson = async () => {
    const name = newPersonName.trim();
    if (!name) return;
    if (selectedPersonIds.length >= 10) {
      Alert.alert('最多提及 10 个人物', '这条记录已经提及了 10 个人物。');
      return;
    }
    try {
      const person = await createPerson(name);
      setNewPersonName('');
      selectPerson(person);
    } catch (cause: unknown) {
      Alert.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const handlePickImages = async () => {
    const importedItems: Media[] = [];
    const currentCount = [...body.matchAll(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/g)].length;
    const remaining = 9 - currentCount;
    if (remaining <= 0) {
      Alert.alert('最多添加 9 张图片', '可以先删除一张，再添加新的图片。');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('无法访问照片', '请在系统设置中允许“仍在”访问照片。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.9,
      selectionLimit: remaining,
    });
    if (result.canceled) return;

    try {
      setDraftStatus('正在保存图片…');
      for (const asset of result.assets.slice(0, remaining)) {
        const item = await persistPickedImage(asset);
        importedItems.push(item);
        await saveMedia(item);
      }
      sendCommand('images', importedItems.map((item) => ({ id: item.id, uri: item.localPath, alt: '照片' })));
      setDraftStatus('图片已保存到本机');
    } catch (cause: unknown) {
      for (const item of importedItems) await discardMedia(item);
      Alert.alert('图片保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
      setDraftStatus('本地草稿');
    }
  };

  const handleReplaceImage = async (mediaId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('无法访问照片', '请在系统设置中允许“仍在”访问照片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    try {
      setDraftStatus('正在替换图片…');
      const replacement = await persistPickedImage(result.assets[0]);
      await replaceMedia(mediaId, replacement);
      setDraftStatus('图片已替换');
    } catch (cause: unknown) {
      Alert.alert('图片替换失败', cause instanceof Error ? cause.message : '请稍后重试。');
      setDraftStatus('本地草稿');
    }
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert('链接格式不正确', '请输入以 http:// 或 https:// 开头的地址。');
      return;
    }
    sendCommand('link', url);
    setLinkPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
            <SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.ink} type="hierarchical" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{postId ? '编辑记录' : isPastEntry ? '补写记录' : '新建记录'}</Text>
            <Text style={styles.statusText}>{headerSubtitle}</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={saving || audioSaving || recorderState.isRecording} onPress={() => void handleSave()} style={[styles.saveButton, (saving || audioSaving || recorderState.isRecording) && styles.saveButtonDisabled]}>
            <Text style={styles.saveText}>{saving ? '保存中' : audioSaving ? '保存语音' : '完成'}</Text>
          </Pressable>
        </View>

        {initialized ? (
          <RichTextEditor
            audioSaving={audioSaving}
            command={command}
            dom={{ allowFileAccess: true, keyboardDisplayRequiresUserAction: false, style: styles.domEditor }}
            initialMarkdown={initialBodyRef.current}
            media={editorMedia}
            onChange={handleBodyChange}
            onFormatsChange={setActiveFormats}
            onMention={openPersonPicker}
            onReplaceImage={(mediaId) => void handleReplaceImage(mediaId)}
            onStopRecording={() => void stopRecording()}
            placeholder={`${isPastEntry ? '那天' : '今天'}有什么，想让以后的自己记得？\n从这里开始写…`}
            recordingDurationMs={recorderState.isRecording ? recorderState.durationMillis : null}
          />
        ) : <View style={styles.domEditor} />}

        <View style={styles.meta}>
          <Text style={styles.metaText}>{markdownTextLength(body)} 字</Text>
        </View>

        <View style={styles.toolbarStage}>
          {showMore ? (
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.moreBar} contentContainerStyle={styles.expandedToolbarContent}>
              <ToolButton androidIcon="undo" icon="arrow.uturn.backward" label="撤销" onPress={() => sendCommand('undo')} />
              <ToolButton androidIcon="redo" icon="arrow.uturn.forward" label="重做" onPress={() => sendCommand('redo')} />
              <ToolButton androidIcon="format_paragraph" icon="paragraphsign" label="正文" onPress={() => sendCommand('paragraph')} />
              <ToolButton androidIcon="format_size" icon="textformat.size.larger" iconSize={22} label="标题 1" onPress={() => sendCommand('heading1')} />
              <ToolButton androidIcon="format_size" icon="textformat.size.larger" iconSize={19} label="标题 2" onPress={() => sendCommand('heading2')} />
              <ToolButton androidIcon="format_size" icon="textformat.size.larger" iconSize={17} label="标题 3" onPress={() => sendCommand('heading3')} />
              <ToolButton active={activeFormats.includes('italic')} androidIcon="format_italic" icon="italic" label="斜体" onPress={() => sendCommand('italic')} />
              <ToolButton active={activeFormats.includes('strikethrough')} androidIcon="format_strikethrough" icon="strikethrough" label="删除线" onPress={() => sendCommand('strikethrough')} />
              <ToolButton active={activeFormats.includes('inlineCode')} androidIcon="code" icon="chevron.left.forwardslash.chevron.right" label="行内代码" onPress={() => sendCommand('inlineCode')} />
              <ToolButton active={activeFormats.includes('quote')} androidIcon="format_quote" icon="text.quote" label="引用" onPress={() => sendCommand('quote')} />
              <ToolButton active={activeFormats.includes('orderedList')} androidIcon="format_list_numbered" icon="list.number" label="有序列表" onPress={() => sendCommand('orderedList')} />
              <ToolButton androidIcon="checklist" icon="checklist" label="任务列表" onPress={() => sendCommand('taskList')} />
              <ToolButton androidIcon="data_object" icon="curlybraces" label="代码块" onPress={() => sendCommand('codeBlock')} />
              <ToolButton androidIcon="link" icon="link" label="链接" onPress={() => setLinkPickerOpen(true)} />
              <ToolButton androidIcon="horizontal_rule" icon="minus" label="分隔线" onPress={() => sendCommand('horizontalRule')} />
              <ToolButton androidIcon="table" icon="tablecells" label="表格" onPress={() => sendCommand('table')} />
            </ScrollView>
          ) : null}

          <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.toolbar} contentContainerStyle={styles.toolbarContent}>
            <ToolButton active={activeFormats.includes('bold')} androidIcon="format_bold" icon="bold" label="粗体" onPress={() => sendCommand('bold')} />
            <ToolButton active={activeFormats.includes('bulletList')} androidIcon="format_list_bulleted" icon="list.bullet" label="无序列表" onPress={() => sendCommand('bulletList')} />
            <ToolButton androidIcon="alternate_email" icon="at" label="提及人物" onPress={openPersonPicker} />
            <ToolButton androidIcon="image" icon="photo" label="插入图片" onPress={() => void handlePickImages()} />
            <ToolButton active={recorderState.isRecording} androidIcon="mic" icon="mic" label={recorderState.isRecording ? '停止录音' : '插入语音'} onPress={handleRecordPress} />
            <ToolButton active={showMore} androidIcon="more_horiz" icon="ellipsis" label="更多格式" onPress={() => setShowMore((value) => !value)} />
          </ScrollView>
        </View>

        <Modal animationType="slide" onRequestClose={() => setPersonPickerOpen(false)} transparent visible={personPickerOpen}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPersonPickerOpen(false)}>
            <Pressable style={styles.personSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <View style={styles.personSheetHeader}>
                <View>
                  <Text style={styles.personSheetTitle}>提到谁？</Text>
                  <Text style={styles.personCount}>已提及 {selectedPersonIds.length} / 10</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setPersonPickerOpen(false)} style={styles.sheetClose}><Text style={styles.sheetCloseText}>完成</Text></Pressable>
              </View>
              <ScrollView style={styles.personList} keyboardShouldPersistTaps="handled">
                {people.map((person) => (
                  <Pressable key={person.id} accessibilityRole="button" onPress={() => selectPerson(person)} style={styles.personRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text></View>
                    <View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personRelation}>{person.relationToMe ?? '还没有填写关系'}</Text></View>
                    <Text style={styles.personSelect}>提到</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.quickCreate}>
                <TextInput onChangeText={setNewPersonName} onSubmitEditing={() => void handleCreatePerson()} placeholder="输入名字，快速创建人物" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.personInput} value={newPersonName} />
                <Pressable accessibilityRole="button" disabled={!newPersonName.trim()} onPress={() => void handleCreatePerson()} style={styles.createButton}><Text style={styles.createButtonText}>创建</Text></Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal animationType="fade" onRequestClose={() => setLinkPickerOpen(false)} transparent visible={linkPickerOpen}>
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
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToolButton({ active = false, androidIcon, icon, iconSize = 21, label, onPress }: { active?: boolean; androidIcon: AndroidSymbol; icon: SFSymbol; iconSize?: number; label: string; onPress(): void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.toolButton, active && styles.toolButtonActive, pressed && styles.toolButtonPressed]}>
      <SymbolView
        animationSpec={active ? { effect: { type: 'scale' }, speed: 1.4 } : undefined}
        name={{ android: androidIcon, ios: icon, web: androidIcon }}
        size={iconSize}
        tintColor={active ? colors.life : colors.inkSoft}
        type="hierarchical"
      />
    </Pressable>
  );
}

function validPastDay(value: string | undefined, today: DayKey): DayKey {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return today;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return toDayKey(parsed) === value ? value as DayKey : today;
}

function hasUnsavedContent(body: string, postId: string | undefined, initialBody: string, personIds: string[], initialPersonIds: string[]): boolean {
  if (!postId) return Boolean(body.trim());
  if (body !== initialBody) return true;
  return [...personIds].sort().join(',') !== [...initialPersonIds].sort().join(',');
}

function markdownTextLength(markdown: string): number {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]*\]\([^)]+\)/g, (value) => value.replace(/^\[|\]\([^)]+\)$/g, ''))
    .replace(/[#>*_~`|\[\]-]/g, '')
    .replace(/\s/g, '')
    .length;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.sheet },
  header: { minHeight: 62, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 54, minHeight: 48, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  statusText: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta },
  saveButton: { minWidth: 68, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.life },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  domEditor: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  meta: { minHeight: 28, paddingHorizontal: spacing.lg, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  metaText: { color: colors.inkFaint, fontSize: typography.size.meta },
  toolbarStage: { paddingHorizontal: spacing.md, paddingTop: 5, paddingBottom: spacing.sm, gap: 8, backgroundColor: colors.sheet },
  toolbar: { height: 58, flexGrow: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(32, 35, 31, 0.09)', borderRadius: 29, backgroundColor: '#FCFCF8', shadowColor: colors.ink, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.13, shadowRadius: 16, elevation: 9 },
  toolbarContent: { minWidth: '100%', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 2 },
  moreBar: { flexGrow: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(32, 35, 31, 0.08)', borderRadius: 23, backgroundColor: '#FCFCF8', shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 6 },
  expandedToolbarContent: { gap: 4, paddingHorizontal: 7, paddingVertical: 6 },
  toolButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  toolButtonActive: { backgroundColor: colors.lifeLight },
  toolButtonPressed: { backgroundColor: colors.paper, transform: [{ scale: 0.92 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 35, 31, 0.28)' },
  personSheet: { maxHeight: '72%', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
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
  quickCreate: { minHeight: 58, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  personInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 14 },
  createButton: { minWidth: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  createButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  centeredBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(32, 35, 31, 0.34)' },
  linkCard: { width: '100%', maxWidth: 420, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  linkTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  linkHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 16 },
  linkInput: { height: 50, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  linkActions: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end' },
  linkAction: { minWidth: 62, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  linkCancel: { color: colors.inkSoft, fontSize: 11 },
  linkConfirm: { color: colors.life, fontSize: 11, fontWeight: '700' },
});
