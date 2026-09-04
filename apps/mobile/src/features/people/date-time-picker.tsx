import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Birthday, BirthdayCalendar } from '@still-alive/types';
import { birthdayForCalendar, birthdaySolarDate, lunarLeapMonth, lunarMonthDayCount } from './person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';

export interface DateParts { year: number; month: number; day: number }

interface DatePickerFieldProps { calendar?: BirthdayCalendar; isLeapMonth?: boolean; label: string; value: DateParts | null; defaultValue?: DateParts; maximumDate?: Date; formatValue?(value: DateParts, calendar: BirthdayCalendar, isLeapMonth: boolean): string; onChange(value: DateParts, isLeapMonth: boolean): void; onClear?(): void }

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

export function DatePickerField(props: DatePickerFieldProps) {
  return <CalendarDatePickerField key={props.calendar ?? 'solar'} {...props} />;
}

function CalendarDatePickerField({ calendar = 'solar', isLeapMonth = false, label, value, defaultValue, maximumDate = new Date(), formatValue, onChange, onClear }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const maximum = birthdayForCalendar(toBirthday({ year: maximumDate.getFullYear(), month: maximumDate.getMonth() + 1, day: maximumDate.getDate() }, 'solar', false), calendar);
  const maximumParts = toDateParts(maximum);
  const [draft, setDraft] = useState(value ?? defaultValue ?? maximumParts);
  const [draftIsLeapMonth, setDraftIsLeapMonth] = useState(calendar === 'lunar' && isLeapMonth);
  useEffect(() => {
    if (!open) return;
    setDraft(value ?? defaultValue ?? maximumParts);
    setDraftIsLeapMonth(calendar === 'lunar' && (value ? isLeapMonth : maximum.isLeapMonth));
  }, [open]);

  const years = range(1900, maximum.year);
  const months = availableMonths(calendar, draft.year, maximum);
  const selectedMonth = draftIsLeapMonth ? -draft.month : draft.month;
  const naturalMaxDay = dayCount(calendar, draft, draftIsLeapMonth);
  const maxDay = isSameCalendarMonth(draft, draftIsLeapMonth, maximum) ? Math.min(naturalMaxDay, maximum.day) : naturalMaxDay;
  const days = range(1, maxDay);

  const updateYear = (year: number) => {
    const nextMonths = availableMonths(calendar, year, maximum);
    const fallbackMonth = Math.abs(selectedMonth);
    const nextSelectedMonth = nextMonths.includes(selectedMonth) ? selectedMonth : nextMonths.includes(fallbackMonth) ? fallbackMonth : nextMonths.at(-1) ?? 1;
    const next = { ...draft, year, month: Math.abs(nextSelectedMonth) };
    const nextIsLeapMonth = calendar === 'lunar' && nextSelectedMonth < 0;
    const nextMaxDay = isSameCalendarMonth(next, nextIsLeapMonth, maximum) ? maximum.day : dayCount(calendar, next, nextIsLeapMonth);
    next.day = Math.min(next.day, nextMaxDay);
    setDraft(next);
    setDraftIsLeapMonth(nextIsLeapMonth);
  };

  const updateMonth = (month: number) => {
    const next = { ...draft, month: Math.abs(month) };
    const nextIsLeapMonth = calendar === 'lunar' && month < 0;
    const nextMaxDay = isSameCalendarMonth(next, nextIsLeapMonth, maximum) ? maximum.day : dayCount(calendar, next, nextIsLeapMonth);
    next.day = Math.min(next.day, nextMaxDay);
    setDraft(next);
    setDraftIsLeapMonth(nextIsLeapMonth);
  };

  const solarCounterpart = calendar === 'lunar' ? birthdaySolarDate(toBirthday(draft, calendar, draftIsLeapMonth)) : null;

  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fieldValueRow}><Text style={[styles.value, !value && styles.placeholder]}>{value ? formatValue?.(value, calendar, isLeapMonth) ?? formatDate(value, calendar, isLeapMonth) : '请选择日期'}</Text><Text style={styles.fieldAction}>选择</Text></View>
    </Pressable>
    <DraggableBottomSheet onClose={() => setOpen(false)} open={open} sheetStyle={styles.sheet}>
          <View style={styles.header}><Pressable onPress={() => setOpen(false)} style={styles.headerAction}><Text style={styles.cancel}>取消</Text></Pressable><Text style={styles.title}>{label}</Text><Pressable onPress={() => { onChange(draft, calendar === 'lunar' && draftIsLeapMonth); setOpen(false); }} style={styles.headerAction}><Text style={styles.confirm}>完成</Text></Pressable></View>
          <View style={styles.picker}>
            <View pointerEvents="none" style={styles.selection} />
            <WheelColumn accessibilityLabel="年份" items={years} selected={draft.year} suffix="年" onSelect={updateYear} />
            <WheelColumn accessibilityLabel="月份" formatItem={calendar === 'lunar' ? formatLunarMonth : undefined} items={months} selected={selectedMonth} suffix={calendar === 'solar' ? '月' : undefined} onSelect={updateMonth} />
            <WheelColumn accessibilityLabel="日期" formatItem={calendar === 'lunar' ? formatLunarDay : undefined} items={days} selected={draft.day} suffix={calendar === 'solar' ? '日' : undefined} onSelect={(day) => setDraft((current) => ({ ...current, day }))} />
          </View>
          {solarCounterpart ? <View style={styles.counterpart}><Text style={styles.counterpartValue}>{solarCounterpart.getFullYear()} 年 {solarCounterpart.getMonth() + 1} 月 {solarCounterpart.getDate()} 日</Text></View> : null}
          <View style={styles.shortcuts}>
            <Pressable onPress={() => { setDraft(maximumParts); setDraftIsLeapMonth(maximum.isLeapMonth); }} style={styles.shortcut}><Text style={styles.shortcutText}>今天</Text></Pressable>
            {value && onClear ? <Pressable onPress={() => { onClear(); setOpen(false); }} style={styles.shortcut}><Text style={styles.clearText}>清除日期</Text></Pressable> : null}
          </View>
    </DraggableBottomSheet>
  </>;
}

