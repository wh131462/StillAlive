import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toDayKey } from '@still-alive/core';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Media, Post } from '@still-alive/types';
import { useAppState } from '../../src/state/app-state';

export default function TodayScreen() {
  const router = useRouter();
  const { checkInToday, checkIns, dismissBackupReminder, error, homeMemory, media, posts, preferences, ready, shouldShowBackupReminder, today, todayCheckIn, updatePreferences } = useAppState();
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const todayPosts = posts.filter((post) => post.dayKey === today);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const hasWritten = todayPosts.length > 0;
  const recordedDayCount = new Set([...checkIns.map((item) => item.dayKey), ...posts.map((post) => post.dayKey)]).size;
  const lastCheckInDay = checkIns[0]?.dayKey;
  const yesterday = toDayKey(new Date(new Date().setDate(new Date().getDate() - 1)));
  const returningAfterBreak = Boolean(lastCheckInDay && lastCheckInDay !== today && lastCheckInDay !== yesterday);
  const memoryImageId = homeMemory ? firstMediaId(homeMemory.post.bodyMarkdown) : null;
  const memoryImage = memoryImageId ? media.find((item) => item.id === memoryImageId) : null;

  useEffect(() => {
    setNickname(preferences.nickname);
    setBirthDate(preferences.birthDate);
  }, [preferences.birthDate, preferences.nickname]);

  const handlePrimaryAction = async () => {
    if (!todayCheckIn) {
      try {
        setCheckingIn(true);
        await checkInToday();
      } catch (cause: unknown) {
        Alert.alert('暂时无法打卡', cause instanceof Error ? cause.message : '请稍后重试。');
      } finally {
        setCheckingIn(false);
      }
      return;
    }
    router.push('/editor');
  };

  const completeOnboarding = async () => {
    const value = birthDate.trim();
    if (value && !validOptionalDate(value, today)) {
      Alert.alert('出生日期格式不正确', '请使用 YYYY-MM-DD，并且不能晚于今天。');
      return;
    }
    await updatePreferences({ onboardingCompleted: true, nickname: nickname.trim(), birthDate: value });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>仍在</Text>
            <Text style={styles.english}>STILL ALIVE</Text>
          </View>
          <Text style={styles.date}>{formatDisplayDate(new Date())}</Text>
        </View>

        <Text style={styles.kicker}>{recordedDayCount ? `DAY ${recordedDayCount} · ${recordedDayCount} 个坐标` : '从今天开始 · 留下第一个坐标'}</Text>
        <Text style={styles.title}>{returningAfterBreak ? '欢迎回来。' : preferences.nickname ? `早上好，${preferences.nickname}。` : '早上好。'}{`\n`}{returningAfterBreak ? '今天也可以重新开始。' : '今天，也在这里。'}</Text>
        {!ready ? <Text style={styles.stateMessage}>正在打开你的本地记录…</Text> : null}
        {error ? <Text style={styles.errorMessage}>本地记录暂时无法打开：{error}</Text> : null}

        <View style={[styles.checkCard, todayCheckIn && styles.checkCardDone]}>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMeta}>TODAY · {today.slice(5).replace('-', '.')}</Text>
            <View style={[styles.pulse, todayCheckIn && styles.pulseDone]} />
          </View>
          <Text style={styles.cardTitle}>
            {!todayCheckIn ? '为今天留一个坐标' : hasWritten ? `今天已记下 ${todayPosts.length} 条` : '今天，已经留下了坐标'}
          </Text>
          <Text style={styles.cardDescription}>
            {!todayCheckIn ? '不需要写什么，点一下就好。' : hasWritten ? '以后再回来看看。' : '就这样也很好。或者，留下一点今天。'}
          </Text>
          <Pressable accessibilityRole="button" disabled={!ready || Boolean(error) || checkingIn} onPress={handlePrimaryAction} style={({ pressed }) => [styles.primaryButton, todayCheckIn && styles.secondaryButton, (!ready || Boolean(error) || checkingIn) && styles.disabled, pressed && styles.pressed]}>
            <Text style={[styles.primaryButtonText, todayCheckIn && styles.secondaryButtonText]}>
              {checkingIn ? '正在留下坐标…' : !todayCheckIn ? '今天也在' : hasWritten ? '再写一句' : '想写一句'}
            </Text>
          </Pressable>
        </View>

        {todayCheckIn && !hasWritten ? <Pressable accessibilityRole="button" onPress={() => router.push('/time')} style={styles.leaveButton}><Text style={styles.leaveText}>先这样，去看看时间</Text></Pressable> : null}

        {todayPosts.length ? (
          <View style={styles.todaySection}>
            <View style={styles.todaySectionHeader}>
              <Text style={styles.todaySectionTitle}>今天的记录</Text>
              <Text style={styles.todaySectionCount}>{todayPosts.length} NOTES</Text>
            </View>
            {todayPosts.map((post, index) => (
              <TodayPostCard
                key={post.id}
                index={index}
                mediaById={mediaById}
                onPress={() => router.push(`/post/${post.id}`)}
                post={post}
              />
            ))}
          </View>
        ) : null}

        {homeMemory ? (
          <View style={styles.memory}>
            <View style={styles.memoryHeader}>
              <Text style={styles.memoryLabel}>{memoryLabel(homeMemory, today)}</Text>
              <Text style={styles.memoryDate}>{homeMemory.post.dayKey.replaceAll('-', '.')}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/post/${homeMemory.post.id}`)} style={({ pressed }) => [styles.memoryCard, pressed && styles.pressed]}>
              {memoryImage ? <Image accessibilityLabel="回忆图片" resizeMode="cover" source={{ uri: memoryImage.localPath }} style={styles.memoryImage} /> : null}
              <Text style={styles.memoryText}>{memoryExcerpt(homeMemory.post.bodyMarkdown)}</Text>
              <Text style={styles.memoryFoot}>{homeMemory.kind === 'person' ? `与 ${homeMemory.person.name} 有关的一段过去` : '那一天留下的坐标'}　→</Text>
            </Pressable>
          </View>
        ) : null}

        {shouldShowBackupReminder ? (
          <View style={styles.backupReminder}>
            <Text style={styles.backupLabel}>A COPY OF YOUR OWN</Text>
            <Text style={styles.backupTitle}>已经留下不少内容了。</Text>
            <Text style={styles.backupText}>可以找一个合适的位置，保存一份属于自己的完整备份。</Text>
            <View style={styles.backupActions}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/data')} style={styles.backupPrimary}><Text style={styles.backupPrimaryText}>现在备份</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void dismissBackupReminder()} style={styles.backupLater}><Text style={styles.backupLaterText}>以后再说</Text></Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal animationType="fade" transparent visible={ready && !preferences.onboardingCompleted}>
        <SafeAreaView style={styles.onboardingBackdrop}>
          <View style={styles.onboardingSheet}>
            <Text style={styles.onboardingLabel}>STILL ALIVE · 仍在</Text>
            <Text style={styles.onboardingTitle}>每天留下一点，{`\n`}慢慢得到一份生命档案。</Text>
            <Text style={styles.onboardingText}>无需注册。日记、人物和图片默认只保存在这台设备，可以随时完整导出。</Text>
            <TextInput maxLength={30} onChangeText={setNickname} placeholder="昵称 · 可跳过" placeholderTextColor={colors.inkFaint} style={styles.onboardingInput} value={nickname} />
            <TextInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setBirthDate} placeholder="出生日期 YYYY-MM-DD · 可跳过" placeholderTextColor={colors.inkFaint} style={styles.onboardingInput} value={birthDate} />
            <Pressable accessibilityRole="button" onPress={() => void completeOnboarding()} style={styles.onboardingButton}><Text style={styles.onboardingButtonText}>进入今天</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void updatePreferences({ onboardingCompleted: true })} style={styles.onboardingSkip}><Text style={styles.onboardingSkipText}>暂时跳过</Text></Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TodayPostCard({ index, mediaById, onPress, post }: { index: number; mediaById: Map<string, Media>; onPress(): void; post: Post }) {
  const mediaIds = extractMediaIds(post.bodyMarkdown);
  const images = mediaIds.map((id) => mediaById.get(id)).filter((item): item is Media => Boolean(item));
  const excerpt = markdownToPlainText(post.bodyMarkdown);

  return (
    <Pressable accessibilityLabel={`打开今天 ${formatTime(post.createdAt)} 的记录`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.todayNote, index === 0 && styles.todayNoteFirst, pressed && styles.pressed]}>
      <View style={styles.todayNoteMetaRow}>
        <View style={styles.todayNoteTimeRow}>
          <View style={styles.todayNoteDot} />
          <Text style={styles.todayNoteMeta}>{formatTime(post.createdAt)}</Text>
          {post.updatedAt !== post.createdAt ? <Text style={styles.todayNoteUpdated}>修改过</Text> : null}
        </View>
        <Text style={styles.todayNoteOpen}>阅读　›</Text>
      </View>
      {images.length ? <PostImageGrid images={images} totalCount={mediaIds.length} /> : null}
      <Text numberOfLines={4} style={[styles.todayNoteText, images.length > 0 && styles.todayNoteTextWithImage]}>
        {excerpt || `今天留下了 ${mediaIds.length} 张照片。`}
      </Text>
      <View style={styles.todayNoteFooter}>
        <Text style={styles.todayNoteType}>{images.length ? images.length > 1 ? 'PHOTO STORY' : 'PHOTO NOTE' : 'TEXT NOTE'}</Text>
        {mediaIds.length ? <Text style={styles.todayNotePhotoCount}>{mediaIds.length} 张照片</Text> : null}
      </View>
    </Pressable>
  );
}

function PostImageGrid({ images, totalCount }: { images: Media[]; totalCount: number }) {
  const visibleImages = images.slice(0, 3);
  if (visibleImages.length === 1) {
    return <Image accessibilityLabel="日记图片" resizeMode="cover" source={{ uri: visibleImages[0].localPath }} style={styles.todaySingleImage} />;
  }
  return (
    <View style={styles.todayImageGrid}>
      <Image accessibilityLabel="日记图片 1" resizeMode="cover" source={{ uri: visibleImages[0].localPath }} style={styles.todayImageMain} />
      <View style={styles.todayImageSide}>
        <Image accessibilityLabel="日记图片 2" resizeMode="cover" source={{ uri: visibleImages[1].localPath }} style={[styles.todayImageSmall, visibleImages.length === 2 && styles.todayImageOnlySide]} />
        {visibleImages[2] ? (
          <View style={styles.todayImageLast}>
            <Image accessibilityLabel="日记图片 3" resizeMode="cover" source={{ uri: visibleImages[2].localPath }} style={styles.todayImageSmall} />
            {totalCount > 3 ? <View style={styles.todayImageMore}><Text style={styles.todayImageMoreText}>+{totalCount - 3}</Text></View> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatDisplayDate(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  return `${month} ${date.getDate()}\n${weekday}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^```.*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/~~|\*\*|__|[*_`]/g, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMediaIds(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/g)].map((match) => match[1]))];
}

