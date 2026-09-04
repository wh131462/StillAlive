import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { PersonEvent, Post } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { genderOption } from './gender-picker';
import { extractAudioEmbeds } from '../journal/embedded-media';
import { constellationForBirthday, formatBirthday, nextBirthday, personDisplayName, toLocalDayKey, zodiacForBirthday } from './person-profile';
import { createThemedStyles, nameTextStyle } from '../../shared/theme/app-theme';
import { extractMusicShares, withoutMusicShares } from '../../application/music-share';
import { readingSourceTitle, withoutReadingSourceQuote } from '../../application/reading-share';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { MediaThumbnail } from '../../shared/components/media-thumbnail';
import { feedback } from '../../shared/feedback';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';

export default function PersonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { albums, deletePersonEvent, getPostsByPerson, media, mergePersons, musicCollectionEntries, people, personBooks, personTags, personEvents, posts: allPosts, preferences, readingNoteSources, ready, savePersonEvent, setPersonMemoryEnabled, tagDefinitions, tagSystemSettings, todayCheckIn } = useAppState();
  const [posts, setPosts] = useState<Post[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'posts' | 'events'>('all');
  const [timelineGroup, setTimelineGroup] = useState<'date' | 'time'>('date');
  const [showPrivate, setShowPrivate] = useState(false);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const person = useMemo(() => people.find((item) => item.id === id), [id, people]);
  const displayName = person ? personDisplayName(person) : '';
  const avatar = person?.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
  const gender = genderOption(person?.gender ?? null);
  const personAssignments = personTags.filter((item) => item.personId === person?.id);
  const enabledSystems = new Set(tagSystemSettings.filter((item) => item.enabled).map((item) => item.system));
  const labels = person ? [
    enabledSystems.has('mbti') ? personAssignments.find((item) => item.kind === 'mbti')?.value : null,
    enabledSystems.has('constellation') && person.birthday ? constellationForBirthday(person.birthday) : null,
    enabledSystems.has('zodiac') && person.birthday ? `${zodiacForBirthday(person.birthday)}年` : null,
    ...(enabledSystems.has('custom') ? personAssignments.filter((item) => item.kind === 'custom').map((item) => tagDefinitions.find((tag) => tag.id === item.value)?.name ?? null) : []),
  ].filter((value): value is string => Boolean(value)) : [];

  useEffect(() => {
    if (!ready || !id) return;
    void getPostsByPerson(id).then(setPosts);
  }, [allPosts, getPostsByPerson, id, ready]);

  useEffect(() => {
    if (ready && !person) router.replace('/people');
  }, [person, ready, router]);

  const personMusicCount = person ? musicCollectionEntries.filter((entry) => entry.targetType === 'person' && entry.targetId === person.id).length : 0;
  const personBookCount = person ? personBooks.filter((entry) => entry.personId === person.id).length : 0;
  const events = person ? personEvents.filter((event) => event.personId === person.id) : [];
  const privateHidden = person?.privacyMode === 'private' && !showPrivate;
  const timelineItems = [
    ...(timelineFilter !== 'events' ? posts.map((post) => ({ kind: 'post' as const, key: post.id, date: post.dayKey, post })) : []),
    ...(timelineFilter !== 'posts' ? events.map((event) => ({ kind: 'event' as const, key: event.id, date: timelineGroup === 'date' ? event.createdAt.slice(0, 10) : event.timeText ?? '未标注时间', event })) : []),
  ].sort((left, right) => (right.kind === 'event' && right.event.pinned ? 1 : 0) - (left.kind === 'event' && left.event.pinned ? 1 : 0) || right.date.localeCompare(left.date));

  const openMergePicker = () => {
    if (!person) return;
    const candidates = people.filter((item) => item.id !== person.id);
    if (!candidates.length) { feedback.alert('暂无可合并人物', '请先创建另一个人物记录。'); return; }
    setMergeSelection([]);
    setMergePickerOpen(true);
  };

  const confirmMerge = () => {
    if (!person || !mergeSelection.length) return;
    const sourceNames = people.filter((item) => mergeSelection.includes(item.id)).map((item) => personDisplayName(item)).join('、');
    setMergePickerOpen(false);
    feedback.alert('确认合并人物', `目标：${displayName}\n来源：${sourceNames}\n来源人物的记录、相册、音乐、书籍和资料将归入目标人物。`, [{ text: '取消', style: 'cancel' }, { text: '确认合并', style: 'destructive', onPress: () => void mergePersons(person.id, mergeSelection).then(() => feedback.alert('合并完成', '重复人物及其关联记录已归入当前人物。'), (cause: unknown) => feedback.alert('合并失败', cause instanceof Error ? cause.message : '请稍后重试。')) }]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ToolPageHeader
        onBack={() => router.back()}
        right={person ? <ToolPageHeaderAction accessibilityLabel="编辑人物" onPress={() => router.push({ pathname: '/person/edit', params: { id: person.id } })}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={20} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction> : undefined}
        title="人物详情"
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {person ? (
          <>
            <View style={styles.identityCard}>
              <View style={styles.identityRow}>
                <View style={styles.avatar}>{avatar ? <Image accessibilityLabel={`${displayName}的头像`} resizeMode="cover" source={{ uri: avatar.localPath }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{displayName.slice(0, 1)}</Text>}</View>
                <View style={styles.identityCopy}>
                  <Text numberOfLines={2} style={[styles.name, nameTextStyle(preferences.friendNameStyle)]}>{displayName}</Text>
                  <View style={styles.relationPill}><Text numberOfLines={1} style={styles.relation}>{person.relationToMe ?? '暂时不定义关系'}</Text></View>
                </View>
              </View>
              <View style={styles.impressionBlock}>
                {person.bio ? <><Text style={styles.impressionLabel}>个人简介</Text><Text style={styles.impression}>{person.bio}</Text></> : null}
                <Text style={styles.impressionLabel}>关于 ta 的印象</Text>
                <Text style={[styles.impression, !person.impression && styles.impressionEmpty]}>{person.impression ?? '还没有留下印象'}</Text>
                {person.privacyMode === 'private' ? <Text style={styles.privateBadge}>资料已隐藏</Text> : null}
              </View>
            </View>

            <View style={styles.sectionHeading}><Text style={styles.sectionEyebrow}>人物资料</Text></View>
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>性别</Text>
                <View style={styles.profileValue}>{gender ? <View style={styles.genderValue}><SymbolView fallback={<Text style={styles.genderFallback}>{gender.glyph}</Text>} name={gender.icon} size={16} tintColor={colors.life} type="hierarchical" /><Text style={styles.profileMetaTitle}>{gender.label}</Text></View> : <Text style={styles.profileEmpty}>未设置</Text>}</View>
              </View>
              <View style={styles.profileDivider} />
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>生日</Text>
                <View style={styles.profileValue}>
                  {person.birthday ? <><Text style={styles.profileMetaTitle}>{formatBirthday(person.birthday)}</Text><Text style={styles.profileMetaHint}>下一次 {toLocalDayKey(nextBirthday(person.birthday))}</Text></> : <Text style={styles.profileEmpty}>还没有记录生日</Text>}
                </View>
              </View>
              <View style={styles.profileDivider} />
              <View style={[styles.profileRow, styles.tagRow]}>
                <Text style={styles.profileLabel}>联系</Text>
                <View style={styles.profileValue}>
                  {privateHidden ? <Text style={styles.profileEmpty}>资料已隐藏</Text> : person.contacts.length ? person.contacts.map((contact) => <Pressable key={contact.id} onLongPress={() => void Clipboard.setStringAsync(contact.value).then(() => feedback.alert('已复制', `${contact.type}已复制到剪贴板。`))} onPress={() => { if (/手机|电话/u.test(contact.type)) void Linking.openURL(`tel:${contact.value}`).catch(() => feedback.alert('无法拨号', '请手动复制联系方式。')); }} style={styles.contactLine}><Text numberOfLines={1} style={styles.contactType}>{contact.type}</Text><Text selectable style={styles.contactValue}>{contact.value}</Text></Pressable>) : <Text style={styles.profileEmpty}>还没有联系方式</Text>}
                </View>
              </View>
              <View style={styles.profileDivider} />
              <View style={[styles.profileRow, styles.tagRow]}>
                <Text style={styles.profileLabel}>标签</Text>
                <View style={styles.profileValue}>
                  {labels.length ? <View style={styles.tags}>{labels.map((label) => <View key={label} style={styles.tag}><Text style={styles.tagText}>{label}</Text></View>)}</View> : <Text style={styles.profileEmpty}>还没有人物标签</Text>}
                </View>
              </View>
              {!privateHidden && Object.entries(person.customFields).map(([key, value]) => <View key={key}><View style={styles.profileDivider} /><View style={[styles.profileRow, styles.tagRow]}><Text style={styles.profileLabel}>{key}</Text><View style={styles.profileValue}><Text selectable style={styles.profileMetaTitle}>{value}</Text></View></View></View>)}
              {!privateHidden && person.importantDates.map((item) => <View key={item.id}><View style={styles.profileDivider} /><View style={[styles.profileRow, styles.tagRow]}><Text style={styles.profileLabel}>{item.name}</Text><View style={styles.profileValue}><Text style={styles.profileMetaTitle}>{item.date}</Text>{item.note ? <Text style={styles.profileMetaHint}>{item.note}</Text> : null}</View></View></View>)}
            </View>
            {person.privacyMode === 'private' ? <Pressable accessibilityRole="button" onPress={() => setShowPrivate((value) => !value)} style={styles.privateToggle}><Text style={styles.privateToggleText}>{privateHidden ? '查看隐私资料' : '隐藏隐私资料'}</Text></Pressable> : null}
            {privateHidden ? null : <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/profile-collection/invite', params: { personId: person.id } })} style={({ pressed }) => [styles.collectionButton, pressed && styles.featureRowPressed]}>
              <View style={styles.collectionIcon}><SymbolView name={{ android: 'send', ios: 'paperplane.fill', web: 'send' }} size={18} tintColor={colors.life} type="hierarchical" /></View>
              <View style={styles.featureCopy}><Text style={styles.featureTitle}>邀请本人填写</Text><Text style={styles.featureHint}>请对方亲自回答，再由你逐项确认</Text></View>
              <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={16} tintColor={colors.inkFaint} type="hierarchical" />
            </Pressable>}

            <View style={styles.sectionHeading}><Text style={styles.sectionEyebrow}>收藏与回忆</Text></View>
            <View style={styles.featureCard}>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/person/music', params: { personId: person.id } })} style={({ pressed }) => [styles.featureRow, pressed && styles.featureRowPressed]}>
                <View style={styles.featureCopy}><Text style={styles.featureTitle}>喜欢的音乐</Text><Text style={styles.featureHint}>收藏 {displayName} 喜欢的音乐</Text></View>
                <View style={styles.featureMeta}><Text style={styles.albumCount}>{personMusicCount} 首</Text><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={16} tintColor={colors.inkFaint} type="hierarchical" /></View>
              </Pressable>
              <View style={styles.featureDivider} />
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/person/books', params: { personId: person.id } })} style={({ pressed }) => [styles.featureRow, pressed && styles.featureRowPressed]}>
                <View style={styles.featureCopy}><Text style={styles.featureTitle}>喜欢的书籍</Text><Text style={styles.featureHint}>收藏 {displayName} 喜欢的书籍</Text></View>
                <View style={styles.featureMeta}><Text style={styles.albumCount}>{personBookCount} 本</Text><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={16} tintColor={colors.inkFaint} type="hierarchical" /></View>
              </Pressable>
              <View style={styles.featureDivider} />
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/person/albums', params: { personId: person.id } })} style={({ pressed }) => [styles.featureRow, pressed && styles.featureRowPressed]}>
                <View style={styles.featureCopy}><Text style={styles.featureTitle}>人物相册</Text><Text style={styles.featureHint}>按文件夹整理只属于 {displayName} 的照片和视频</Text></View>
                <View style={styles.featureMeta}><Text style={styles.albumCount}>{albums.filter((album) => album.personId === person.id).length} 个</Text><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={16} tintColor={colors.inkFaint} type="hierarchical" /></View>
              </Pressable>
              <View style={styles.featureDivider} />
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: person.memoryEnabled }} onPress={() => void setPersonMemoryEnabled(person.id, !person.memoryEnabled)} style={({ pressed }) => [styles.featureRow, pressed && styles.featureRowPressed]}>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>空间回忆</Text>
                  <Text style={styles.featureHint}>{person.memoryEnabled ? `会偶尔在空间里想起 ${displayName}` : '已关闭，记录仍会完整保留'}</Text>
                </View>
                <View style={[styles.memorySwitch, person.memoryEnabled && styles.memorySwitchOn]}><View style={[styles.memoryThumb, person.memoryEnabled && styles.memoryThumbOn]} /></View>
              </Pressable>
              <View style={styles.featureDivider} />
              <Pressable accessibilityRole="button" onPress={openMergePicker} style={({ pressed }) => [styles.featureRow, pressed && styles.featureRowPressed]}><View style={styles.featureCopy}><Text style={styles.featureTitle}>合并重复人物</Text><Text style={styles.featureHint}>从人物列表中选择要合并到这里的重复记录</Text></View><SymbolView name={{ android: 'merge_type', ios: 'arrow.triangle.merge', web: 'merge_type' }} size={16} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
            </View>

            <View style={styles.sectionLine}><View><Text style={styles.sectionTitle}>共同留下的日子</Text><Text style={styles.count}>{timelineItems.length} 条</Text></View><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/person/event', params: { id: person.id } })} style={({ pressed }) => [styles.writeEventButton, pressed && styles.featureRowPressed]}><Text style={styles.writeEventText}>写经历</Text><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={16} tintColor={colors.onLife} type="hierarchical" /></Pressable></View>
            <View style={styles.timelineControls}><View style={styles.controlRow}>{(['all', 'posts', 'events'] as const).map((filter) => <Pressable key={filter} onPress={() => setTimelineFilter(filter)} style={[styles.controlChip, timelineFilter === filter && styles.controlChipActive]}><Text style={[styles.controlChipText, timelineFilter === filter && styles.controlChipTextActive]}>{filter === 'all' ? '全部' : filter === 'posts' ? '记录' : '经历'}</Text></Pressable>)}</View><View style={styles.controlRow}>{(['date', 'time'] as const).map((group) => <Pressable key={group} onPress={() => setTimelineGroup(group)} style={[styles.controlChip, timelineGroup === group && styles.controlChipActive]}><Text style={[styles.controlChipText, timelineGroup === group && styles.controlChipTextActive]}>{group === 'date' ? '按日期' : '按模糊时间'}</Text></Pressable>)}</View></View>
            {timelineItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>记忆还没有落到纸上</Text>
                <Text style={styles.emptyText}>{todayCheckIn ? '写下一条记录，它会自动留在这里。' : '今天打卡后，就可以写下第一条共同记忆。'}</Text>
              </View>
            ) : timelineItems.map((item, index) => {
              const previous = timelineItems[index - 1];
              const groupChanged = !previous || previous.date !== item.date;
              if (item.kind === 'event') return <View key={item.key}>{groupChanged ? <Text style={styles.groupLabel}>{item.date}</Text> : null}<EventCard event={item.event} onPress={() => router.push({ pathname: '/person/event-detail', params: { id: person.id, eventId: item.event.id } })} /></View>;
              const post = item.post;
              const imageId = firstMediaId(post.bodyMarkdown);
              const image = imageId ? media.find((item) => item.id === imageId) : undefined;
              const readingSource = readingNoteSources.find((source) => source.postId === post.id) ?? null;
              const body = markdownToPlainText(withoutReadingSourceQuote(post.bodyMarkdown, readingSource));
              return (
                <View key={post.id}>{groupChanged ? <Text style={styles.groupLabel}>{item.date}</Text> : null}<Pressable accessibilityRole="button" onPress={() => router.push(`/post/${post.id}`)} style={({ pressed }) => [styles.memory, pressed && styles.memoryPressed]}>
                  <Text style={styles.date}>{post.dayKey.replaceAll('-', '.')}</Text>
                  {image ? <MediaThumbnail accessibilityLabel="共同记忆媒体" item={image} style={styles.memoryImage} /> : null}
                  <Text style={styles.body}>{body || (readingSource ? `读了《${readingSourceTitle(readingSource)}》` : extractMusicShares(post.bodyMarkdown)[0] ? `分享了《${extractMusicShares(post.bodyMarkdown)[0].title}》` : extractAudioEmbeds(post.bodyMarkdown).length ? `${extractAudioEmbeds(post.bodyMarkdown).length} 段语音` : image?.mimeType.startsWith('video/') ? '一段视频' : '一张照片')}</Text>
                </Pressable></View>
              );
            })}
          </>
        ) : ready ? (
          <Text style={styles.missing}>这个人物不存在或已被删除。</Text>
        ) : null}
      </ScrollView>
      <DraggableBottomSheet accessibilityLabel="选择要合并的人物，向下拖动关闭" onClose={() => setMergePickerOpen(false)} open={mergePickerOpen} sheetStyle={styles.mergeSheet}>
        <Text style={styles.mergeTitle}>选择重复人物</Text>
        <Text style={styles.mergeHint}>勾选一个或多个重复记录，它们的资料和关联内容会归入“{displayName}”。</Text>
        <ScrollView contentContainerStyle={styles.mergeListContent} style={styles.mergeList} showsVerticalScrollIndicator={false}>
          {people.filter((item) => item.id !== person?.id).map((member) => {
            const selected = mergeSelection.includes(member.id);
            return <Pressable key={member.id} accessibilityLabel={`选择${personDisplayName(member)}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setMergeSelection((current) => selected ? current.filter((value) => value !== member.id) : [...current, member.id])} style={({ pressed }) => [styles.mergeCandidate, selected && styles.mergeCandidateSelected, pressed && styles.featureRowPressed]}>
              <View style={[styles.mergeAvatar, selected && styles.mergeAvatarSelected]}><Text style={[styles.mergeAvatarText, selected && styles.mergeAvatarTextSelected]}>{personDisplayName(member).slice(0, 1)}</Text></View>
              <View style={styles.mergeCandidateCopy}><Text numberOfLines={1} style={styles.mergeCandidateName}>{personDisplayName(member)}</Text><Text numberOfLines={1} style={styles.mergeCandidateMeta}>{member.relationToMe ?? '未设置关系'}</Text></View>
              <View style={[styles.mergeCheckbox, selected && styles.mergeCheckboxSelected]}>{selected ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={15} tintColor={colors.onLife} type="hierarchical" /> : null}</View>
            </Pressable>;
          })}
        </ScrollView>
        <Pressable accessibilityRole="button" disabled={!mergeSelection.length} onPress={confirmMerge} style={[styles.mergeConfirm, !mergeSelection.length && styles.disabled]}><Text style={styles.mergeConfirmText}>{mergeSelection.length ? `继续合并（${mergeSelection.length}）` : '请选择人物'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setMergePickerOpen(false)} style={styles.mergeCancel}><Text style={styles.mergeCancelText}>取消</Text></Pressable>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

function markdownToPlainText(markdown: string): string {
  return withoutMusicShares(markdown).replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/^#{1,3}\s+/gm, '').replace(/^[-*>]\s+/gm, '').replace(/[*_`]/g, '').trim();
}

function firstMediaId(markdown: string): string | null {
  return markdown.match(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/)?.[1] ?? null;
}

function EventCard({ event, onPress }: { event: PersonEvent; onPress(): void }) {
  return <Pressable accessibilityLabel={`打开经历：${event.title}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.eventCard, pressed && styles.memoryPressed]}>
    <View style={styles.eventCardHead}><View style={styles.eventMarker}><SymbolView name={{ android: 'auto_awesome', ios: 'sparkles', web: 'auto_awesome' }} size={16} tintColor={colors.life} type="hierarchical" /></View><View style={styles.eventCardMeta}><Text style={styles.eventEyebrow}>经历{event.pinned ? ' / 已置顶' : ''}</Text><Text numberOfLines={1} style={styles.eventTime}>{event.timeText || '时间待补充'}</Text></View><SymbolView name={{ android: 'more_vert', ios: 'ellipsis', web: 'more_vert' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></View>
    <Text style={styles.eventTitle}>{event.title}</Text>
    {event.description ? <Text numberOfLines={4} style={styles.eventBody}>{event.description}</Text> : <Text style={styles.eventEmpty}>还没有补充更多细节</Text>}
    <Text style={styles.eventOpenHint}>进入详情查看</Text>
  </Pressable>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  identityCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 38, backgroundColor: colors.life },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 31 },
  identityCopy: { flex: 1, marginLeft: spacing.lg, alignItems: 'flex-start' },
  name: { color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 38 },
  relationPill: { maxWidth: '100%', marginTop: spacing.sm, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.lifeLight },
  relation: { color: colors.life, fontSize: 10 },
  privateBadge: { marginTop: spacing.sm, color: colors.danger, fontSize: 10 },
  impressionBlock: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  impressionLabel: { color: colors.inkFaint, fontSize: typography.size.meta },
  impression: { marginTop: spacing.sm, color: colors.inkSoft, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  impressionEmpty: { color: colors.inkFaint, fontFamily: typography.body, fontSize: 11 },
  sectionHeading: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionEyebrow: { color: colors.inkFaint, fontSize: typography.size.meta, letterSpacing: 1.1 },
  profileCard: { paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.sheet },
  profileRow: { minHeight: 70, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center' },
  tagRow: { alignItems: 'flex-start' },
  profileLabel: { width: 58, paddingTop: 1, color: colors.inkFaint, fontSize: 11 },
  profileValue: { flex: 1 },
  genderValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  genderFallback: { width: 16, color: colors.life, fontSize: 16, lineHeight: 19, textAlign: 'center' },
  profileMetaTitle: { color: colors.ink, fontSize: 12 },
  profileMetaHint: { marginTop: 5, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  profileEmpty: { color: colors.inkFaint, fontSize: 10 },
  contactLine: { minHeight: 28, flexDirection: 'row', alignItems: 'flex-start' },
  contactType: { width: 72, color: colors.inkFaint, fontSize: 10 },
  contactValue: { minWidth: 0, flex: 1, color: colors.ink, fontSize: 12 },
  profileDivider: { marginLeft: 58, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  privateToggle: { minHeight: 44, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.lifeLight },
  privateToggleText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  collectionButton: { minHeight: 76, marginTop: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet },
  collectionIcon: { width: 38, height: 38, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lifeLight },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: colors.lifeLight },
  tagText: { color: colors.life, fontSize: 9 },
  featureCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  featureRow: { minHeight: 76, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center' },
  featureRowPressed: { opacity: 0.58 },
  featureCopy: { flex: 1, paddingRight: spacing.md },
  featureTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  featureHint: { marginTop: 5, color: colors.inkFaint, fontSize: 9, lineHeight: 15 },
  featureMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  featureDivider: { marginLeft: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  albumCount: { color: colors.life, fontSize: 10 },
  memorySwitch: { width: 40, height: 24, padding: 3, justifyContent: 'center', borderRadius: 12, backgroundColor: colors.line },
  memorySwitchOn: { backgroundColor: colors.life },
  memoryThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.sheet },
  memoryThumbOn: { alignSelf: 'flex-end' },
  sectionLine: { marginTop: spacing.xxl, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  count: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  emptyCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 20 },
  memory: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  memoryPressed: { opacity: 0.62 },
  timelineControls: { marginTop: spacing.md, gap: spacing.sm },
  controlRow: { flexDirection: 'row', gap: spacing.sm },
  controlChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.sheet },
  controlChipActive: { backgroundColor: colors.life },
  controlChipText: { color: colors.inkSoft, fontSize: 10 },
  controlChipTextActive: { color: colors.onLife, fontWeight: '700' },
  writeEventButton: { minHeight: 38, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 19, backgroundColor: colors.life },
  writeEventText: { color: colors.onLife, fontSize: 10, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  eventCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.sheet },
  eventCardHead: { flexDirection: 'row', alignItems: 'center' },
  eventMarker: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.lifeLight },
  eventCardMeta: { minWidth: 0, flex: 1, marginLeft: spacing.sm },
  eventEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  groupLabel: { marginTop: spacing.md, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  eventTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  eventTime: { marginTop: spacing.xs, color: colors.life, fontFamily: typography.mono, fontSize: 10 },
  eventBody: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, lineHeight: 20 },
  eventEmpty: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 11 },
  eventOpenHint: { marginTop: spacing.md, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 0.6 },
  mergeSheet: { maxHeight: '86%', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  mergeTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  mergeHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  mergeList: { marginTop: spacing.md },
  mergeListContent: { paddingBottom: spacing.xs },
  mergeCandidate: { minHeight: 68, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  mergeCandidateSelected: { backgroundColor: colors.lifeLight },
  mergeAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lineSoft },
  mergeAvatarSelected: { backgroundColor: colors.life },
  mergeAvatarText: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 16 },
  mergeAvatarTextSelected: { color: colors.onLife },
  mergeCandidateCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  mergeCandidateName: { color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  mergeCandidateMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  mergeCheckbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  mergeCheckboxSelected: { borderColor: colors.life, backgroundColor: colors.life },
  mergeConfirm: { minHeight: 50, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  mergeConfirmText: { color: colors.onLife, fontSize: 11, fontWeight: '800' },
  mergeCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  mergeCancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' },
  date: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  memoryImage: { width: '100%', height: 190, marginTop: spacing.md, backgroundColor: colors.lifeLight },
  body: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 28 },
  missing: { marginTop: spacing.xxl, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
}));