export function TimePickerField({ label, hour, minute, onChange }: { label: string; hour: number; minute: number; onChange(hour: number, minute: number): void }) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);
  useEffect(() => { if (open) { setDraftHour(hour); setDraftMinute(minute); } }, [hour, minute, open]);

  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.fieldValueRow}><Text style={styles.value}>{pad(hour)}:{pad(minute)}</Text><Text style={styles.fieldAction}>修改</Text></View></Pressable>
    <DraggableBottomSheet onClose={() => setOpen(false)} open={open} sheetStyle={styles.sheet}>
        <View style={styles.header}><Pressable onPress={() => setOpen(false)} style={styles.headerAction}><Text style={styles.cancel}>取消</Text></Pressable><Text style={styles.title}>{label}</Text><Pressable onPress={() => { onChange(draftHour, draftMinute); setOpen(false); }} style={styles.headerAction}><Text style={styles.confirm}>完成</Text></Pressable></View>
        <View style={[styles.picker, styles.timePicker]}>
          <View pointerEvents="none" style={styles.selection} />
          <WheelColumn accessibilityLabel="小时" items={range(0, 23)} padValue selected={draftHour} suffix="时" onSelect={setDraftHour} />
          <WheelColumn accessibilityLabel="分钟" items={range(0, 59)} padValue selected={draftMinute} suffix="分" onSelect={setDraftMinute} />
        </View>
    </DraggableBottomSheet>
  </>;
}

function WheelColumn({ accessibilityLabel, formatItem, items, selected, suffix, padValue = false, onSelect }: { accessibilityLabel: string; formatItem?(value: number): string; items: number[]; selected: number; suffix?: string; padValue?: boolean; onSelect(value: number): void }) {
  const listRef = useRef<FlatList<number>>(null);
  const selectedIndex = Math.max(0, items.indexOf(selected));

  useEffect(() => {
    const frame = requestAnimationFrame(() => listRef.current?.scrollToOffset({ animated: false, offset: selectedIndex * ITEM_HEIGHT }));
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex, items.length]);

  return <FlatList
    ref={listRef}
    accessibilityLabel={accessibilityLabel}
    style={styles.wheel}
    contentContainerStyle={styles.wheelContent}
    data={items}
    decelerationRate="fast"
    getItemLayout={(_, index) => ({ index, length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index })}
    keyExtractor={(item) => String(item)}
    onMomentumScrollEnd={(event) => {
      const index = Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
      if (items[index] !== selected) onSelect(items[index]);
    }}
    renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={styles.wheelItem}><Text style={[styles.wheelText, item === selected && styles.wheelTextSelected]}>{formatItem ? formatItem(item) : padValue ? pad(item) : item}{suffix ? <Text style={styles.wheelSuffix}> {suffix}</Text> : null}</Text></Pressable>}
    showsVerticalScrollIndicator={false}
    snapToInterval={ITEM_HEIGHT}
  />;
}

