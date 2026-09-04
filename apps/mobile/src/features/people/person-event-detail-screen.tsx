import { useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { PersonEvent } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { personDisplayName } from './person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';

export default function PersonEventDetailScreen() {
  const router = useRouter();
  const window = useWindowDimensions();
  const { id, eventId } = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const { deletePersonEvent, people, personEvents, ready, savePersonEvent } = useAppState();
  const person = useMemo(() => people.find((item) => item.id === id), [id, people]);
  const event = useMemo(() => personEvents.find((item) => item.id === eventId), [eventId, personEvents]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ right: number; top: number }>({ right: spacing.md, top: 60 });
  const moreButtonRef = useRef<View>(null);

  if (!ready) return <SafeAreaView style={styles.safeArea} />;
  if (!person || !event) return <SafeAreaView style={styles.safeArea}><ToolPageHeader onBack={() => router.back()} title="经历详情" /><Text style={styles.missing}>这段经历不存在或已被删除。</Text></SafeAreaView>;

  const openMore = () => moreButtonRef.current?.measureInWindow((x, y, width, height) => { setMoreMenuPosition({ right: Math.max(spacing.md, window.width - x - width), top: y + height + 4 }); setMoreOpen(true); });
  const edit = () => { setMoreOpen(false); router.push({ pathname: '/person/event', params: { id: person.id, eventId: event.id } }); };
  const togglePin = () => { setMoreOpen(false); void savePersonEvent({ ...event, pinned: !event.pinned, updatedAt: new Date().toISOString() }); };
  const confirmDelete = () => { setMoreOpen(false); feedback.alert('删除这段经历？', '删除后无法恢复。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deletePersonEvent(event.id).then(() => router.back(), (cause: unknown) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。')) }]); };

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} right={<View collapsable={false} ref={moreButtonRef}><ToolPageHeaderAction accessibilityLabel="经历更多操作" onPress={openMore}><SymbolView name={{ android: 'more_vert', ios: 'ellipsis', web: 'more_vert' }} size={21} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction></View>} title="经历详情" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>经历{event.pinned ? ' · 已置顶' : ''}</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>{event.timeText || '时间待补充'} · {personDisplayName(person)}</Text>
      </View>
      <View style={styles.divider} />
      {event.description ? <Text style={styles.body}>{event.description}</Text> : <Text style={styles.emptyText}>还没有补充细节，可以从右上角“更多操作”进入编辑。</Text>}
      <View style={styles.participantBlock}><Text style={styles.sectionLabel}>参与人物</Text><Text style={styles.participantText}>{event.participantIds.map((participantId) => people.find((item) => item.id === participantId)).filter((item): item is NonNullable<typeof item> => Boolean(item)).map(personDisplayName).join('、') || '未记录'}</Text></View>
    </ScrollView>
    {moreOpen ? <><Pressable accessibilityLabel="关闭经历菜单" onPress={() => setMoreOpen(false)} style={styles.menuBackdrop} /><View accessibilityLabel="经历更多操作" accessibilityRole="menu" style={[styles.moreMenu, moreMenuPosition]}><MoreMenuItem icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑经历" onPress={edit} /><MoreMenuItem icon={{ android: event.pinned ? 'push_pin' : 'push_pin', ios: event.pinned ? 'pin.slash' : 'pin', web: 'push_pin' }} label={event.pinned ? '取消置顶' : '置顶经历'} onPress={togglePin} /><MoreMenuItem destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除经历" onPress={confirmDelete} /></View></> : null}
  </SafeAreaView>;
}

function MoreMenuItem({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}><SymbolView name={icon} size={18} tintColor={destructive ? colors.danger : colors.ink} type="hierarchical" /><Text style={[styles.menuItemText, destructive && styles.menuItemDanger]}>{label}</Text></Pressable>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerBlock: { paddingVertical: spacing.lg }, eyebrow: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 }, title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 25, lineHeight: 33 }, meta: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, body: { marginTop: spacing.lg, color: colors.ink, fontSize: 15, lineHeight: 27 }, emptyText: { marginTop: spacing.lg, color: colors.inkFaint, fontSize: 12, lineHeight: 20 }, participantBlock: { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, sectionLabel: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 }, participantText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, lineHeight: 20 },
  menuBackdrop: { position: 'absolute', inset: 0 }, moreMenu: { position: 'absolute', minWidth: 170, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.sheet, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 }, menuItem: { minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, menuItemText: { color: colors.ink, fontSize: 11, fontWeight: '700' }, menuItemDanger: { color: colors.danger }, pressed: { opacity: 0.62 }, missing: { marginTop: spacing.xxl, padding: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
}));
