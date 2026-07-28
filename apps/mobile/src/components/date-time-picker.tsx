import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';

export interface DateParts { year: number; month: number; day: number }

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

export function DatePickerField({ label, value, maximumDate = new Date(), dayCount, enforceMaximum = true, onChange, onClear }: { label: string; value: DateParts | null; maximumDate?: Date; dayCount?(value: DateParts): number; enforceMaximum?: boolean; onChange(value: DateParts): void; onClear?(): void }) {
  const [open, setOpen] = useState(false);
  const today = { year: maximumDate.getFullYear(), month: maximumDate.getMonth() + 1, day: maximumDate.getDate() };
  const [draft, setDraft] = useState(value ?? today);
  useEffect(() => { if (open) setDraft(value ?? today); }, [open]);

  const years = range(1900, maximumDate.getFullYear());
  const maxMonth = enforceMaximum && draft.year === today.year ? today.month : 12;
  const months = range(1, maxMonth);
  const naturalMaxDay = dayCount?.(draft) ?? new Date(draft.year, draft.month, 0).getDate();
  const maxDay = enforceMaximum && draft.year === today.year && draft.month === today.month ? Math.min(naturalMaxDay, today.day) : naturalMaxDay;
  const days = range(1, maxDay);

  const update = (part: keyof DateParts, selected: number) => {
    const next = { ...draft, [part]: selected };
    const nextMaxMonth = enforceMaximum && next.year === today.year ? today.month : 12;
    next.month = Math.min(next.month, nextMaxMonth);
    const nextNaturalMaxDay = dayCount?.(next) ?? new Date(next.year, next.month, 0).getDate();
    const nextMaxDay = enforceMaximum && next.year === today.year && next.month === today.month ? Math.min(nextNaturalMaxDay, today.day) : nextNaturalMaxDay;
    next.day = Math.min(next.day, nextMaxDay);
    setDraft(next);
  };

  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fieldValueRow}><Text style={[styles.value, !value && styles.placeholder]}>{value ? `${value.year} 年 ${value.month} 月 ${value.day} 日` : '请选择日期'}</Text><Text style={styles.fieldAction}>选择</Text></View>
    </Pressable>
    <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <Pressable onPress={() => setOpen(false)} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}><Pressable onPress={() => setOpen(false)} style={styles.headerAction}><Text style={styles.cancel}>取消</Text></Pressable><Text style={styles.title}>{label}</Text><Pressable onPress={() => { onChange(draft); setOpen(false); }} style={styles.headerAction}><Text style={styles.confirm}>完成</Text></Pressable></View>
          <View style={styles.picker}>
            <View pointerEvents="none" style={styles.selection} />
            <WheelColumn accessibilityLabel="年份" items={years} selected={draft.year} suffix="年" onSelect={(year) => update('year', year)} />
            <WheelColumn accessibilityLabel="月份" items={months} selected={draft.month} suffix="月" onSelect={(month) => update('month', month)} />
            <WheelColumn accessibilityLabel="日期" items={days} selected={draft.day} suffix="日" onSelect={(day) => update('day', day)} />
          </View>
          <View style={styles.shortcuts}>
            <Pressable onPress={() => setDraft(today)} style={styles.shortcut}><Text style={styles.shortcutText}>今天</Text></Pressable>
            {value && onClear ? <Pressable onPress={() => { onClear(); setOpen(false); }} style={styles.shortcut}><Text style={styles.clearText}>清除日期</Text></Pressable> : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

export function TimePickerField({ label, hour, minute, onChange }: { label: string; hour: number; minute: number; onChange(hour: number, minute: number): void }) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);
  useEffect(() => { if (open) { setDraftHour(hour); setDraftMinute(minute); } }, [hour, minute, open]);

  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.fieldValueRow}><Text style={styles.value}>{pad(hour)}:{pad(minute)}</Text><Text style={styles.fieldAction}>修改</Text></View></Pressable>
    <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <Pressable onPress={() => setOpen(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}><Pressable onPress={() => setOpen(false)} style={styles.headerAction}><Text style={styles.cancel}>取消</Text></Pressable><Text style={styles.title}>{label}</Text><Pressable onPress={() => { onChange(draftHour, draftMinute); setOpen(false); }} style={styles.headerAction}><Text style={styles.confirm}>完成</Text></Pressable></View>
        <View style={[styles.picker, styles.timePicker]}>
          <View pointerEvents="none" style={styles.selection} />
          <WheelColumn accessibilityLabel="小时" items={range(0, 23)} padValue selected={draftHour} suffix="时" onSelect={setDraftHour} />
          <WheelColumn accessibilityLabel="分钟" items={range(0, 59)} padValue selected={draftMinute} suffix="分" onSelect={setDraftMinute} />
        </View>
      </Pressable></Pressable>
    </Modal>
  </>;
}

function WheelColumn({ accessibilityLabel, items, selected, suffix, padValue = false, onSelect }: { accessibilityLabel: string; items: number[]; selected: number; suffix: string; padValue?: boolean; onSelect(value: number): void }) {
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
    renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={styles.wheelItem}><Text style={[styles.wheelText, item === selected && styles.wheelTextSelected]}>{padValue ? pad(item) : item}<Text style={styles.wheelSuffix}> {suffix}</Text></Text></Pressable>}
    showsVerticalScrollIndicator={false}
    snapToInterval={ITEM_HEIGHT}
  />;
}

function range(start: number, end: number): number[] { return Array.from({ length: end - start + 1 }, (_, index) => start + index); }
function pad(value: number): string { return String(value).padStart(2, '0'); }

const styles = createThemedStyles(() => ({
  field: { minHeight: 68, marginTop: spacing.lg, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, label: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 }, fieldValueRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, value: { color: colors.ink, fontSize: 15 }, placeholder: { color: colors.inkFaint }, fieldAction: { color: colors.life, fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.sm, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerAction: { width: 56, minHeight: 44, justifyContent: 'center' }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, cancel: { color: colors.inkSoft, fontSize: 11 }, confirm: { color: colors.life, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  picker: { height: ITEM_HEIGHT * VISIBLE_ITEMS, marginTop: spacing.md, flexDirection: 'row', overflow: 'hidden' }, timePicker: { paddingHorizontal: 44 }, selection: { position: 'absolute', top: ITEM_HEIGHT * 2, right: 0, left: 0, height: ITEM_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.sheet }, wheel: { flex: 1 }, wheelContent: { paddingVertical: ITEM_HEIGHT * 2 }, wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }, wheelText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 15 }, wheelTextSelected: { color: colors.ink, fontSize: 17, fontWeight: '700' }, wheelSuffix: { color: colors.inkFaint, fontSize: 9, fontWeight: '400' },
  shortcuts: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'center', gap: spacing.md }, shortcut: { minHeight: 42, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.sheet }, shortcutText: { color: colors.life, fontSize: 10, fontWeight: '700' }, clearText: { color: colors.danger, fontSize: 10 },
}));