function range(start: number, end: number): number[] { return Array.from({ length: end - start + 1 }, (_, index) => start + index); }
function pad(value: number): string { return String(value).padStart(2, '0'); }

function availableMonths(calendar: BirthdayCalendar, year: number, maximum: Birthday): number[] {
  const months = calendar === 'solar' ? range(1, 12) : lunarMonths(year);
  if (year !== maximum.year) return months;
  return months.slice(0, months.indexOf(maximum.isLeapMonth ? -maximum.month : maximum.month) + 1);
}

function lunarMonths(year: number): number[] {
  const leapMonth = lunarLeapMonth(year);
  return range(1, 12).flatMap((month) => month === leapMonth ? [month, -month] : [month]);
}

function dayCount(calendar: BirthdayCalendar, value: DateParts, isLeapMonth: boolean): number {
  return calendar === 'lunar' ? lunarMonthDayCount(value.year, value.month, isLeapMonth) : new Date(value.year, value.month, 0).getDate();
}

function isSameCalendarMonth(value: DateParts, isLeapMonth: boolean, maximum: Birthday): boolean {
  return value.year === maximum.year && value.month === maximum.month && isLeapMonth === maximum.isLeapMonth;
}

function toBirthday(value: DateParts, calendar: BirthdayCalendar, isLeapMonth: boolean): Birthday {
  return { calendar, ...value, isLeapMonth: calendar === 'lunar' && isLeapMonth, reminderEnabled: true, reminderHour: null, reminderMinute: null, reminderMode: calendar };
}

function toDateParts(value: Birthday): DateParts {
  return { year: value.year, month: value.month, day: value.day };
}

function formatDate(value: DateParts, calendar: BirthdayCalendar, isLeapMonth: boolean): string {
  if (calendar === 'solar') return `${value.year} 年 ${value.month} 月 ${value.day} 日`;
  return `${value.year} 年 ${formatLunarMonth(isLeapMonth ? -value.month : value.month)} ${formatLunarDay(value.day)}`;
}

function formatLunarMonth(value: number): string {
  const names = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  return `${value < 0 ? '闰' : ''}${names[Math.abs(value) - 1]}`;
}

function formatLunarDay(value: number): string {
  const names = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  return names[value - 1];
}

const styles = createThemedStyles(() => ({
  field: { minHeight: 68, marginTop: spacing.lg, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, label: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 }, fieldValueRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, value: { color: colors.ink, fontSize: 15 }, placeholder: { color: colors.inkFaint }, fieldAction: { color: colors.life, fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.sm, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerAction: { width: 56, minHeight: 44, justifyContent: 'center' }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, cancel: { color: colors.inkSoft, fontSize: 11 }, confirm: { color: colors.life, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  picker: { height: ITEM_HEIGHT * VISIBLE_ITEMS, marginTop: spacing.md, flexDirection: 'row', overflow: 'hidden' }, timePicker: { paddingHorizontal: 44 }, selection: { position: 'absolute', top: ITEM_HEIGHT * 2, right: 0, left: 0, height: ITEM_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.sheet }, wheel: { flex: 1 }, wheelContent: { paddingVertical: ITEM_HEIGHT * 2 }, wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }, wheelText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 15 }, wheelTextSelected: { color: colors.ink, fontSize: 17, fontWeight: '700' }, wheelSuffix: { color: colors.inkFaint, fontSize: 9, fontWeight: '400' },
  counterpart: { minHeight: 30, marginTop: spacing.xs, alignItems: 'center', justifyContent: 'center' }, counterpartValue: { color: colors.inkSoft, fontFamily: typography.mono, fontSize: 10 },
  shortcuts: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'center', gap: spacing.md }, shortcut: { minHeight: 42, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.sheet }, shortcutText: { color: colors.life, fontSize: 10, fontWeight: '700' }, clearText: { color: colors.danger, fontSize: 10 },
}));
