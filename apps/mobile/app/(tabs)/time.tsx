import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CheckIn, DayKey, Post } from '@still-alive/types';
import { toDayKey } from '@still-alive/core';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { SolarDay } from 'tyme4ts';
import { useAppState } from '../../src/state/app-state';
import { extractAudioEmbeds } from '../../src/domain/embedded-media';
import { TabPageHeader } from '../../src/components/tab-page-header';
import { createThemedStyles } from '../../src/theme/app-theme';

type CalendarMarkerKind = 'check-in' | 'text' | 'image' | 'audio';

export default function CalendarScreen() {
  const router = useRouter();
  const { checkIns, posts, today, todayCheckIn } = useAppState();
  const [activeMonth, setActiveMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<DayKey>(today);
  const checkInDays = useMemo(() => new Set(checkIns.map((item) => item.dayKey)), [checkIns]);
  const selectedCheckIn = checkIns.find((item) => item.dayKey === selectedDay);
  const selectedPosts = posts.filter((post) => post.dayKey === selectedDay).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const openEditorForDay = (dayKey: DayKey) => {
    if (dayKey === today && !todayCheckIn) {
      router.push('/');
      return;
    }
    router.push({ pathname: '/editor', params: { dayKey } });
  };

  const changeMonth = (offset: number) => {
    const next = shiftMonth(activeMonth, offset);
    if (next > today.slice(0, 7)) return;
    setActiveMonth(next);
    const firstDay = `${next}-01` as DayKey;
    setSelectedDay(firstDay > today ? today : firstDay);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TabPageHeader eyebrow="CALENDAR" subtitle="每一个圆点，都是生活的痕迹。" title="日历" />
        <CalendarView
          activeMonth={activeMonth}
          checkInDays={checkInDays}
          onChangeMonth={changeMonth}
          onOpenPost={(postId) => router.push(`/post/${postId}`)}
          onSelectDay={setSelectedDay}
          onWrite={openEditorForDay}
          posts={posts}
          selectedCheckIn={selectedCheckIn}
          selectedDay={selectedDay}
          selectedPosts={selectedPosts}
          today={today}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

interface CalendarViewProps {
  activeMonth: string;
  checkInDays: Set<DayKey>;
  onChangeMonth(offset: number): void;
  onOpenPost(postId: string): void;
  onSelectDay(dayKey: DayKey): void;
  onWrite(dayKey: DayKey): void;
  posts: Post[];
  selectedCheckIn?: CheckIn;
  selectedDay: DayKey;
  selectedPosts: Post[];
  today: DayKey;
}

function CalendarView({ activeMonth, checkInDays, onChangeMonth, onOpenPost, onSelectDay, onWrite, posts, selectedCheckIn, selectedDay, selectedPosts, today }: CalendarViewProps) {
  const weeks = useMemo(() => {
    const cells = calendarCells(activeMonth);
    return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  }, [activeMonth]);
  const postsByDay = useMemo(() => {
    const values = new Map<DayKey, Post[]>();
    for (const post of posts) values.set(post.dayKey, [...(values.get(post.dayKey) ?? []), post]);
    return values;
  }, [posts]);
  const selectedLunarDate = lunarDateInfo(selectedDay);
  const selectedItemCount = selectedPosts.length + Number(Boolean(selectedCheckIn));
  const canNext = activeMonth < today.slice(0, 7);
  const [year, month] = activeMonth.split('-');

  return (
    <View style={styles.calendarSection}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.calendarYear}>{year} MONTH {month}</Text>
          <Text style={styles.calendarTitle}>{Number(month)} 月</Text>
        </View>
        <View style={styles.monthArrows}>
          <Pressable accessibilityLabel="上一个月" accessibilityRole="button" onPress={() => onChangeMonth(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable>
          <Pressable accessibilityLabel="下一个月" accessibilityRole="button" disabled={!canNext} onPress={() => onChangeMonth(1)} style={[styles.monthArrow, !canNext && styles.monthArrowDisabled]}><Text style={styles.monthArrowText}>›</Text></Pressable>
        </View>
      </View>
      <View style={styles.weekRow}>{['一', '二', '三', '四', '五', '六', '日'].map((day, index) => <Text key={day} style={[styles.weekLabel, index > 4 && styles.weekLabelWeekend]}>周{day}</Text>)}</View>
      <View style={styles.calendarGrid}>
        {weeks.map((week, rowIndex) => (
          <View key={`week_${rowIndex}`} style={styles.calendarWeek}>
            {week.map((dayKey, columnIndex) => {
              const dividers = [columnIndex < 6 && styles.calendarCellColumnDivider, rowIndex < weeks.length - 1 && styles.calendarCellRowDivider];
              if (!dayKey) return <View key={`empty_${rowIndex}_${columnIndex}`} style={[styles.calendarCell, ...dividers, styles.calendarCellEmpty]} />;
              const dayPosts = postsByDay.get(dayKey) ?? [];
              const itemCount = dayPosts.length + Number(checkInDays.has(dayKey));
              const markers: CalendarMarkerKind[] = [
                ...(checkInDays.has(dayKey) ? ['check-in' as const] : []),
                ...dayPosts.map((post) => postMarkerKind(post.bodyMarkdown)),
              ].slice(0, 3);
              const future = dayKey > today;
              const selected = dayKey === selectedDay;
              const isToday = dayKey === today;
              const lunarDate = lunarDateInfo(dayKey);
              return (
                <Pressable
                  key={dayKey}
                  accessibilityLabel={`${dayKey}${lunarDate ? `，农历${lunarDate.fullLabel}` : ''}${itemCount ? `，有 ${itemCount} 条内容` : ''}`}
                  accessibilityRole="button"
                  disabled={future}
                  onPress={() => onSelectDay(dayKey)}
                  style={[styles.calendarCell, ...dividers, selected && styles.calendarCellSelected, future && styles.calendarCellFuture]}
                >
                  <View style={styles.calendarDayRow}>
                    <Text style={[styles.calendarDay, isToday && styles.calendarDayToday, selected && styles.calendarDaySelected]}>{Number(dayKey.slice(8))}</Text>
                    {isToday ? <View style={styles.todayMark}><Text style={styles.todayMarkText}>今</Text></View> : null}
                  </View>
                  {lunarDate ? <Text numberOfLines={1} style={[styles.lunarDay, lunarDate.emphasis && styles.lunarFestival, selected && styles.lunarDaySelected]}>{lunarDate.shortLabel}</Text> : null}
                  {markers.length ? (
                    <View style={styles.calendarMarks}>
                      {markers.map((kind, index) => <View key={`${dayKey}_mark_${index}`} style={[styles.calendarMark, { backgroundColor: markerColor(kind) }]} />)}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.calendarLegend}>
        <LegendItem kind="check-in" label="打卡" />
        <LegendItem kind="text" label="文字" />
        <LegendItem kind="image" label="图片" />
        <LegendItem kind="audio" label="录音" />
        <Text style={styles.legendText}>最多 3 个</Text>
      </View>

      <View style={styles.selectedPanel}>
        <View style={styles.selectedHeader}>
          <View style={styles.selectedDateBlock}>
            <Text style={styles.selectedDate}>{selectedDay.replaceAll('-', '.')} {chineseWeekdayLabel(selectedDay)}</Text>
            {selectedLunarDate ? <Text style={styles.selectedLunar}>农历 {selectedLunarDate.fullLabel}{selectedLunarDate.term ? ` ${selectedLunarDate.term}` : ''}</Text> : null}
            <Text style={styles.selectedHint}>{selectedItemCount ? `这一天留下了 ${selectedItemCount} 个片段` : '这一天还没有内容'}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => onWrite(selectedDay)} style={styles.writeButton}><Text style={styles.writeButtonText}>{selectedDay === today ? '写一条' : '补写一条'}</Text></Pressable>
        </View>
        {selectedItemCount ? (
          <View style={styles.selectedList}>
            {selectedCheckIn ? (
              <View style={styles.selectedEntry}>
                <View style={styles.selectedEntryRail}><View style={[styles.selectedEntryDot, { backgroundColor: markerColor('check-in') }]} /></View>
                <View style={styles.selectedEntryContent}>
                  <Text style={styles.selectedEntryMeta}>打卡 · {selectedCheckIn.city ? `${selectedCheckIn.city} · ` : ''}{formatTime(selectedCheckIn.createdAt)}</Text>
                  <Text style={styles.selectedCheckInTitle}>今天也在</Text>
                </View>
              </View>
            ) : null}
            {selectedPosts.map((post) => {
              const attachmentLabel = postAttachmentLabel(post.bodyMarkdown);
              const markerKind = postMarkerKind(post.bodyMarkdown);
              return (
                <Pressable key={post.id} accessibilityLabel={`打开 ${formatTime(post.createdAt)} 的记录`} accessibilityRole="button" onPress={() => onOpenPost(post.id)} style={({ pressed }) => [styles.selectedEntry, pressed && styles.selectedEntryPressed]}>
                  <View style={styles.selectedEntryRail}><View style={[styles.selectedEntryDot, { backgroundColor: markerColor(markerKind) }]} /></View>
                  <View style={styles.selectedEntryContent}>
                    <Text style={styles.selectedEntryMeta}>{markerLabel(markerKind)} · {post.locationName ? `${post.locationName} · ` : ''}{formatTime(post.createdAt)}{attachmentLabel ? ` · ${attachmentLabel}` : ''}</Text>
                    <Text numberOfLines={3} style={styles.selectedPostText}>{markdownToPlainText(post.bodyMarkdown) || attachmentLabel || '记录了一些内容'}</Text>
                  </View>
                  <Text accessibilityElementsHidden style={styles.selectedEntryArrow}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function LegendItem({ kind, label }: { kind: CalendarMarkerKind; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendMark, { backgroundColor: markerColor(kind) }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function calendarCells(month: string): Array<DayKey | null> {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(year, value - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const dayCount = new Date(year, value, 0).getDate();
  const cells: Array<DayKey | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= dayCount; day += 1) cells.push(toDayKey(new Date(year, value - 1, day)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function shiftMonth(month: string, offset: number): string {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function chineseWeekdayLabel(dayKey: DayKey): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return `周${['日', '一', '二', '三', '四', '五', '六'][new Date(year, month - 1, day).getDay()]}`;
}

interface LunarDateInfo {
  shortLabel: string;
  fullLabel: string;
  emphasis: boolean;
  term: string | null;
}

function lunarDateInfo(dayKey: DayKey): LunarDateInfo | null {
  try {
    const [year, month, day] = dayKey.split('-').map(Number);
    const solar = SolarDay.fromYmd(year, month, day);
    const lunar = solar.getLunarDay();
    const lunarMonth = lunar.getLunarMonth();
    const festival = lunar.getFestival()?.getName() ?? solar.getFestival()?.getName() ?? null;
    const term = solar.getTermDay().getDayIndex() === 0 ? solar.getTerm().getName() : null;
    return {
      shortLabel: festival ?? term ?? (lunar.getName() === '初一' ? lunarMonth.getName() : lunar.getName()),
      fullLabel: `${lunarMonth.getLunarYear().getName().replace(/^农历/, '')} ${lunarMonth.getName()}${lunar.getName()}`,
      emphasis: Boolean(festival || term),
      term,
    };
  } catch {
    return null;
  }
}

function markdownToPlainText(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/^#{1,3}\s+/gm, '').replace(/^[-*>]\s+/gm, '').replace(/[*_`]/g, '').trim();
}

function formatTime(iso: string): string {
  const value = new Date(iso);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function postAttachmentLabel(markdown: string): string {
  const imageCount = [...markdown.matchAll(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/g)].length;
  const audioCount = extractAudioEmbeds(markdown).length;
  return [imageCount ? `${imageCount} 张图片` : '', audioCount ? `${audioCount} 段语音` : ''].filter(Boolean).join(' · ');
}

function postMarkerKind(markdown: string): CalendarMarkerKind {
  if (extractAudioEmbeds(markdown).length) return 'audio';
  if (/!\[[^\]]*\]\(media:\/\/([^)]+)\)/.test(markdown)) return 'image';
  return 'text';
}

function markerColor(kind: CalendarMarkerKind): string {
  if (kind === 'check-in') return colors.inkFaint;
  if (kind === 'image') return colors.sun;
  if (kind === 'audio') return colors.danger;
  return colors.life;
}

function markerLabel(kind: CalendarMarkerKind): string {
  if (kind === 'check-in') return '打卡';
  if (kind === 'image') return '图片记录';
  if (kind === 'audio') return '录音记录';
  return '文字记录';
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  calendarSection: { marginTop: 0 },
  calendarHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarYear: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  calendarTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 37 },
  monthArrows: { flexDirection: 'row', gap: spacing.sm },
  monthArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 19, backgroundColor: colors.sheet },
  monthArrowDisabled: { opacity: 0.2 },
  monthArrowText: { color: colors.life, fontFamily: typography.display, fontSize: 25, lineHeight: 29 },
  weekRow: { flexDirection: 'row', marginTop: spacing.md, paddingBottom: spacing.sm },
  weekLabel: { flex: 1, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 0.3, textAlign: 'center' },
  weekLabelWeekend: { color: colors.sun },
  calendarGrid: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.sheet },
  calendarWeek: { flexDirection: 'row' },
  calendarCell: { flex: 1, aspectRatio: 0.72, paddingTop: 8, paddingHorizontal: 5, alignItems: 'center', overflow: 'hidden', backgroundColor: colors.sheet },
  calendarCellColumnDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  calendarCellRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  calendarCellEmpty: { backgroundColor: colors.paper, opacity: 0.46 },
  calendarCellSelected: { backgroundColor: colors.lifeLight },
  calendarCellFuture: { opacity: 0.3 },
  calendarDayRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 2 },
  calendarDay: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 16 },
  calendarDayToday: { color: colors.life, fontWeight: '700' },
  calendarDaySelected: { color: colors.life },
  todayMark: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.life },
  todayMarkText: { color: colors.onLife, fontSize: typography.size.meta, fontWeight: '700' },
  lunarDay: { maxWidth: '100%', color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 13 },
  lunarFestival: { color: colors.sun, fontWeight: '700' },
  lunarDaySelected: { color: colors.life },
  calendarMarks: { position: 'absolute', bottom: 7, flexDirection: 'row', gap: 3 },
  calendarMark: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.life },
  calendarLegend: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: colors.inkFaint, fontSize: typography.size.meta },
  legendMark: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.life },
  selectedPanel: { marginTop: spacing.lg, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedDateBlock: { flex: 1, paddingRight: spacing.md },
  selectedDate: { color: colors.life, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.1 },
  selectedLunar: { marginTop: 6, color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  selectedHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta },
  writeButton: { minWidth: 76, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.life },
  writeButtonText: { color: colors.onLife, fontSize: 10, fontWeight: '700' },
  selectedList: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  selectedEntry: { minHeight: 72, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  selectedEntryPressed: { marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.lifeLight },
  selectedEntryRail: { width: 20, alignSelf: 'stretch', alignItems: 'flex-start', paddingTop: 7 },
  selectedEntryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.life },
  selectedEntryContent: { flex: 1 },
  selectedEntryMeta: { marginBottom: 5, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, letterSpacing: 0.5 },
  selectedCheckInTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  selectedPostText: { color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  selectedEntryArrow: { marginLeft: spacing.sm, color: colors.life, fontFamily: typography.display, fontSize: 24, lineHeight: 28 },
}));