function firstMediaId(markdown: string): string | null {
  return markdown.match(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/)?.[1] ?? null;
}

function memoryExcerpt(markdown: string): string {
  return markdownToPlainText(markdown).replace(/\[照片\]/g, '').trim() || '那天留下了一张照片。';
}

function memoryLabel(memory: NonNullable<ReturnType<typeof useAppState>['homeMemory']>, today: string): string {
  if (memory.kind === 'person') return `想起 ${memory.person.name}`;
  const years = Number(today.slice(0, 4)) - Number(memory.post.dayKey.slice(0, 4));
  return years === 1 ? '一年前的今天' : `${years} 年前的今天`;
}

function validOptionalDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const [year, month, day] = value.split('-').map(Number);
  return toDayKey(new Date(year, month - 1, day)) === value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxl },
  brand: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  english: { marginTop: 2, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.6 },
  date: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, lineHeight: 15, textAlign: 'right' },
  kicker: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.4 },
  title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 40, lineHeight: 51 },
  stateMessage: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 11 },
  errorMessage: { marginTop: spacing.md, color: '#9B443B', fontSize: 11, lineHeight: 18 },
  checkCard: { marginTop: spacing.xl, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.life },
  checkCardDone: { backgroundColor: '#2F5E48' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 },
  pulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.sun },
  pulseDone: { backgroundColor: colors.lifeLight },
  cardTitle: { marginTop: spacing.xxl, color: colors.onLife, fontFamily: typography.display, fontSize: 27 },
  cardDescription: { marginTop: spacing.sm, color: colors.onLifeMuted, fontSize: 12, lineHeight: 20 },
  primaryButton: { marginTop: spacing.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.sunLight },
  secondaryButton: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  primaryButtonText: { color: colors.life, fontWeight: '600', letterSpacing: 1 },
  secondaryButtonText: { color: colors.onLife },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  todaySection: { marginTop: spacing.xl },
  todaySectionHeader: { paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todaySectionTitle: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 18 },
  todaySectionCount: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.1 },
  todayNote: { marginTop: spacing.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(32, 35, 31, 0.09)', borderRadius: radius.lg, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 },
  todayNoteFirst: { marginTop: spacing.md },
  todayNoteMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayNoteTimeRow: { flexDirection: 'row', alignItems: 'center' },
  todayNoteDot: { width: 5, height: 5, marginRight: spacing.sm, borderRadius: 3, backgroundColor: colors.sun },
  todayNoteMeta: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  todayNoteUpdated: { marginLeft: spacing.sm, color: colors.inkFaint, fontSize: 8 },
  todayNoteOpen: { color: colors.inkFaint, fontSize: 9 },
  todaySingleImage: { width: '100%', height: 205, marginTop: spacing.md, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.lifeLight },
  todayImageGrid: { height: 220, marginTop: spacing.md, flexDirection: 'row', gap: 4 },
  todayImageMain: { flex: 1.65, height: '100%', borderBottomLeftRadius: radius.lg, backgroundColor: colors.lifeLight },
  todayImageSide: { flex: 1, height: '100%', gap: 4 },
  todayImageSmall: { width: '100%', flex: 1, backgroundColor: colors.lifeLight },
  todayImageOnlySide: { borderTopRightRadius: radius.lg },
  todayImageLast: { flex: 1, position: 'relative', overflow: 'hidden', borderTopRightRadius: radius.lg },
  todayImageMore: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32, 35, 31, 0.48)' },
  todayImageMoreText: { color: colors.onLife, fontFamily: typography.mono, fontSize: 18, fontWeight: '700' },
  todayNoteText: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 27 },
  todayNoteTextWithImage: { fontSize: 15, lineHeight: 25 },
  todayNoteFooter: { marginTop: spacing.md, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  todayNoteType: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 7, letterSpacing: 1.1 },
  todayNotePhotoCount: { color: colors.inkFaint, fontSize: 8 },
  leaveButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  leaveText: { color: colors.inkFaint, fontSize: 10 },
  memory: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  memoryLabel: { color: colors.inkSoft, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.2 },
  memoryDate: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  memoryCard: { marginTop: spacing.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.sheet },
  memoryImage: { width: '100%', height: 180, marginBottom: spacing.md, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.lifeLight },
  memoryText: { color: colors.ink, fontFamily: typography.display, fontSize: 17, lineHeight: 29 },
  memoryFoot: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 10 },
  backupReminder: { marginTop: spacing.xl, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sunLight },
  backupLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.2 },
  backupTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  backupText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 18 },
  backupActions: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backupPrimary: { minWidth: 88, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  backupPrimaryText: { color: colors.onLife, fontSize: 10, fontWeight: '700' },
  backupLater: { minWidth: 88, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  backupLaterText: { color: colors.inkSoft, fontSize: 10 },
  onboardingBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 35, 31, 0.42)' },
  onboardingSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  onboardingLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 },
  onboardingTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 28, lineHeight: 39 },
  onboardingText: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 11, lineHeight: 20 },
  onboardingInput: { minHeight: 50, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  onboardingButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  onboardingButtonText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  onboardingSkip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  onboardingSkipText: { color: colors.inkFaint, fontSize: 10 },
});
