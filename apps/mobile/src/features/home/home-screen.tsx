import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { toDayKey } from '../../shared/core/day-key';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { BirthdayCalendar, CheckIn, DayKey, Media, Person, Post } from '@still-alive/types';
import type { NameStyleId } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { DatePickerField } from '../people/date-time-picker';
import type { DateParts } from '../people/date-time-picker';
import MarkdownView from '../journal/markdown-view.dom';
import { StyledName } from '../people/styled-name';
import { previewRouteParams, toSelectedPreviewFile } from '../files/file-preview.types';
import { TabPageHeader } from '../../shared/components/tab-page-header';
import { extractAudioEmbeds, formatAudioDuration, withoutEmbeddedAttachments } from '../journal/embedded-media';
import { birthdayForCalendar, birthdayFromDateString, nextBirthday } from '../people/person-profile';
import { resolveDeviceLocation } from '../../infrastructure/platform/device-location';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { writePersistentError } from '../../infrastructure/platform/persistent-log';
import { createThemedStyles, editorTheme } from '../../shared/theme/app-theme';
import { MusicShareCard } from '../../application/components/music-share-card';
import { ReadingShareCard } from '../../application/components/reading-share-card';
import { extractMusicShares } from '../../application/music-share';
import { readingSourceTitle, withoutReadingSourceQuote } from '../../application/reading-share';
import { MediaThumbnail } from '../../shared/components/media-thumbnail';

type TimelineItem =
  | { kind: 'check-in'; checkIn: CheckIn }
  | { kind: 'post'; post: Post };

interface TimelineSection {
  title: DayKey;
  data: TimelineItem[];
}

interface BirthdayPrompt {
  daysUntil: number;
  person: Person;
}

const AUDIO_WAVE_HEIGHTS = [7, 13, 19, 11, 23, 15, 9, 20, 12, 17, 8, 14];
const POST_PREVIEW_MAX_HEIGHT = 168;

