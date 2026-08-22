import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { MBTI_TYPES } from './person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';

const ITEM_HEIGHT = 48;
const DIMENSIONS = [['I', 'E'], ['N', 'S'], ['T', 'F'], ['J', 'P']] as const;

export function MbtiPickerField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<[string, string, string, string]>(() => toDimensions(value));
  useEffect(() => { if (open) setDraft(toDimensions(value)); }, [open, value]);
  const result = draft.join('');

  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
      <Text style={styles.label}>MBTI / 可选</Text>
      <View style={styles.fieldValueRow}><Text style={[styles.value, !value && styles.placeholder]}>{value || '请选择'}</Text><Text style={styles.fieldAction}>选择</Text></View>
    </Pressable>
    <DraggableBottomSheet onClose={() => setOpen(false)} open={open} sheetStyle={styles.sheet}>
          <View style={styles.header}><Pressable onPress={() => setOpen(false)} style={styles.headerAction}><Text style={styles.cancel}>取消</Text></Pressable><Text style={styles.title}>选择 MBTI</Text><Pressable onPress={() => { onChange(result); setOpen(false); }} style={styles.headerAction}><Text style={styles.confirm}>完成</Text></Pressable></View>
          <View style={styles.result}><Text style={styles.resultText}>{result}</Text></View>
          <View style={styles.picker}>
            <View pointerEvents="none" style={styles.selection} />
            {DIMENSIONS.map((items, index) => <LetterWheel key={index} accessibilityLabel={`MBTI 第 ${index + 1} 位`} items={[...items]} selected={draft[index]} onSelect={(letter) => setDraft((current) => { const next = [...current] as [string, string, string, string]; next[index] = letter; return next; })} />)}
          </View>
          {value ? <Pressable onPress={() => { onChange(''); setOpen(false); }} style={styles.clearButton}><Text style={styles.clearText}>清除 MBTI</Text></Pressable> : null}
    </DraggableBottomSheet>
  </>;
}

function LetterWheel({ accessibilityLabel, items, selected, onSelect }: { accessibilityLabel: string; items: string[]; selected: string; onSelect(value: string): void }) {
  const listRef = useRef<FlatList<string>>(null);
  const selectedIndex = Math.max(0, items.indexOf(selected));
  useEffect(() => {
    const frame = requestAnimationFrame(() => listRef.current?.scrollToOffset({ animated: false, offset: selectedIndex * ITEM_HEIGHT }));
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex]);
  const selectAtOffset = (offset: number) => {
    const index = Math.max(0, Math.min(items.length - 1, Math.round(offset / ITEM_HEIGHT)));
    if (items[index] !== selected) onSelect(items[index]);
  };

  return <FlatList
    ref={listRef}
    accessibilityLabel={accessibilityLabel}
    contentContainerStyle={styles.wheelContent}
    data={items}
    decelerationRate="fast"
    getItemLayout={(_, index) => ({ index, length: ITEM_HEIGHT, offset: index * ITEM_HEIGHT })}
    keyExtractor={(item) => item}
    onMomentumScrollEnd={(event) => selectAtOffset(event.nativeEvent.contentOffset.y)}
    renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={styles.wheelItem}><Text style={[styles.letter, item === selected && styles.letterSelected]}>{item}</Text></Pressable>}
    showsVerticalScrollIndicator={false}
    snapToInterval={ITEM_HEIGHT}
    style={styles.wheel}
  />;
}

function toDimensions(value: string): [string, string, string, string] {
  const normalized = value.toUpperCase();
  if (MBTI_TYPES.includes(normalized as typeof MBTI_TYPES[number])) return normalized.split('') as [string, string, string, string];
  return ['I', 'N', 'F', 'P'];
}

const styles = createThemedStyles(() => ({
  field: { minHeight: 68, marginTop: spacing.lg, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, label: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 }, fieldValueRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, value: { color: colors.ink, fontFamily: typography.mono, fontSize: 16, fontWeight: '700', letterSpacing: 2 }, placeholder: { color: colors.inkFaint, fontFamily: typography.body, fontSize: 15, fontWeight: '400', letterSpacing: 0 }, fieldAction: { color: colors.life, fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.sm, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerAction: { width: 56, minHeight: 44, justifyContent: 'center' }, cancel: { color: colors.inkSoft, fontSize: 11 }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, confirm: { color: colors.life, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  result: { minWidth: 108, marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignSelf: 'center', borderRadius: 18, backgroundColor: colors.life }, resultText: { color: colors.onLife, fontFamily: typography.mono, fontSize: 18, fontWeight: '700', letterSpacing: 4, textAlign: 'center' }, picker: { height: ITEM_HEIGHT * 3, marginTop: spacing.md, flexDirection: 'row', overflow: 'hidden' }, selection: { position: 'absolute', top: ITEM_HEIGHT, right: 0, left: 0, height: ITEM_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.sheet }, wheel: { flex: 1 }, wheelContent: { paddingVertical: ITEM_HEIGHT }, wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }, letter: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 18 }, letterSelected: { color: colors.ink, fontSize: 24, fontWeight: '700' }, clearButton: { minHeight: 42, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' }, clearText: { color: colors.danger, fontSize: 10 },
}));
