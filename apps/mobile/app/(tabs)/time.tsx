import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Birthday, BirthdayCalendar, CheckIn, DayKey, Person, Post } from '@still-alive/types';
import { toDayKey } from '@still-alive/core';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { SolarDay } from 'tyme4ts';
import { useAppState } from '../../src/state/app-state';
import MarkdownView from '../../src/components/markdown-view.dom';
import { extractAudioEmbeds, withoutEmbeddedAttachments } from '../../src/domain/embedded-media';
import { birthdayFromDateString, birthdayInSolarYear, birthdaySolarDate, toLocalDayKey } from '../../src/domain/person-profile';
import { TabPageHeader } from '../../src/components/tab-page-header';
import { createThemedStyles, editorTheme } from '../../src/theme/app-theme';

type CalendarMarkerKind = 'check-in' | 'text' | 'image' | 'audio';

const CALENDAR_POST_PREVIEW_MAX_HEIGHT = 106;

export default function CalendarScreen() {
  const router = useRouter();
  const { checkIns, people, posts, preferences, today, todayCheckIn } = useAppState();
  const [activeMonth, setActiveMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<DayKey>(today);
  const checkInDays = useMemo(() => new Set(checkIns.map((item) => item.dayKey)), [checkIns]);
  const selfBirthday = useMemo(
    () => birthdayFromDateString(preferences.birthDate, preferences.birthDateCalendar, preferences.birthDateIsLeapMonth),
    [preferences.birthDate, preferences.birthDateCalendar, preferences.birthDateIsLeapMonth],
  );
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
    setActiveMonth(next);
    setSelectedDay(`${next}-01` as DayKey);
  };

  const selectDay = (dayKey: DayKey) => {
    setActiveMonth(dayKey.slice(0, 7));
    setSelectedDay(dayKey);
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
          onSelectDay={selectDay}
          onWrite={openEditorForDay}
          people={people}
          posts={posts}
          selectedCheckIn={selectedCheckIn}
          selectedDay={selectedDay}
          selectedPosts={selectedPosts}
          selfBirthday={selfBirthday}
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
  people: Person[];
  posts: Post[];
  selectedCheckIn?: CheckIn;
  selectedDay: DayKey;
  selectedPosts: Post[];
  selfBirthday: Birthday | null;
  today: DayKey;
}

function CalendarView({ activeMonth, checkInDays, onChangeMonth, onOpenPost, onSelectDay, onWrite, people, posts, selectedCheckIn, selectedDay, selectedPosts, selfBirthday, today }: CalendarViewProps) {
  const weeks = useMemo(() => {
    const cells = calendarCells(activeMonth);
    return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  }, [activeMonth]);
  const postsByDay = useMemo(() => {
    const values = new Map<DayKey, Post[]>();
    for (const post of posts) values.set(post.dayKey, [...(values.get(post.dayKey) ?? []), post]);
    return values;
  }, [posts]);
  const birthdaysByDay = useMemo(() => {
    const values = new Map<DayKey, CalendarBirthday[]>();
    const years = new Set(weeks.flat().map((dayKey) => Number(dayKey.slice(0, 4))));
    const owners: CalendarBirthdayOwner[] = [
      ...(selfBirthday ? [{ birthday: selfBirthday, id: 'self', name: '我' }] : []),
      ...people,
    ];
    for (const year of years) {
      for (const [dayKey, birthdays] of calendarBirthdaysByDay(owners, year)) values.set(dayKey, birthdays);
    }
    return values;
  }, [people, selfBirthday, weeks]);
  const selectedLunarDate = lunarDateInfo(selectedDay);
  const selectedAlmanac = almanacInfo(selectedDay);
  const selectedBirthdays = birthdaysByDay.get(selectedDay) ?? [];
  const selectedItemCount = selectedPosts.length + Number(Boolean(selectedCheckIn));
  const [year, month] = activeMonth.split('-');

  return (
    <View style={styles.calendarSection}>
      <View style={styles.calendarHeader}>
        <Pressable accessibilityLabel="回到当前月份" accessibilityRole="button" hitSlop={8} onPress={() => onSelectDay(today)} style={({ pressed }) => [styles.monthJump, pressed && styles.monthJumpPressed]}>
          <Text style={styles.calendarYear}>{year} MONTH {month}</Text>
          <Text style={styles.calendarTitle}>{Number(month)} 月</Text>
        </Pressable>
        <View style={styles.monthArrows}>
          <Pressable accessibilityLabel="上一个月" accessibilityRole="button" onPress={() => onChangeMonth(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable>
          <Pressable accessibilityLabel="下一个月" accessibilityRole="button" onPress={() => onChangeMonth(1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable>
        </View>
      </View>
      <View style={styles.weekRow}>{['一', '二', '三', '四', '五', '六', '日'].map((day, index) => <Text key={day} style={[styles.weekLabel, index > 4 && styles.weekLabelWeekend]}>周{day}</Text>)}</View>
      <View style={styles.calendarGrid}>
        {weeks.map((week, rowIndex) => (
          <View key={`week_${rowIndex}`} style={styles.calendarWeek}>
            {week.map((dayKey, columnIndex) => {
              const dividers = [columnIndex < 6 && styles.calendarCellColumnDivider, rowIndex < weeks.length - 1 && styles.calendarCellRowDivider];
              const dayPosts = postsByDay.get(dayKey) ?? [];
              const dayBirthdays = birthdaysByDay.get(dayKey) ?? [];
              const itemCount = dayPosts.length + Number(checkInDays.has(dayKey));
              const markers: CalendarMarkerKind[] = [
                ...(checkInDays.has(dayKey) ? ['check-in' as const] : []),
                ...dayPosts.map((post) => postMarkerKind(post.bodyMarkdown)),
              ].slice(0, 3);
              const outsideMonth = !dayKey.startsWith(activeMonth);
              const selected = dayKey === selectedDay;
              const isToday = dayKey === today;
              const lunarDate = lunarDateInfo(dayKey);
              return (
                <Pressable
                  key={dayKey}
                  accessibilityLabel={`${dayKey}${lunarDate ? `，农历${lunarDate.fullLabel}` : ''}${dayBirthdays.length ? `，有 ${dayBirthdays.length} 个生日` : ''}${itemCount ? `，有 ${itemCount} 条内容` : ''}`}
                  accessibilityRole="button"
                  onPress={() => onSelectDay(dayKey)}
                  style={[styles.calendarCell, ...dividers, outsideMonth && styles.calendarCellOutsideMonth, selected && styles.calendarCellSelected]}
                >
                  <View style={styles.calendarDayRow}>
                    <Text style={[styles.calendarDay, outsideMonth && styles.calendarDayOutsideMonth, isToday && styles.calendarDayToday, selected && styles.calendarDaySelected]}>{Number(dayKey.slice(8))}</Text>
                    {isToday ? <View style={styles.todayMark}><Text style={styles.todayMarkText}>今</Text></View> : null}
                  </View>
                  {lunarDate ? <Text numberOfLines={1} style={[styles.lunarDay, outsideMonth && styles.lunarDayOutsideMonth, lunarDate.emphasis && styles.lunarFestival, selected && styles.lunarDaySelected]}>{lunarDate.shortLabel}</Text> : null}
                  {dayBirthdays.length ? <View style={styles.birthdayMark}><SymbolView name={{ android: 'cake', ios: 'birthday.cake.fill', web: 'cake' }} pointerEvents="none" size={11} tintColor={colors.sun} type="hierarchical" /></View> : null}
                  {markers.length ? (
                    <View style={[styles.calendarMarks, dayBirthdays.length > 0 && styles.calendarMarksWithBirthday]}>
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
        <View style={styles.legendItem}><SymbolView name={{ android: 'cake', ios: 'birthday.cake.fill', web: 'cake' }} pointerEvents="none" size={11} tintColor={colors.sun} type="hierarchical" /><Text style={styles.legendText}>生日</Text></View>
        <Text style={styles.legendText}>内容最多 3 个</Text>
      </View>

      {selectedAlmanac ? (
        <View accessibilityLabel={`黄历宜忌，${selectedAlmanac.luck}，宜：${selectedAlmanac.recommends.join('、')}，忌：${selectedAlmanac.avoids.join('、')}`} style={styles.almanacCard}>
          <View style={styles.almanacHeader}>
            <View>
              <Text style={styles.almanacEyebrow}>DAILY ALMANAC</Text>
              <Text style={styles.almanacTitle}>黄历宜忌</Text>
            </View>
            <View style={[styles.almanacSeal, selectedAlmanac.luck === '吉' ? styles.almanacLuckySeal : styles.almanacUnluckySeal]}>
              <View style={[styles.almanacSealInner, selectedAlmanac.luck === '吉' ? styles.almanacLuckySeal : styles.almanacUnluckySeal]}><Text style={[styles.almanacSealText, selectedAlmanac.luck === '吉' ? styles.almanacLuckySealText : styles.almanacUnluckySealText]}>{selectedAlmanac.luck}</Text></View>
            </View>
          </View>
          <View style={styles.almanacRow}>
            <View style={[styles.almanacBadge, styles.almanacRecommendBadge]}><Text style={[styles.almanacBadgeText, styles.almanacRecommendBadgeText]}>宜</Text></View>
            <Text style={styles.almanacText}>{selectedAlmanac.recommends.join('、') || '诸事不宜'}</Text>
          </View>
          <View style={[styles.almanacRow, styles.almanacAvoidRow]}>
            <View style={[styles.almanacBadge, styles.almanacAvoidBadge]}><Text style={[styles.almanacBadgeText, styles.almanacAvoidBadgeText]}>忌</Text></View>
            <Text style={styles.almanacText}>{selectedAlmanac.avoids.join('、') || '诸事不忌'}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.selectedPanel}>
        <View style={styles.selectedHeader}>
          <View style={styles.selectedDateBlock}>
            <Text style={styles.selectedDate}>{selectedDay.replaceAll('-', '.')} {chineseWeekdayLabel(selectedDay)}</Text>
            {selectedLunarDate ? <Text style={styles.selectedLunar}>农历 {selectedLunarDate.fullLabel}{selectedLunarDate.term ? ` ${selectedLunarDate.term}` : ''}</Text> : null}
            <Text style={styles.selectedHint}>{selectedItemCount ? `这一天留下了 ${selectedItemCount} 个片段` : '这一天还没有内容'}</Text>
          </View>
          {selectedDay <= today ? <Pressable accessibilityRole="button" onPress={() => onWrite(selectedDay)} style={styles.writeButton}><Text style={styles.writeButtonText}>{selectedDay === today ? '写一条' : '补写一条'}</Text></Pressable> : null}
        </View>
        {selectedBirthdays.length || selectedItemCount ? (
          <View style={styles.selectedList}>
            {selectedBirthdays.map((birthday) => (
              <View key={`${birthday.personId}_${birthday.calendar}`} style={styles.selectedEntry}>
                <View style={styles.selectedEntryRail}><SymbolView name={{ android: 'cake', ios: 'birthday.cake.fill', web: 'cake' }} pointerEvents="none" size={14} tintColor={colors.sun} type="hierarchical" /></View>
                <View style={styles.selectedEntryContent}>
                  <Text style={styles.selectedEntryMeta}>{birthday.personId === 'self' ? '我的生日' : '人物生日'}</Text>
                  <Text style={styles.selectedBirthdayTitle}>{selectedDay === today ? '今天' : '这一天'}是{birthday.personName}的{birthdayCalendarLabel(birthday.calendar)}生日</Text>
                </View>
              </View>
            ))}
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
              const displayMarkdown = withoutEmbeddedAttachments(post.bodyMarkdown);
              const markerKind = postMarkerKind(post.bodyMarkdown);
              return (
                <Pressable key={post.id} accessibilityLabel={`打开 ${formatTime(post.createdAt)} 的记录`} accessibilityRole="button" onPress={() => onOpenPost(post.id)} style={({ pressed }) => [styles.selectedEntry, pressed && styles.selectedEntryPressed]}>
                  <View style={styles.selectedEntryRail}><View style={[styles.selectedEntryDot, { backgroundColor: markerColor(markerKind) }]} /></View>
                  <View style={styles.selectedEntryContent}>
                    <Text style={styles.selectedEntryMeta}>{markerLabel(markerKind)} · {post.locationName ? `${post.locationName} · ` : ''}{formatTime(post.createdAt)}{attachmentLabel ? ` · ${attachmentLabel}` : ''}</Text>
                    {displayMarkdown
                      ? <View pointerEvents="none" style={styles.selectedPostMarkdownFrame}><MarkdownView dom={{ containerStyle: styles.selectedPostMarkdown, matchContents: true, scrollEnabled: false, style: styles.selectedPostMarkdown }} markdown={displayMarkdown} maxHeight={CALENDAR_POST_PREVIEW_MAX_HEIGHT} media={[]} theme={editorTheme()} /></View>
                      : <Text style={styles.selectedPostFallback}>{attachmentLabel || '记录了一些内容'}</Text>}
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

interface CalendarBirthday {
  calendar: BirthdayCalendar;
  personId: string;
  personName: string;
}

interface CalendarBirthdayOwner {
  birthday: Birthday | null;
  id: string;
  name: string;
}

function calendarBirthdaysByDay(people: CalendarBirthdayOwner[], solarYear: number): Map<DayKey, CalendarBirthday[]> {
  const values = new Map<DayKey, CalendarBirthday[]>();
  for (const person of people) {
    if (!person.birthday || birthdaySolarDate(person.birthday).getFullYear() > solarYear) continue;
    const dayKey = toLocalDayKey(birthdayInSolarYear(person.birthday, solarYear));
    values.set(dayKey, [...(values.get(dayKey) ?? []), { calendar: person.birthday.calendar, personId: person.id, personName: person.name }]);
  }
  for (const birthdays of values.values()) birthdays.sort((left, right) => left.personName.localeCompare(right.personName) || left.calendar.localeCompare(right.calendar));
  return values;
}

function birthdayCalendarLabel(calendar: BirthdayCalendar): string {
  return calendar === 'solar' ? '公历' : '农历';
}

function calendarCells(month: string): DayKey[] {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(year, value - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const dayCount = new Date(year, value, 0).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => toDayKey(new Date(year, value - 1, index - offset + 1)));
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

interface AlmanacInfo {
  luck: string;
  recommends: string[];
  avoids: string[];
}

function almanacInfo(dayKey: DayKey): AlmanacInfo | null {
  try {
    const [year, month, day] = dayKey.split('-').map(Number);
    const lunar = SolarDay.fromYmd(year, month, day).getLunarDay();
    return {
      luck: lunar.getTwelveStar().getEcliptic().getLuck().getName(),
      recommends: lunar.getRecommends().map((item) => item.getName()),
      avoids: lunar.getAvoids().map((item) => item.getName()),
    };
  } catch {
    return null;
  }
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
  monthJump: { borderRadius: radius.sm },
  monthJumpPressed: { opacity: 0.55 },
  calendarYear: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  calendarTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 37 },
  monthArrows: { flexDirection: 'row', gap: spacing.sm },
  monthArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 19, backgroundColor: colors.sheet },
  monthArrowText: { color: colors.life, fontFamily: typography.display, fontSize: 25, lineHeight: 29 },
  weekRow: { flexDirection: 'row', marginTop: spacing.md, paddingBottom: spacing.sm },
  weekLabel: { flex: 1, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 0.3, textAlign: 'center' },
  weekLabelWeekend: { color: colors.sun },
  calendarGrid: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.sheet },
  calendarWeek: { flexDirection: 'row' },
  calendarCell: { flex: 1, aspectRatio: 0.72, paddingTop: 8, paddingHorizontal: 5, alignItems: 'center', overflow: 'hidden', backgroundColor: colors.sheet },
  calendarCellColumnDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  calendarCellRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  calendarCellOutsideMonth: { backgroundColor: colors.paper },
  calendarCellSelected: { backgroundColor: colors.lifeLight },
  calendarDayRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 2 },
  calendarDay: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 16 },
  calendarDayOutsideMonth: { color: colors.inkFaint },
  calendarDayToday: { color: colors.life, fontWeight: '700' },
  calendarDaySelected: { color: colors.life },
  todayMark: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.life },
  todayMarkText: { color: colors.onLife, fontSize: typography.size.meta, fontWeight: '700' },
  lunarDay: { maxWidth: '100%', color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 13 },
  lunarDayOutsideMonth: { opacity: 0.58 },
  lunarFestival: { color: colors.sun, fontWeight: '700' },
  lunarDaySelected: { color: colors.life },
  calendarMarks: { position: 'absolute', bottom: 7, flexDirection: 'row', gap: 3 },
  calendarMarksWithBirthday: { left: 6 },
  calendarMark: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.life },
  birthdayMark: { position: 'absolute', right: 5, bottom: 4 },
  calendarLegend: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: colors.inkFaint, fontSize: typography.size.meta },
  legendMark: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.life },
  almanacCard: { marginTop: spacing.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.sheet },
  almanacHeader: { minHeight: 76, paddingHorizontal: spacing.lg, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  almanacEyebrow: { color: colors.sun, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.1 },
  almanacTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 18, lineHeight: 24 },
  almanacSeal: { width: 44, height: 44, padding: 3, borderWidth: 2, transform: [{ rotate: '-4deg' }] },
  almanacLuckySeal: { borderColor: colors.life },
  almanacUnluckySeal: { borderColor: colors.danger },
  almanacSealInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  almanacSealText: { fontFamily: typography.display, fontSize: 22, lineHeight: 26, fontWeight: '700' },
  almanacLuckySealText: { color: colors.life },
  almanacUnluckySealText: { color: colors.danger },
  almanacRow: { minHeight: 62, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  almanacAvoidRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  almanacBadge: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  almanacRecommendBadge: { backgroundColor: colors.lifeLight },
  almanacAvoidBadge: { backgroundColor: colors.dangerLight },
  almanacBadgeText: { fontFamily: typography.display, fontSize: 15, fontWeight: '700' },
  almanacRecommendBadgeText: { color: colors.life },
  almanacAvoidBadgeText: { color: colors.danger },
  almanacText: { flex: 1, paddingTop: 4, color: colors.inkSoft, fontFamily: typography.display, fontSize: 14, lineHeight: 22 },
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
  selectedBirthdayTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 24 },
  selectedPostMarkdownFrame: { width: '100%' },
  selectedPostMarkdown: { width: '100%', alignSelf: 'stretch', backgroundColor: 'transparent' },
  selectedPostFallback: { color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  selectedEntryArrow: { marginLeft: spacing.sm, color: colors.life, fontFamily: typography.display, fontSize: 24, lineHeight: 28 },
}));