export default function SpaceScreen() {
  const router = useRouter();
  const { checkInToday, checkIns, dismissBackupReminder, error, homeMemory, media, people, posts, preferences, readingNoteSources, ready, shouldShowBackupReminder, today, todayCheckIn, updateCheckInCity, updatePreferences } = useAppState();
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthDateCalendar, setBirthDateCalendar] = useState<BirthdayCalendar>('solar');
  const [birthDateIsLeapMonth, setBirthDateIsLeapMonth] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showMemoryTrace, setShowMemoryTrace] = useState(false);
  const checkInActionInProgressRef = useRef(false);
  const checkInLocationTasksRef = useRef(new Set<string>());
  const todayPosts = posts.filter((post) => post.dayKey === today);
  const hasWritten = todayPosts.length > 0;
  const lastCheckInDay = checkIns[0]?.dayKey;
  const yesterday = toDayKey(new Date(new Date().setDate(new Date().getDate() - 1)));
  const returningAfterBreak = Boolean(lastCheckInDay && lastCheckInDay !== today && lastCheckInDay !== yesterday);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const profileAvatar = preferences.profileAvatarMediaId ? mediaById.get(preferences.profileAvatarMediaId) ?? null : null;
  const timelineSections = useMemo(() => buildTimelineSections(posts, checkIns), [checkIns, posts]);
  const upcomingBirthday = useMemo(() => findUpcomingBirthday(people, today), [people, today]);
  const memoryImageId = homeMemory ? firstMediaId(homeMemory.post.bodyMarkdown) : null;
  const memoryImage = memoryImageId ? mediaById.get(memoryImageId) : null;
  const memoryReadingSource = homeMemory ? readingNoteSources.find((source) => source.postId === homeMemory.post.id) ?? null : null;
  // 备份提醒优先展示；用户稍后处理后，今日页再轮换回忆卡片，避免次级卡片同时抢占注意力。
  const showBackupReminder = shouldShowBackupReminder;
  const showMemory = Boolean(homeMemory) && !showBackupReminder;
  const recordedDayKeys = [...posts.map((post) => post.dayKey), ...checkIns.map((item) => item.dayKey)];
  const recordedDays = new Set(recordedDayKeys).size;
  const latestRecordedDay = [...recordedDayKeys].sort().at(-1);
  const visualMediaCount = media.filter((item) => item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/')).length;
  const voiceCount = media.filter((item) => item.mimeType.startsWith('audio/')).length;

  useEffect(() => {
    setNickname(preferences.nickname);
    setBirthDate(preferences.birthDate);
    setBirthDateCalendar(preferences.birthDateCalendar);
    setBirthDateIsLeapMonth(preferences.birthDateIsLeapMonth);
  }, [preferences.birthDate, preferences.birthDateCalendar, preferences.birthDateIsLeapMonth, preferences.nickname]);

  const resolveCheckInCity = useCallback(async (checkInId: string, requestPermission = true) => {
    if (checkInLocationTasksRef.current.has(checkInId)) return;
    checkInLocationTasksRef.current.add(checkInId);
    try {
      if (requestPermission && !await ensureAppPermission('location')) return;
      const location = await resolveDeviceLocation();
      await updateCheckInCity(checkInId, location.city);
    } catch (cause: unknown) {
      writePersistentError('location.check-in-city.failed', cause, { checkInId });
    } finally {
      checkInLocationTasksRef.current.delete(checkInId);
    }
  }, [updateCheckInCity]);

  useEffect(() => {
    if (!ready || !todayCheckIn || todayCheckIn.city || checkInActionInProgressRef.current) return;
    void resolveCheckInCity(todayCheckIn.id, false);
  }, [ready, resolveCheckInCity, todayCheckIn]);

  const handlePrimaryAction = async () => {
    if (!todayCheckIn) {
      try {
        checkInActionInProgressRef.current = true;
        setCheckingIn(true);
        const checkIn = await checkInToday();
        void resolveCheckInCity(checkIn.id);
      } catch (cause: unknown) {
        feedback.alert('暂时无法打卡', cause instanceof Error ? cause.message : '请稍后重试。');
      } finally {
        checkInActionInProgressRef.current = false;
        setCheckingIn(false);
      }
      return;
    }
    router.push('/editor');
  };

  const completeOnboarding = async () => {
    if (birthDate && !birthdayFromDateString(birthDate, birthDateCalendar, birthDateIsLeapMonth)) {
      feedback.alert('生日日期不存在');
      return;
    }
    await updatePreferences({ onboardingCompleted: true, nickname: nickname.trim(), birthDate, birthDateCalendar, birthDateIsLeapMonth: birthDateCalendar === 'lunar' && birthDateIsLeapMonth });
  };
  const birthDateParts: DateParts | null = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? (() => { const [year, month, day] = birthDate.split('-').map(Number); return { year, month, day }; })() : null;
  const onboardingBirthday = birthdayFromDateString(birthDate, birthDateCalendar, birthDateIsLeapMonth);

  const changeBirthDateCalendar = (calendar: BirthdayCalendar) => {
    if (calendar === birthDateCalendar) return;
    if (onboardingBirthday) {
      const converted = birthdayForCalendar(onboardingBirthday, calendar);
      setBirthDate(`${converted.year}-${String(converted.month).padStart(2, '0')}-${String(converted.day).padStart(2, '0')}`);
      setBirthDateIsLeapMonth(converted.isLeapMonth);
    } else {
      setBirthDateIsLeapMonth(false);
    }
    setBirthDateCalendar(calendar);
  };

  const listHeader = (
    <View>
      <TabPageHeader
        action={<Text style={styles.date}>{formatDisplayDate(new Date())}</Text>}
        eyebrow="STILL ALIVE / SPACE"
        subtitle="所有留下的片段，都在这里慢慢生长。"
        title="空间"
      />

      {!ready ? <Text style={styles.stateMessage}>正在打开你的本地记录…</Text> : null}
      {error ? <Text style={styles.errorMessage}>本地记录暂时无法打开：{error}</Text> : null}

      <Pressable
        accessibilityHint="点击切换卡片内容"
        accessibilityLabel={showMemoryTrace ? '记忆追踪，点击返回打卡记录' : '打卡记录，点击查看记忆追踪'}
        accessibilityRole="button"
        onPress={() => setShowMemoryTrace((current) => !current)}
        style={({ pressed }) => [styles.checkCard, !showMemoryTrace && todayCheckIn && styles.checkCardDone, showMemoryTrace && styles.memoryTraceCard, pressed && styles.cardPressed]}
      >
        <View pointerEvents="none" style={[styles.checkCardAccent, !showMemoryTrace && !todayCheckIn && styles.checkCardPendingAccent]} />
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardMeta, showMemoryTrace && styles.memoryTraceMeta]}>{showMemoryTrace ? 'MEMORY TRACE' : `TODAY ${today.slice(5).replace('-', '.')}`}</Text>
          <View style={styles.cardPageDots}>
            <View style={[styles.cardPageDot, !showMemoryTrace && styles.cardPageDotActive, !showMemoryTrace && !todayCheckIn && styles.cardPageDotPending]} />
            <View style={[styles.cardPageDot, showMemoryTrace && styles.memoryPageDotActive]} />
          </View>
        </View>
        {showMemoryTrace ? (
          <View style={styles.cardBody}>
            <Text style={styles.memoryTraceTitle}>这些日子，正在慢慢长大</Text>
            <Text style={styles.memoryTraceDescription}>{latestRecordedDay ? `最近一次留下在 ${formatChineseDate(latestRecordedDay)}。` : '从今天开始，留下第一段属于你的时间。'}</Text>
            <View style={styles.memoryTraceStats}>
              <View style={styles.memoryTraceStat}><Text style={styles.memoryTraceValue}>{recordedDays}</Text><Text style={styles.memoryTraceLabel}>记录天数</Text></View>
              <View style={styles.memoryTraceDivider} />
              <View style={styles.memoryTraceStat}><Text style={styles.memoryTraceValue}>{visualMediaCount}</Text><Text style={styles.memoryTraceLabel}>影像</Text></View>
              <View style={styles.memoryTraceDivider} />
              <View style={styles.memoryTraceStat}><Text style={styles.memoryTraceValue}>{voiceCount}</Text><Text style={styles.memoryTraceLabel}>语音</Text></View>
            </View>
          </View>
        ) : (
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>
              {!todayCheckIn
                ? returningAfterBreak ? '欢迎回来，今天也可以重新开始' : '为今天留一个坐标'
                : hasWritten ? `今天已记下 ${todayPosts.length} 条` : todayCheckIn.city ? `今天，已经在${todayCheckIn.city}留下坐标` : '今天，已经留下了坐标'}
            </Text>
            <Text style={styles.cardDescription}>
              {!todayCheckIn ? '不需要写什么，点一下就好。' : hasWritten ? '还想记下什么，可以继续写。' : '就这样也很好。或者，留下一点今天。'}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!ready || Boolean(error) || checkingIn}
              onPress={(event) => { event.stopPropagation(); void handlePrimaryAction(); }}
              style={({ pressed }) => [styles.primaryButton, todayCheckIn && styles.secondaryButton, (!ready || Boolean(error) || checkingIn) && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.primaryButtonText, todayCheckIn && styles.secondaryButtonText]}>
                {checkingIn ? '正在打卡…' : !todayCheckIn ? '今天也在' : '写一条记录'}
              </Text>
            </Pressable>
          </View>
        )}
      </Pressable>

      {upcomingBirthday ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/person/${upcomingBirthday.person.id}`)} style={({ pressed }) => [styles.birthdayCard, pressed && styles.pressed]}>
          <View style={styles.birthdayAvatar}><Text style={styles.birthdayAvatarText}>{upcomingBirthday.person.name.slice(0, 1)}</Text></View>
          <View style={styles.birthdayContent}>
            <Text style={styles.promptLabel}>生日提示</Text>
            <Text style={styles.birthdayTitle}>{birthdayPromptTitle(upcomingBirthday)}</Text>
            <Text style={styles.promptFoot}>去看看关于 {upcomingBirthday.person.name} 的记录　›</Text>
          </View>
        </Pressable>
      ) : null}

      {showMemory && homeMemory ? (
        <View style={styles.memory}>
          <View style={styles.memoryHeader}>
            <Text style={styles.memoryLabel}>{memoryLabel(homeMemory, today)}</Text>
            <Text style={styles.memoryDate}>{homeMemory.post.dayKey.replaceAll('-', '.')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/post/${homeMemory.post.id}`)} style={({ pressed }) => [styles.memoryCard, pressed && styles.pressed]}>
            {memoryImage ? <MediaThumbnail accessibilityLabel="回忆媒体" item={memoryImage} style={styles.memoryImage} /> : null}
            <Text numberOfLines={4} style={styles.memoryText}>{memoryExcerpt(homeMemory.post.bodyMarkdown, memoryReadingSource)}</Text>
            <Text style={styles.memoryFoot}>{homeMemory.kind === 'person' ? `与 ${homeMemory.person.name} 有关的一段过去` : '那一天留下的坐标'}　›</Text>
          </Pressable>
        </View>
      ) : null}

      {showBackupReminder ? (
        <View style={styles.backupReminder}>
          <Text style={styles.backupLabel}>A COPY OF YOUR OWN</Text>
          <Text style={styles.backupTitle}>已经留下不少内容了。</Text>
          <Text style={styles.backupText}>可以找一个合适的位置，保存一份属于自己的完整备份。</Text>
          <View style={styles.backupActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/backup')} style={styles.backupPrimary}><Text style={styles.backupPrimaryText}>现在备份</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void dismissBackupReminder()} style={styles.backupLater}><Text style={styles.backupLaterText}>以后再说</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.timelineHeading}>
        <View>
          <Text style={styles.timelineLabel}>MY MOMENTS</Text>
          <Text style={styles.timelineTitle}>我的动态</Text>
        </View>
        <Text style={styles.timelineCount}>{posts.length + checkIns.length} ITEMS</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList<TimelineItem, TimelineSection>
        contentContainerStyle={styles.container}
        keyExtractor={(item) => item.kind === 'post' ? item.post.id : item.checkIn.id}
        ListEmptyComponent={<Text style={styles.empty}>还没有记录。今天，可以从一个小小的坐标开始。</Text>}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => item.kind === 'post' ? (
          <PostCard
            authorName={preferences.nickname || '我'}
            avatarUri={profileAvatar?.localPath ?? null}
            mediaById={mediaById}
            onImagePress={(imageIndex, images) => router.push({ pathname: '/file-preview', params: previewRouteParams(images.map(toSelectedPreviewFile), imageIndex) })}
            onPress={() => router.push(`/post/${item.post.id}`)}
            post={item.post}
            readingSource={readingNoteSources.find((source) => source.postId === item.post.id) ?? null}
            signature={preferences.profileSignature}
            nameStyle={preferences.selfNameStyle}
          />
        ) : <CheckInRow checkIn={item.checkIn} />}
        renderSectionHeader={({ section }) => <DayHeader dayKey={section.title} today={today} />}
        sections={timelineSections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />

      <DraggableBottomSheet accessibilityLabel="首次设置" backdropStyle={styles.onboardingBackdrop} dismissDisabled keyboardAvoiding onClose={() => undefined} open={ready && !preferences.onboardingCompleted} sheetStyle={styles.onboardingSheet}>
            <ScrollView contentContainerStyle={styles.onboardingContent} keyboardShouldPersistTaps="handled" style={styles.onboardingScroll}>
              <Text style={styles.onboardingLabel}>STILL ALIVE 仍在</Text>
              <Text style={styles.onboardingTitle}>每天留下一点，{`\n`}慢慢得到一份生命档案。</Text>
              <Text style={styles.onboardingText}>无需注册。记录、人物和媒体默认只保存在这台设备，可以随时完整导出。</Text>
              <TextInput maxLength={30} onChangeText={setNickname} placeholder="昵称 可跳过" placeholderTextColor={colors.inkFaint} style={styles.onboardingInput} value={nickname} />
              <View style={styles.onboardingCalendar}>
                <Text style={styles.onboardingCalendarLabel}>生日历法</Text>
                <View style={styles.onboardingSegmented}>{(['solar', 'lunar'] as const).map((calendar) => <Pressable key={calendar} accessibilityRole="button" accessibilityState={{ selected: birthDateCalendar === calendar }} onPress={() => changeBirthDateCalendar(calendar)} style={[styles.onboardingSegment, birthDateCalendar === calendar && styles.onboardingSegmentActive]}><Text style={[styles.onboardingSegmentText, birthDateCalendar === calendar && styles.onboardingSegmentTextActive]}>{calendar === 'solar' ? '公历' : '农历'}</Text></Pressable>)}</View>
              </View>
              <DatePickerField calendar={birthDateCalendar} isLeapMonth={birthDateIsLeapMonth} label={`${birthDateCalendar === 'solar' ? '公历' : '农历'}生日 可跳过`} onChange={({ year, month, day }, nextIsLeapMonth) => { setBirthDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`); setBirthDateIsLeapMonth(nextIsLeapMonth); }} onClear={() => { setBirthDate(''); setBirthDateIsLeapMonth(false); }} value={birthDateParts} />
              <Pressable accessibilityRole="button" onPress={() => void completeOnboarding()} style={styles.onboardingButton}><Text style={styles.onboardingButtonText}>进入空间</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void updatePreferences({ onboardingCompleted: true })} style={styles.onboardingSkip}><Text style={styles.onboardingSkipText}>暂时跳过</Text></Pressable>
            </ScrollView>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

function DayHeader({ dayKey, today }: { dayKey: DayKey; today: DayKey }) {
  return (
    <View style={styles.dayHeader}>
      <View>
        <Text style={styles.dayTitle}>{formatDayTitle(dayKey, today)}</Text>
        <Text style={styles.dayMeta}>{dayKey.replaceAll('-', '.')} / {weekdayLabel(dayKey)}</Text>
      </View>
      <View style={styles.dayLine} />
    </View>
  );
}

function CheckInRow({ checkIn }: { checkIn: CheckIn }) {
  return (
    <View accessibilityLabel={`${checkIn.dayKey} ${checkIn.city ? `${checkIn.city} ` : ''}${formatTime(checkIn.createdAt)} 留下坐标`} style={styles.checkInRow}>
      <View style={styles.checkInMarker}><View style={styles.checkInDot}><View style={styles.checkInDotCore} /></View></View>
      <View style={styles.checkInContent}>
        <Text style={styles.checkInTitle}>今天也在</Text>
        <Text style={styles.checkInMeta}>{checkIn.city ? `${checkIn.city} / ` : ''}{formatTime(checkIn.createdAt)}</Text>
      </View>
    </View>
  );
}

function PostCard({ authorName, avatarUri, mediaById, nameStyle, onImagePress, onPress, post, readingSource, signature }: { authorName: string; avatarUri: string | null; mediaById: Map<string, Media>; nameStyle: NameStyleId; onImagePress(index: number, images: Media[]): void; onPress(): void; post: Post; readingSource: ReturnType<typeof useAppState>['readingNoteSources'][number] | null; signature: string }) {
  const [bodyOverflowed, setBodyOverflowed] = useState(false);
  const mediaIds = extractMediaIds(post.bodyMarkdown);
  const images = mediaIds.map((id) => mediaById.get(id)).filter((item): item is Media => Boolean(item));
  const displayMarkdown = withoutReadingSourceQuote(withoutEmbeddedAttachments(post.bodyMarkdown), readingSource);
  const audioEmbeds = extractAudioEmbeds(post.bodyMarkdown);
  const musicShare = extractMusicShares(post.bodyMarkdown)[0] ?? null;
  const hasHiddenContent = bodyOverflowed || images.length > 9 || audioEmbeds.length > 2;

  return (
    <Pressable accessibilityLabel={`打开 ${post.dayKey} ${formatTime(post.createdAt)} 的记录`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.postCard, pressed && styles.feedPressed]}>
      <ProfileAvatar name={authorName} uri={avatarUri} />
      <View style={styles.postContent}>
        <View style={styles.postHeader}>
          <StyledName style={styles.postAuthor} value={authorName} variant={nameStyle} />
          {signature ? <Text numberOfLines={1} style={styles.postSignature}>{signature}</Text> : null}
        </View>
        {displayMarkdown.trim() ? (
          <View pointerEvents="none" style={styles.postMarkdownFrame}>
            <MarkdownView
              dom={{ containerStyle: styles.postMarkdown, matchContents: true, scrollEnabled: false, style: styles.postMarkdown }}
              markdown={displayMarkdown}
              maxHeight={POST_PREVIEW_MAX_HEIGHT}
              media={[]}
              onOverflowChange={setBodyOverflowed}
              preview
              theme={editorTheme()}
            />
          </View>
        ) : null}
        {readingSource ? <View style={styles.readingShare}><ReadingShareCard source={readingSource} /></View> : null}
        {musicShare ? <View style={styles.musicShare}><MusicShareCard share={musicShare} /></View> : null}
        {images.length ? <PostImageGrid images={images} onPressImage={(imageIndex) => onImagePress(imageIndex, images)} totalCount={mediaIds.length} /> : null}
        {audioEmbeds.length ? <AudioPreviews audioEmbeds={audioEmbeds} mediaById={mediaById} /> : null}
        {hasHiddenContent ? <Pressable accessibilityLabel="查看更多记录内容" accessibilityRole="button" onPress={(event) => { event.stopPropagation(); onPress(); }} style={({ pressed }) => [styles.postMoreButton, pressed && styles.feedPressed]}><Text style={styles.postMoreText}>更多</Text></Pressable> : null}
        <View style={[styles.postFooter, hasHiddenContent && styles.postFooterAfterMore]}>
          <Text numberOfLines={1} style={styles.postTime}>{post.locationName ? `${post.locationName} / ` : ''}{formatTime(post.createdAt)}{post.updatedAt !== post.createdAt ? ' / 修改过' : ''}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ProfileAvatar({ name, uri }: { name: string; uri: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  return (
    <View style={styles.postAvatar}>
      {uri && !failed
        ? <Image accessibilityLabel={`${name}的头像`} onError={() => setFailed(true)} resizeMode="cover" source={{ uri }} style={styles.postAvatarImage} />
        : <Text style={styles.postAvatarText}>{name.slice(0, 1) || '我'}</Text>}
    </View>
  );
}

function PostImageGrid({ images, onPressImage, totalCount }: { images: Media[]; onPressImage(index: number): void; totalCount: number }) {
  if (images.length === 1) {
    return (
      <Pressable accessibilityLabel="预览记录媒体" accessibilityRole="button" onPress={(event) => { event.stopPropagation(); onPressImage(0); }}>
        <MediaThumbnail accessibilityLabel={images[0].mimeType.startsWith('video/') ? '记录视频' : '记录图片'} item={images[0]} style={[styles.postSingleImage, { aspectRatio: previewAspectRatio(images[0]) }]} />
      </Pressable>
    );
  }
  const visibleImages = images.slice(0, 9);
  return (
    <View style={styles.postImageGrid}>
      {visibleImages.map((image, index) => (
        <Pressable accessibilityLabel={`预览记录媒体 ${index + 1}`} accessibilityRole="button" key={`${image.id}_${index}`} onPress={(event) => { event.stopPropagation(); onPressImage(index); }} style={styles.postImageCell}>
          <MediaThumbnail accessibilityLabel={image.mimeType.startsWith('video/') ? `记录视频 ${index + 1}` : `记录图片 ${index + 1}`} item={image} style={styles.postImage} />
          {index === visibleImages.length - 1 && totalCount > visibleImages.length ? <View style={styles.postImageMore}><Text style={styles.postImageMoreText}>+{totalCount - visibleImages.length}</Text></View> : null}
        </Pressable>
      ))}
    </View>
  );
}

function AudioPreviews({ audioEmbeds, mediaById }: { audioEmbeds: ReturnType<typeof extractAudioEmbeds>; mediaById: Map<string, Media> }) {
  const visibleAudio = audioEmbeds.slice(0, 2);
  return (
    <View style={styles.audioList}>
      {visibleAudio.map((audio, index) => (
        <View key={`${audio.id}_${index}`} style={styles.audioPreview}>
          <View style={styles.audioIcon}><Text style={styles.audioIconText}>♪</Text></View>
          <View style={styles.audioBody}>
            <View style={styles.audioWave}>
              {AUDIO_WAVE_HEIGHTS.map((height, waveIndex) => <View key={waveIndex} style={[styles.audioWaveBar, { height }]} />)}
            </View>
            <View style={styles.audioMetaRow}>
              <Text style={styles.audioLabel}>{mediaById.has(audio.id) ? '语音记录' : '语音文件暂时不可用'}</Text>
              <Text style={styles.audioDuration}>{formatAudioDuration(audio.durationMs)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function buildTimelineSections(posts: Post[], checkIns: CheckIn[]): TimelineSection[] {
  const itemsByDay = new Map<DayKey, TimelineItem[]>();
  for (const post of posts) itemsByDay.set(post.dayKey, [...(itemsByDay.get(post.dayKey) ?? []), { kind: 'post', post }]);
  for (const checkIn of checkIns) itemsByDay.set(checkIn.dayKey, [...(itemsByDay.get(checkIn.dayKey) ?? []), { kind: 'check-in', checkIn }]);
  return [...itemsByDay.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([title, items]) => ({
      title,
      data: items.sort(compareTimelineItems),
    }));
}

function compareTimelineItems(left: TimelineItem, right: TimelineItem): number {
  const difference = timelineItemTime(right) - timelineItemTime(left);
  if (Number.isFinite(difference) && difference !== 0) return difference;
  return timelineItemId(right).localeCompare(timelineItemId(left));
}

function timelineItemTime(item: TimelineItem): number {
  return new Date(item.kind === 'post' ? item.post.createdAt : item.checkIn.createdAt).getTime();
}

function timelineItemId(item: TimelineItem): string {
  return item.kind === 'post' ? item.post.id : item.checkIn.id;
}

function findUpcomingBirthday(people: Person[], today: DayKey): BirthdayPrompt | null {
  const [year, month, day] = today.split('-').map(Number);
  const start = new Date(year, month - 1, day, 12);
  const prompts = people.flatMap((person) => {
    if (!person.birthday) return [];
    const date = nextBirthday(person.birthday, start);
    const daysUntil = Math.round((date.getTime() - start.getTime()) / 86_400_000);
    return daysUntil <= 3 ? [{ daysUntil, person }] : [];
  });
  return prompts.sort((left, right) => left.daysUntil - right.daysUntil || left.person.name.localeCompare(right.person.name))[0] ?? null;
}

function birthdayPromptTitle(prompt: BirthdayPrompt): string {
  if (prompt.daysUntil === 0) return `今天是 ${prompt.person.name} 的生日`;
  if (prompt.daysUntil === 1) return `${prompt.person.name} 的生日就在明天`;
  return `${prompt.person.name} 的生日还有 ${prompt.daysUntil} 天`;
}

function previewAspectRatio(media: Media): number {
  if (!media.width || !media.height) return 4 / 3;
  return Math.min(2, Math.max(1.15, media.width / media.height));
}

function formatDisplayDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}\n${weekdayLabel(toDayKey(date))}`;
}

function formatDayTitle(dayKey: DayKey, today: DayKey): string {
  if (dayKey === today) return '今天';
  const [year, month, day] = today.split('-').map(Number);
  const yesterday = toDayKey(new Date(year, month - 1, day - 1));
  if (dayKey === yesterday) return '昨天';
  const [dayYear, dayMonth, dayValue] = dayKey.split('-').map(Number);
  return dayYear === year ? `${dayMonth} 月 ${dayValue} 日` : `${dayYear} 年 ${dayMonth} 月 ${dayValue} 日`;
}

function weekdayLabel(dayKey: DayKey): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return `周${['日', '一', '二', '三', '四', '五', '六'][new Date(year, month - 1, day).getDay()]}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatChineseDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^```.*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[([ xX])\]\s*/gm, (_match, checked: string) => checked.toLocaleLowerCase() === 'x' ? '☑ ' : '☐ ')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/~~|\*\*|__|[*_`]/g, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' ')
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

function memoryExcerpt(markdown: string, readingSource: ReturnType<typeof useAppState>['readingNoteSources'][number] | null): string {
  const audioEmbeds = extractAudioEmbeds(markdown);
  const sharedMusic = extractMusicShares(markdown)[0];
  const text = markdownToPlainText(withoutReadingSourceQuote(markdown, readingSource)).replace(/\[照片\]/g, '').trim();
  return text || (readingSource ? `那天读了《${readingSourceTitle(readingSource)}》。` : sharedMusic ? `那天分享了《${sharedMusic.title}》。` : audioEmbeds.length ? `那天留下了 ${audioEmbeds.length} 段语音。` : '那天留下了一张图片。');
}

function memoryLabel(memory: NonNullable<ReturnType<typeof useAppState>['homeMemory']>, today: string): string {
  if (memory.kind === 'person') return `想起 ${memory.person.name}`;
  const years = Number(today.slice(0, 4)) - Number(memory.post.dayKey.slice(0, 4));
  return years === 1 ? '一年前的今天' : `${years} 年前的今天`;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  date: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, lineHeight: 15, textAlign: 'right' },
  stateMessage: { marginBottom: spacing.sm, color: colors.inkFaint, fontSize: typography.size.caption },
  errorMessage: { marginBottom: spacing.sm, color: colors.danger, fontSize: typography.size.caption, lineHeight: 18 },
  checkCard: { height: 256, padding: spacing.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  checkCardDone: { borderColor: colors.lifeLine },
  memoryTraceCard: { borderColor: colors.lifeLine },
  checkCardAccent: { position: 'absolute', top: 0, right: spacing.lg, width: 72, height: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.life },
  checkCardPendingAccent: { backgroundColor: colors.sun },
  cardPressed: { opacity: 0.9 },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  memoryTraceMeta: { color: colors.life },
  cardPageDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardPageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.line },
  cardPageDotActive: { width: 13, backgroundColor: colors.life },
  cardPageDotPending: { backgroundColor: colors.sun },
  memoryPageDotActive: { width: 13, backgroundColor: colors.life },
  cardBody: { flex: 1 },
  cardTitle: { marginTop: spacing.xl, color: colors.ink, fontFamily: typography.display, fontSize: 26, lineHeight: 36 },
  cardDescription: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, lineHeight: 20 },
  primaryButton: { minHeight: 48, marginTop: 'auto', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.life },
  secondaryButton: { backgroundColor: colors.lifeLight },
  primaryButtonText: { color: colors.onLife, fontWeight: '600', letterSpacing: 1 },
  secondaryButtonText: { color: colors.life },
  memoryTraceTitle: { marginTop: spacing.xl, color: colors.ink, fontFamily: typography.display, fontSize: 23, lineHeight: 32 },
  memoryTraceDescription: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 19 },
  memoryTraceStats: { marginTop: 'auto', paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lifeLine },
  memoryTraceStat: { flex: 1, alignItems: 'center' },
  memoryTraceValue: { color: colors.life, fontFamily: typography.display, fontSize: 22 },
  memoryTraceLabel: { marginTop: 2, color: colors.inkFaint, fontSize: 8 },
  memoryTraceDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.lifeLine },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  birthdayCard: { marginTop: spacing.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.sheet },
  birthdayAvatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.sunLight },
  birthdayAvatarText: { color: colors.life, fontFamily: typography.display, fontSize: 20 },
  birthdayContent: { flex: 1, marginLeft: spacing.md },
  promptLabel: { color: colors.sun, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  birthdayTitle: { marginTop: 5, color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  promptFoot: { marginTop: 6, color: colors.inkFaint, fontSize: typography.size.meta },
  memory: { marginTop: spacing.lg },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  memoryLabel: { color: colors.inkSoft, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  memoryDate: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  memoryCard: { marginTop: spacing.sm, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.sheet },
  memoryImage: { width: '100%', height: 180, marginBottom: spacing.md, borderRadius: 4, backgroundColor: colors.lifeLight },
  memoryText: { color: colors.ink, fontFamily: typography.display, fontSize: 17, lineHeight: 29 },
  memoryFoot: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 10 },
  backupReminder: { marginTop: spacing.lg, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sunLight },
  backupLabel: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  backupTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  backupText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 },
  backupActions: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backupPrimary: { minWidth: 88, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  backupPrimaryText: { color: colors.onLife, fontSize: 10, fontWeight: '700' },
  backupLater: { minWidth: 88, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  backupLaterText: { color: colors.inkSoft, fontSize: 10 },
  timelineHeading: { marginTop: spacing.xxl, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  timelineLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.3 },
  timelineTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 25 },
  timelineCount: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1 },
  dayHeader: { marginTop: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.paper },
  dayTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  dayMeta: { marginTop: 3, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, letterSpacing: 0.5 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  checkInRow: { minHeight: 58, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  checkInMarker: { width: 42, alignItems: 'center', justifyContent: 'center' },
  checkInDot: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 7, backgroundColor: colors.lifeLight },
  checkInDotCore: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.life },
  checkInContent: { flex: 1, marginLeft: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkInTitle: { color: colors.inkSoft, fontFamily: typography.body, fontSize: 12 },
  checkInMeta: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  postCard: { paddingTop: spacing.md, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  feedPressed: { opacity: 0.68 },
  postAvatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 21, backgroundColor: colors.life },
  postAvatarImage: { width: '100%', height: '100%' },
  postAvatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 17 },
  postContent: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  postHeader: { minHeight: 24, alignItems: 'flex-start', justifyContent: 'center' },
  postAuthor: { color: colors.life, fontFamily: typography.body, fontSize: 14, fontWeight: '700' },
  postSignature: { maxWidth: '100%', marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 },
  postMarkdownFrame: { width: '100%', marginTop: spacing.sm },
  postMarkdown: { width: '100%', alignSelf: 'stretch', backgroundColor: 'transparent' },
  musicShare: { marginTop: spacing.md },
  readingShare: { marginTop: spacing.md },
  postSingleImage: { width: '92%', marginTop: spacing.md, borderRadius: 4, backgroundColor: colors.lifeLight },
  postImageGrid: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  postImageCell: { width: '32%', aspectRatio: 1, position: 'relative', overflow: 'hidden', borderRadius: 4, backgroundColor: colors.lifeLight },
  postImage: { width: '100%', height: '100%' },
  postImageMore: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
  postImageMoreText: { color: colors.onLife, fontFamily: typography.mono, fontSize: 15, fontWeight: '700' },
  audioList: { marginTop: spacing.md, gap: 6 },
  audioPreview: { minHeight: 58, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.lifeLight },
  audioIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.life },
  audioIconText: { color: colors.onLife, fontSize: 15 },
  audioBody: { flex: 1, marginLeft: spacing.sm },
  audioWave: { height: 25, flexDirection: 'row', alignItems: 'center', gap: 3 },
  audioWaveBar: { width: 3, borderRadius: 2, backgroundColor: colors.lifeLine },
  audioMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  audioLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 8, letterSpacing: 0.7 },
  audioDuration: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  postMoreButton: { minWidth: 64, minHeight: 44, marginTop: spacing.xs, alignSelf: 'flex-end', alignItems: 'flex-end', justifyContent: 'center' },
  postMoreText: { color: colors.life, fontFamily: typography.mono, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  postFooter: { marginTop: spacing.md },
  postFooterAfterMore: { marginTop: 0 },
  postTime: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  empty: { paddingVertical: spacing.xl, color: colors.inkFaint, fontFamily: typography.display, fontSize: 15, lineHeight: 26 },
  onboardingBackdrop: { backgroundColor: colors.backdropStrong },
  onboardingSheet: { maxHeight: '100%', backgroundColor: colors.sheet },
  onboardingScroll: { flexGrow: 0, maxHeight: '100%' },
  onboardingContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  onboardingLabel: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.5 },
  onboardingTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 28, lineHeight: 39 },
  onboardingText: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 11, lineHeight: 20 },
  onboardingInput: { minHeight: 50, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  onboardingCalendar: { marginTop: spacing.md },
  onboardingCalendarLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  onboardingSegmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.paper },
  onboardingSegment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  onboardingSegmentActive: { backgroundColor: colors.sheet },
  onboardingSegmentText: { color: colors.inkFaint, fontSize: 11 },
  onboardingSegmentTextActive: { color: colors.life, fontWeight: '700' },
  onboardingButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  onboardingButtonText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  onboardingSkip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  onboardingSkipText: { color: colors.inkFaint, fontSize: 10 },
}));
