import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DayKey, Post } from '@still-alive/types';
import { toDayKey } from '@still-alive/core';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { SolarDay } from 'tyme4ts';
import { useAppState } from '../../src/state/app-state';

type ViewMode = 'timeline' | 'calendar';

export default function TimeScreen() {
  const router = useRouter();
  const { checkIns, media, posts, today, todayCheckIn } = useAppState();
  const [mode, setMode] = useState<ViewMode>('timeline');
  const [activeMonth, setActiveMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<DayKey>(today);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const checkInDays = useMemo(() => new Set(checkIns.map((item) => item.dayKey)), [checkIns]);
  const monthKeys = useMemo(() => {
    const values = new Set([today.slice(0, 7), ...posts.map((post) => post.dayKey.slice(0, 7)), ...checkIns.map((item) => item.dayKey.slice(0, 7))]);
    return [...values].sort().reverse();
  }, [checkIns, posts, today]);
  const monthDays = useMemo(() => groupMonthDays(activeMonth, posts, checkInDays), [activeMonth, checkInDays, posts]);
  const selectedPosts = posts.filter((post) => post.dayKey === selectedDay);

  const selectMonth = (month: string) => {
    setActiveMonth(month);
    const latestDay = [...posts.map((post) => post.dayKey), ...checkIns.map((item) => item.dayKey)]
      .filter((dayKey) => dayKey.startsWith(month) && dayKey <= today)
      .sort()
      .at(-1);
    setSelectedDay(latestDay ?? `${month}-01` as DayKey);
  };

  const showCalendar = () => {
    setMode('calendar');
    if (!selectedDay.startsWith(activeMonth)) selectMonth(activeMonth);
  };

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
        <Text style={styles.label}>YOUR DAYS</Text>
        <Text style={styles.title}>日子没有消失，{`\n`}只是走到了身后。</Text>
        <Text style={styles.description}>打卡只是轻轻一点，留下的内容会在这里慢慢形成时间。</Text>

        <View style={styles.modeSwitch}>
          <ModeButton active={mode === 'timeline'} label="时间线" onPress={() => setMode('timeline')} />
          <ModeButton active={mode === 'calendar'} label="月历" onPress={showCalendar} />
        </View>

        {mode === 'timeline' ? (
          <>
            <ScrollView horizontal contentContainerStyle={styles.monthTabs} showsHorizontalScrollIndicator={false}>
              {monthKeys.map((month) => (
                <Pressable key={month} accessibilityRole="button" onPress={() => selectMonth(month)} style={[styles.monthTab, activeMonth === month && styles.monthTabActive]}>
                  <Text style={[styles.monthTabText, activeMonth === month && styles.monthTabTextActive]}>{shortMonth(month)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.monthRow}><Text style={styles.month}>{monthTitle(activeMonth)}</Text><View style={styles.monthLine} /></View>
            {monthDays.length === 0 ? (
              <Text style={styles.empty}>这个月还没有留下坐标。</Text>
            ) : monthDays.map((group) => (
              <View key={group.dayKey} style={styles.dayGroup}>
                <View style={styles.dayColumn}>
                  <Text style={styles.day}>{group.dayKey.slice(8)}</Text>
                  <Text style={styles.weekday}>{weekdayLabel(group.dayKey)}</Text>
                  <View style={[styles.dot, group.posts.length === 0 && styles.dotCheckIn]} />
                </View>
                <View style={styles.dayContent}>
                  {group.posts.length === 0 ? (
                    <Text style={styles.checkInOnly}>这一天，只留下了一个坐标。</Text>
                  ) : group.posts.map((post) => (
                    <TimelinePost key={post.id} mediaById={mediaById} onPress={() => router.push(`/post/${post.id}`)} post={post} />
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : (
          <CalendarView
            activeMonth={activeMonth}
            checkInDays={checkInDays}
            mediaById={mediaById}
            onChangeMonth={changeMonth}
            onOpenPost={(postId) => router.push(`/post/${postId}`)}
            onSelectDay={setSelectedDay}
            onWrite={openEditorForDay}
            posts={posts}
            selectedDay={selectedDay}
            selectedPosts={selectedPosts}
            today={today}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TimelinePost({ mediaById, onPress, post }: { mediaById: Map<string, { localPath: string }>; onPress(): void; post: Post }) {
  const imageId = firstMediaId(post.bodyMarkdown);
  const image = imageId ? mediaById.get(imageId) : undefined;
  const plainText = markdownToPlainText(post.bodyMarkdown);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
      {image ? <Image accessibilityLabel="日记图片" resizeMode="cover" source={{ uri: image.localPath }} style={styles.entryImage} /> : null}
      {plainText ? <Text style={styles.entryText}>{plainText}</Text> : null}
      <Text style={styles.entryMeta}>{formatTime(post.createdAt)} · {image ? '照片与文字' : 'Markdown'}</Text>
    </Pressable>
  );
}

interface CalendarViewProps {
  activeMonth: string;
  checkInDays: Set<DayKey>;
  mediaById: Map<string, { localPath: string }>;
  onChangeMonth(offset: number): void;
  onOpenPost(postId: string): void;
  onSelectDay(dayKey: DayKey): void;
  onWrite(dayKey: DayKey): void;
  posts: Post[];
  selectedDay: DayKey;
  selectedPosts: Post[];
  today: DayKey;
}

function CalendarView({ activeMonth, checkInDays, mediaById, onChangeMonth, onOpenPost, onSelectDay, onWrite, posts, selectedDay, selectedPosts, today }: CalendarViewProps) {
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
  const canNext = activeMonth < today.slice(0, 7);
  const [year, month] = activeMonth.split('-');
  return (
    <View style={styles.calendarSection}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.calendarYear}>{year} · MONTH {month}</Text>
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
              const imageId = dayPosts.map((post) => firstMediaId(post.bodyMarkdown)).find(Boolean);
              const image = imageId ? mediaById.get(imageId) : undefined;
              const future = dayKey > today;
              const selected = dayKey === selectedDay;
              const isToday = dayKey === today;
              const lunarDate = lunarDateInfo(dayKey);
              return (
                <Pressable
                  key={dayKey}
                  accessibilityLabel={`${dayKey}${lunarDate ? `，农历${lunarDate.fullLabel}` : ''}`}
                  accessibilityRole="button"
                  disabled={future}
                  onPress={() => onSelectDay(dayKey)}
                  style={[styles.calendarCell, ...dividers, selected && styles.calendarCellSelected, future && styles.calendarCellFuture]}
                >
                  {image ? <Image accessibilityLabel="当天图片缩略图" resizeMode="cover" source={{ uri: image.localPath }} style={styles.calendarThumb} /> : null}
                  <View style={styles.calendarDayRow}>
                    <Text style={[styles.calendarDay, isToday && styles.calendarDayToday, selected && styles.calendarDaySelected]}>{Number(dayKey.slice(8))}</Text>
                    {isToday ? <View style={styles.todayMark}><Text style={styles.todayMarkText}>今</Text></View> : null}
                  </View>
                  {lunarDate ? <Text numberOfLines={1} style={[styles.lunarDay, lunarDate.emphasis && styles.lunarFestival, selected && styles.lunarDaySelected]}>{lunarDate.shortLabel}</Text> : null}
                  {dayPosts.length ? <View style={styles.postMark} /> : checkInDays.has(dayKey) ? <View style={styles.checkInMark} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.calendarLegend}>
        <View style={styles.legendItem}><View style={styles.legendCheckIn} /><Text style={styles.legendText}>坐标</Text></View>
        <View style={styles.legendItem}><View style={styles.legendPost} /><Text style={styles.legendText}>日记</Text></View>
        <View style={styles.legendItem}><View style={styles.legendPhoto} /><Text style={styles.legendText}>图片</Text></View>
      </View>

      <View style={styles.selectedPanel}>
        <View style={styles.selectedHeader}>
          <View style={styles.selectedDateBlock}>
            <Text style={styles.selectedDate}>{selectedDay.replaceAll('-', '.')} · {chineseWeekdayLabel(selectedDay)}</Text>
            {selectedLunarDate ? <Text style={styles.selectedLunar}>农历 {selectedLunarDate.fullLabel}{selectedLunarDate.term ? ` · ${selectedLunarDate.term}` : ''}</Text> : null}
            <Text style={styles.selectedHint}>{checkInDays.has(selectedDay) ? '这一天留下了坐标' : selectedPosts.length ? '后来补写的日子' : '这一天还没有内容'}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => onWrite(selectedDay)} style={styles.writeButton}><Text style={styles.writeButtonText}>{selectedDay === today ? '写一条' : '补写一条'}</Text></Pressable>
        </View>
        {selectedPosts.map((post) => (
          <Pressable key={post.id} accessibilityRole="button" onPress={() => onOpenPost(post.id)} style={({ pressed }) => [styles.selectedPost, pressed && styles.pressed]}>
            <Text numberOfLines={3} style={styles.selectedPostText}>{markdownToPlainText(post.bodyMarkdown) || '一张照片'}</Text>
            <Text style={styles.selectedPostArrow}>查看 →</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function groupMonthDays(month: string, posts: Post[], checkInDays: Set<DayKey>): Array<{ dayKey: DayKey; posts: Post[] }> {
  const days = new Set<DayKey>();
  for (const post of posts) if (post.dayKey.startsWith(month)) days.add(post.dayKey);
  for (const dayKey of checkInDays) if (dayKey.startsWith(month)) days.add(dayKey);
  return [...days].sort().reverse().map((dayKey) => ({ dayKey, posts: posts.filter((post) => post.dayKey === dayKey) }));
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

function monthTitle(month: string): string {
  const [year, value] = month.split('-');
  return `${year} · ${Number(value)} 月`;
}

function shortMonth(month: string): string {
  const [year, value] = month.split('-');
  return `${year.slice(2)}.${value}`;
}

function weekdayLabel(dayKey: DayKey): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(year, month - 1, day).getDay()];
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

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function markdownToPlainText(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/^#{1,3}\s+/gm, '').replace(/^[-*>]\s+/gm, '').replace(/[*_`]/g, '').trim();
}

function firstMediaId(markdown: string): string | null {
  return markdown.match(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/)?.[1] ?? null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 },
  title: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 36, lineHeight: 47 },
  description: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 12, lineHeight: 21 },
  modeSwitch: { width: 174, height: 42, marginTop: spacing.xl, padding: 4, flexDirection: 'row', borderRadius: 21, backgroundColor: colors.sheet },
  modeButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  modeButtonActive: { backgroundColor: colors.life },
  modeText: { color: colors.inkFaint, fontSize: 10 },
  modeTextActive: { color: colors.onLife, fontWeight: '700' },
  monthTabs: { gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  monthTab: { minWidth: 54, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  monthTabActive: { borderColor: colors.life, backgroundColor: colors.lifeLight },
  monthTabText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  monthTabTextActive: { color: colors.life },
  monthRow: { marginTop: spacing.lg, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  month: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 },
  monthLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  empty: { color: colors.inkFaint, fontFamily: typography.display, fontSize: 15, lineHeight: 26 },
  dayGroup: { minHeight: 78, flexDirection: 'row' },
  dayColumn: { width: 68, position: 'relative', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  day: { color: colors.ink, fontFamily: typography.display, fontSize: 28 },
  weekday: { marginTop: 3, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  dot: { position: 'absolute', top: 8, right: -5, width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.paper, backgroundColor: colors.life },
  dotCheckIn: { backgroundColor: colors.sun },
  dayContent: { flex: 1, paddingLeft: spacing.lg, paddingBottom: spacing.lg },
  checkInOnly: { paddingTop: 5, color: colors.inkFaint, fontFamily: typography.display, fontSize: 13 },
  entry: { paddingBottom: spacing.lg },
  entryImage: { width: '100%', height: 148, marginBottom: spacing.md, borderTopRightRadius: 18, borderBottomLeftRadius: 18, backgroundColor: colors.lifeLight },
  entryText: { color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 28 },
  entryMeta: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 9 },
  pressed: { opacity: 0.62 },
  calendarSection: { marginTop: spacing.xl },
  calendarHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarYear: { color: colors.life, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.2 },
  calendarTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 37 },
  monthArrows: { flexDirection: 'row', gap: spacing.sm },
  monthArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 19, backgroundColor: colors.sheet },
  monthArrowDisabled: { opacity: 0.2 },
  monthArrowText: { color: colors.life, fontFamily: typography.display, fontSize: 25, lineHeight: 29 },
  weekRow: { flexDirection: 'row', marginTop: spacing.md, paddingBottom: spacing.sm },
  weekLabel: { flex: 1, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, letterSpacing: 0.3, textAlign: 'center' },
  weekLabelWeekend: { color: colors.sun },
  calendarGrid: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.sheet },
  calendarWeek: { flexDirection: 'row' },
  calendarCell: { flex: 1, aspectRatio: 0.72, paddingTop: 8, paddingHorizontal: 5, alignItems: 'center', overflow: 'hidden', backgroundColor: colors.sheet },
  calendarCellColumnDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  calendarCellRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  calendarCellEmpty: { backgroundColor: colors.paper, opacity: 0.46 },
  calendarCellSelected: { backgroundColor: colors.lifeLight },
  calendarCellFuture: { opacity: 0.3 },
  calendarThumb: { position: 'absolute', width: '100%', height: '100%', opacity: 0.13 },
  calendarDayRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 2 },
  calendarDay: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 16 },
  calendarDayToday: { color: colors.life, fontWeight: '700' },
  calendarDaySelected: { color: colors.life },
  todayMark: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.life },
  todayMarkText: { color: colors.onLife, fontSize: 7, fontWeight: '700' },
  lunarDay: { maxWidth: '100%', color: colors.inkFaint, fontSize: 8, lineHeight: 13 },
  lunarFestival: { color: colors.sun, fontWeight: '700' },
  lunarDaySelected: { color: colors.life },
  postMark: { position: 'absolute', bottom: 5, width: 12, height: 3, borderRadius: 2, backgroundColor: colors.sun },
  checkInMark: { position: 'absolute', bottom: 6, width: 3, height: 3, borderRadius: 2, backgroundColor: colors.inkFaint },
  calendarLegend: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: colors.inkFaint, fontSize: 8 },
  legendCheckIn: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inkFaint },
  legendPost: { width: 12, height: 3, borderRadius: 2, backgroundColor: colors.sun },
  legendPhoto: { width: 12, height: 9, borderRadius: 2, backgroundColor: colors.lifeLight },
  selectedPanel: { marginTop: spacing.lg, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedDateBlock: { flex: 1, paddingRight: spacing.md },
  selectedDate: { color: colors.life, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.1 },
  selectedLunar: { marginTop: 6, color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  selectedHint: { marginTop: 5, color: colors.inkFaint, fontSize: 9 },
  writeButton: { minWidth: 76, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.life },
  writeButtonText: { color: colors.onLife, fontSize: 10, fontWeight: '700' },
  selectedPost: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  selectedPostText: { color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  selectedPostArrow: { marginTop: spacing.sm, color: colors.life, fontSize: 9 },
});
