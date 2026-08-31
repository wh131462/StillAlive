import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Person, PersonRelationship, PersonRelationshipKind, PersonRelationshipNode } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { feedback } from '../../shared/feedback';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { createThemedStyles, nameTextStyle } from '../../shared/theme/app-theme';
import { personDisplayName } from './person-profile';

const SELF_KEY = 'self';
const NODE_WIDTH = 100;
const NODE_HEIGHT = 116;
const NODE_GAP = 46;
const PARTNER_NODE_GAP = 48;
const BRANCH_NODE_GAP = 68;
const GRAPH_ROW_HEIGHT = 194;
const GRAPH_HEADING_HEIGHT = 30;
const GRAPH_SIDE_PADDING = 24;
const MIN_SCALE = 0.24;
const MIN_PANORAMA_SCALE = 0.06;
const MAX_SCALE = 1.24;
const SCALE_STEP = 0.08;
const RELATION_OPTIONS: Array<{ kind: PersonRelationshipKind; label: string; icon: ComponentProps<typeof SymbolView>['name'] }> = [
  { kind: 'parent', label: '父母', icon: { android: 'family_restroom', ios: 'person.2.fill', web: 'family_restroom' } },
  { kind: 'child', label: '子女', icon: { android: 'child_care', ios: 'figure.and.child.holdinghands', web: 'child_care' } },
  { kind: 'partner', label: '伴侣', icon: { android: 'favorite', ios: 'heart.fill', web: 'favorite' } },
  { kind: 'sibling', label: '手足', icon: { android: 'group', ios: 'person.2.fill', web: 'group' } },
  { kind: 'other', label: '朋友', icon: { android: 'group', ios: 'person.3.fill', web: 'group' } },
];

interface TreeMember {
  key: string;
  level: number;
  node: PersonRelationshipNode;
  person: Person | null;
  relationship: PersonRelationship | null;
  directRelationships: PersonRelationship[];
  relationLabel: string;
}

interface PositionedMember {
  member: TreeMember;
  x: number;
  y: number;
  branchKey: string;
}

interface TreeGraphLayout {
  width: number;
  height: number;
  nodes: PositionedMember[];
  positions: Map<string, PositionedMember>;
}

export default function RelationshipTreeScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { bindPersonRelationshipNode, createPerson, createPersonRelationshipNode, deletePersonRelationship, deletePersonRelationshipNode, getPostsByPerson, media, people, personRelationshipNodes, personRelationships, preferences, savePersonRelationship } = useAppState();
  const [selectedMember, setSelectedMember] = useState<TreeMember | null>(null);
  const [selectedPostCount, setSelectedPostCount] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceNodeId, setSourceNodeId] = useState(SELF_KEY);
  const [targetMode, setTargetMode] = useState<'placeholder' | 'person' | 'node'>('placeholder');
  const [targetPersonId, setTargetPersonId] = useState('');
  const [existingTargetNodeId, setExistingTargetNodeId] = useState('');
  const [bindingNodeId, setBindingNodeId] = useState<string | null>(null);
  const [kind, setKind] = useState<PersonRelationshipKind>('parent');
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(1);
  const [canvasViewport, setCanvasViewport] = useState({ width: 0, height: 0 });
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedTranslateX = useRef(new Animated.Value(0)).current;
  const animatedTranslateY = useRef(new Animated.Value(0)).current;
  const canvasTransform = useRef({ scale: 1, x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef({ scale: 1, anchorX: 0, anchorY: 0 });
  const members = useMemo(() => buildTreeMembers(people, personRelationshipNodes, personRelationships), [people, personRelationshipNodes, personRelationships]);
  const generations = useMemo(() => groupMembersByLevel(members, personRelationships), [members, personRelationships]);
  const graphLayout = useMemo(() => buildTreeGraphLayout(generations, personRelationships, Math.max(320, windowWidth)), [generations, personRelationships, windowWidth]);
  const fitScale = useMemo(() => {
    if (!canvasViewport.width || !canvasViewport.height) return 1;
    const availableWidth = Math.max(280, canvasViewport.width - spacing.lg * 2);
    const availableHeight = Math.max(220, canvasViewport.height - 132);
    return Math.min(1, Math.max(MIN_PANORAMA_SCALE, Math.min(availableWidth / graphLayout.width, availableHeight / graphLayout.height)));
  }, [canvasViewport, graphLayout.height, graphLayout.width]);
  const minimumScale = Math.min(MIN_SCALE, fitScale);
  const linkedNodeCount = Math.max(0, members.length - 1);
  const profileAvatar = preferences.profileAvatarMediaId ? media.find((item) => item.id === preferences.profileAvatarMediaId) : null;
  const editingRelationship = editingId ? personRelationships.find((relationship) => relationship.id === editingId) : null;
  const editorTargetNodeId = editingRelationship?.targetNodeId ?? (targetMode === 'node' ? existingTargetNodeId : personRelationshipNodes.find((node) => node.personId === targetPersonId)?.id);
  const editorSource = members.find((member) => member.node.id === sourceNodeId);
  const editorTarget = members.find((member) => member.node.id === editorTargetNodeId);
  const sourceDisplayName = editorSource ? memberDisplayName(editorSource, preferences) : '当前节点';
  const sourceRelationToSelf = relationKindBetween(SELF_KEY, sourceNodeId, personRelationships);
  const placeholderLabel = uniquePlaceholderLabel(placeholderBaseName(sourceDisplayName, sourceNodeId === SELF_KEY, sourceRelationToSelf, kind), personRelationshipNodes);

  const constrainCanvasPosition = useCallback((x: number, y: number, nextScale: number) => {
    const viewportWidth = canvasViewport.width;
    const viewportHeight = Math.max(0, canvasViewport.height - 76);
    const contentWidth = graphLayout.width * nextScale;
    const contentHeight = graphLayout.height * nextScale;
    const padding = spacing.md;
    const constrainedX = contentWidth + padding * 2 <= viewportWidth
      ? (viewportWidth - contentWidth) / 2
      : Math.min(padding, Math.max(viewportWidth - contentWidth - padding, x));
    const constrainedY = contentHeight + padding * 2 <= viewportHeight
      ? (viewportHeight - contentHeight) / 2
      : Math.min(padding, Math.max(viewportHeight - contentHeight - padding, y));
    return { x: constrainedX, y: constrainedY };
  }, [canvasViewport.height, canvasViewport.width, graphLayout.height, graphLayout.width]);

  const applyCanvasTransform = useCallback((nextScale: number, x: number, y: number, animated: boolean) => {
    const position = constrainCanvasPosition(x, y, nextScale);
    canvasTransform.current = { scale: nextScale, ...position };
    setScale(nextScale);
    if (!animated) {
      animatedScale.setValue(nextScale);
      animatedTranslateX.setValue(position.x);
      animatedTranslateY.setValue(position.y);
      return;
    }
    Animated.parallel([
      Animated.timing(animatedScale, { duration: 220, easing: Easing.out(Easing.cubic), toValue: nextScale, useNativeDriver: true }),
      Animated.timing(animatedTranslateX, { duration: 220, easing: Easing.out(Easing.cubic), toValue: position.x, useNativeDriver: true }),
      Animated.timing(animatedTranslateY, { duration: 220, easing: Easing.out(Easing.cubic), toValue: position.y, useNativeDriver: true }),
    ]).start();
  }, [animatedScale, animatedTranslateX, animatedTranslateY, constrainCanvasPosition]);

  const showPanorama = useCallback((animated = true) => {
    const position = constrainCanvasPosition(0, 0, fitScale);
    applyCanvasTransform(fitScale, position.x, position.y, animated);
  }, [applyCanvasTransform, constrainCanvasPosition, fitScale]);

  useEffect(() => {
    if (canvasViewport.width && canvasViewport.height) showPanorama(false);
  }, [canvasViewport.height, canvasViewport.width, graphLayout.height, graphLayout.width, showPanorama]);

  const panGesture = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .minDistance(5)
    .onBegin(() => {
      animatedTranslateX.stopAnimation();
      animatedTranslateY.stopAnimation();
      panStart.current = { x: canvasTransform.current.x, y: canvasTransform.current.y };
    })
    .onUpdate(({ translationX, translationY }) => {
      const position = constrainCanvasPosition(panStart.current.x + translationX, panStart.current.y + translationY, canvasTransform.current.scale);
      canvasTransform.current = { ...canvasTransform.current, ...position };
      animatedTranslateX.setValue(position.x);
      animatedTranslateY.setValue(position.y);
    })
    .onEnd(({ velocityX, velocityY }) => {
      applyCanvasTransform(canvasTransform.current.scale, canvasTransform.current.x + velocityX * 0.1, canvasTransform.current.y + velocityY * 0.1, true);
    })
    .runOnJS(true), [animatedTranslateX, animatedTranslateY, applyCanvasTransform, constrainCanvasPosition]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onBegin(({ focalX, focalY }) => {
      animatedScale.stopAnimation();
      animatedTranslateX.stopAnimation();
      animatedTranslateY.stopAnimation();
      pinchStart.current = {
        scale: canvasTransform.current.scale,
        anchorX: (focalX - canvasTransform.current.x) / canvasTransform.current.scale,
        anchorY: (focalY - canvasTransform.current.y) / canvasTransform.current.scale,
      };
    })
    .onUpdate(({ focalX, focalY, scale: gestureScale }) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(minimumScale, pinchStart.current.scale * gestureScale));
      const position = constrainCanvasPosition(focalX - pinchStart.current.anchorX * nextScale, focalY - pinchStart.current.anchorY * nextScale, nextScale);
      canvasTransform.current = { scale: nextScale, ...position };
      animatedScale.setValue(nextScale);
      animatedTranslateX.setValue(position.x);
      animatedTranslateY.setValue(position.y);
    })
    .onEnd(() => setScale(Number(canvasTransform.current.scale.toFixed(2))))
    .runOnJS(true), [animatedScale, animatedTranslateX, animatedTranslateY, constrainCanvasPosition, minimumScale]);

  const canvasGesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture]);

  const changeScale = (delta: number) => {
    const nextScale = Math.min(MAX_SCALE, Math.max(minimumScale, Number((canvasTransform.current.scale + delta).toFixed(2))));
    const centerX = canvasViewport.width / 2;
    const centerY = Math.max(0, canvasViewport.height - 76) / 2;
    const anchorX = (centerX - canvasTransform.current.x) / canvasTransform.current.scale;
    const anchorY = (centerY - canvasTransform.current.y) / canvasTransform.current.scale;
    applyCanvasTransform(nextScale, centerX - anchorX * nextScale, centerY - anchorY * nextScale, true);
  };

  const openMember = (member: TreeMember) => {
    setSelectedMember(member);
    setSelectedPostCount(0);
    if (member.person) void getPostsByPerson(member.person.id).then((posts) => setSelectedPostCount(posts.length));
  };

  const openNewRelationship = (sourceId = SELF_KEY) => {
    setEditingId(null);
    setSourceNodeId(sourceId);
    setTargetMode('placeholder');
    setTargetPersonId(firstAvailablePersonTarget(sourceId, people, personRelationshipNodes, personRelationships));
    setExistingTargetNodeId(firstAvailableNodeTarget(sourceId, members, personRelationships));
    setKind('parent');
    setSelectedMember(null);
    setEditorOpen(true);
  };

  const openRelationshipEditor = (relationship: PersonRelationship | null) => {
    if (!relationship) return;
    setEditingId(relationship.id);
    setSourceNodeId(relationship.sourceNodeId);
    setKind(relationship.kind);
    setSelectedMember(null);
    setEditorOpen(true);
  };

  const saveRelationship = async () => {
    if (!editingId && ((targetMode === 'person' && !targetPersonId) || (targetMode === 'node' && !existingTargetNodeId))) return;
    setSaving(true);
    let createdNode: PersonRelationshipNode | null = null;
    try {
      const editing = editingId ? personRelationships.find((item) => item.id === editingId) : null;
      let targetNodeId = editing?.targetNodeId ?? (targetMode === 'node' ? existingTargetNodeId : '');
      if (!editing) {
        const existingPersonNode = targetMode === 'person' ? personRelationshipNodes.find((node) => node.personId === targetPersonId) : null;
        if (targetMode === 'node') targetNodeId = existingTargetNodeId;
        else if (existingPersonNode) targetNodeId = existingPersonNode.id;
        else {
          createdNode = await createPersonRelationshipNode(targetMode === 'person' ? targetPersonId : null, targetMode === 'placeholder' ? placeholderLabel : null);
          targetNodeId = createdNode.id;
        }
      }
      await savePersonRelationship(sourceNodeId, targetNodeId, kind, editingId);
      setEditorOpen(false);
    } catch (cause: unknown) {
      if (createdNode) await deletePersonRelationshipNode(createdNode.id).catch(() => undefined);
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (relationship: PersonRelationship) => {
    feedback.alert('解除这条关系？', '两个节点之间的这条连接会被移除。已有人物、其他关系和历史记录不会删除。', [
      { text: '取消', style: 'cancel' },
      { text: '解除关系', style: 'destructive', onPress: () => void deletePersonRelationship(relationship.id).then(() => setSelectedMember(null)).catch((cause: unknown) => feedback.alert('解除失败', cause instanceof Error ? cause.message : '请稍后重试。')) },
    ]);
  };

  const bindExistingPerson = async (nodeId: string, personId: string) => {
    try {
      await bindPersonRelationshipNode(nodeId, personId);
      setBindingNodeId(null);
    } catch (cause: unknown) {
      feedback.alert('绑定失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const createAndBindPerson = (node: PersonRelationshipNode) => {
    setSelectedMember(null);
    feedback.prompt('新建人物并绑定', '先记下一个名字，其他资料以后再补。', (name) => {
      void createPerson(name).then((person) => bindPersonRelationshipNode(node.id, person.id)).catch((cause: unknown) => feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'));
    });
  };

  const confirmUnbind = (member: TreeMember) => {
    if (!member.person) return;
    feedback.alert('解除人物绑定？', `${personDisplayName(member.person)}仍会保留在人物列表和历史记录中，当前关系节点会继续保留。`, [
      { text: '取消', style: 'cancel' },
      { text: '解除绑定', style: 'destructive', onPress: () => void bindPersonRelationshipNode(member.node.id, null).then(() => setSelectedMember(null)).catch((cause: unknown) => feedback.alert('解除失败', cause instanceof Error ? cause.message : '请稍后重试。')) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ToolPageHeader
        onBack={() => router.back()}
        right={<ToolPageHeaderAction accessibilityLabel="建立人物关系" onPress={() => openNewRelationship()}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction>}
        subtitle={`以我为根，共 ${linkedNodeCount} 个关系节点`}
        title="我的关系树"
      />

      <View onLayout={({ nativeEvent }) => setCanvasViewport((current) => current.width === nativeEvent.layout.width && current.height === nativeEvent.layout.height ? current : { width: nativeEvent.layout.width, height: nativeEvent.layout.height })} style={styles.canvas}>
        <GestureDetector gesture={canvasGesture}>
          <View collapsable={false} style={styles.canvasGestureArea}>
          <Animated.View style={[styles.treeBody, { width: graphLayout.width, height: graphLayout.height, transform: [{ translateX: animatedTranslateX }, { translateY: animatedTranslateY }, { scale: animatedScale }] }]}>
            <RelationshipEdges layout={graphLayout} relationships={personRelationships} />
            {generations.map((generation) => (
              <View key={generation.level} style={[styles.graphRow, { top: (graphLayout.positions.get(generation.members[0].key)?.y ?? 0) - GRAPH_HEADING_HEIGHT - 12 }]}>
                <View style={styles.generationHeading}>
                  <Text style={styles.generationLabel}>{generationLabel(generation.level)}</Text>
                  <View style={styles.generationRule} />
                  <Text style={styles.generationCount}>{generation.members.length} 个节点</Text>
                </View>
              </View>
            ))}
            {graphLayout.nodes.map(({ member, x, y }) => (
              <View key={member.key} style={[styles.graphNode, { left: x, top: y }]}>
                <TreeNode
                  media={media}
                  member={member}
                  onPress={() => openMember(member)}
                  preferences={preferences}
                  profileAvatarUri={member.key === SELF_KEY ? profileAvatar?.localPath ?? null : null}
                />
              </View>
            ))}

            {!linkedNodeCount ? (
              <View style={styles.emptyBlock}>
                <View style={styles.emptySprout}><View style={styles.emptyStem} /><View style={[styles.emptyLeaf, styles.emptyLeafLeft]} /><View style={[styles.emptyLeaf, styles.emptyLeafRight]} /></View>
                <Text style={styles.emptyTitle}>关系从自己开始</Text>
                <Text style={styles.emptyText}>可以先留下关系位置，暂时不填写具体人物。</Text>
                <Pressable accessibilityRole="button" onPress={() => openNewRelationship()} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text style={styles.emptyButtonText}>建立第一条关系</Text></Pressable>
              </View>
            ) : null}
          </Animated.View>
          </View>
        </GestureDetector>

        <View style={styles.zoomDock}>
          <Pressable accessibilityLabel="缩小关系树" accessibilityRole="button" disabled={scale <= minimumScale} onPress={() => changeScale(-SCALE_STEP)} style={({ pressed }) => [styles.zoomButton, scale <= minimumScale && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'remove', ios: 'minus', web: 'remove' }} size={17} tintColor={colors.inkSoft} /></Pressable>
          <Text style={styles.zoomValue}>{Math.round(scale * 100)}%</Text>
          <Pressable accessibilityLabel="放大关系树" accessibilityRole="button" disabled={scale >= MAX_SCALE} onPress={() => changeScale(SCALE_STEP)} style={({ pressed }) => [styles.zoomButton, scale >= MAX_SCALE && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={17} tintColor={colors.inkSoft} /></Pressable>
          <View style={styles.zoomDivider} />
          <Pressable accessibilityLabel="查看关系树全景" accessibilityRole="button" onPress={() => showPanorama()} style={({ pressed }) => [styles.zoomButton, styles.panoramaButton, pressed && styles.pressed]}><SymbolView name={{ android: 'center_focus_strong', ios: 'scope', web: 'center_focus_strong' }} size={15} tintColor={colors.life} /><Text style={styles.panoramaText}>全景</Text></Pressable>
        </View>
      </View>

      <DraggableBottomSheet onClose={() => setSelectedMember(null)} open={Boolean(selectedMember)} sheetStyle={styles.memberSheet}>
        {selectedMember ? (
          <>
            <View style={styles.memberIdentity}>
              <PersonAvatar media={media} placeholder={selectedMember.node.kind === 'placeholder'} person={selectedMember.person} profileAvatarUri={selectedMember.key === SELF_KEY ? profileAvatar?.localPath ?? null : null} size={58} />
              <View style={styles.memberIdentityCopy}>
                <Text numberOfLines={1} style={[styles.memberName, selectedMember.person && nameTextStyle(preferences.friendNameStyle)]}>{memberDisplayName(selectedMember, preferences)}</Text>
                <Text style={styles.memberRelation}>{selectedMember.relationLabel}</Text>
              </View>
              {selectedMember.person ? <View style={styles.memoryCount}><Text style={styles.memoryCountValue}>{selectedPostCount}</Text><Text style={styles.memoryCountLabel}>共同记录</Text></View> : null}
            </View>
            {selectedMember.directRelationships.length ? <View style={styles.directRelations}>
              <View style={styles.directRelationsHeader}><Text style={styles.directRelationsTitle}>直接关系</Text><Text style={styles.directRelationsHint}>点击关系可编辑</Text></View>
              {selectedMember.directRelationships.map((relationship) => {
                const otherNodeId = relationship.sourceNodeId === selectedMember.node.id ? relationship.targetNodeId : relationship.sourceNodeId;
                const otherMember = members.find((member) => member.node.id === otherNodeId);
                const otherName = otherMember ? memberDisplayName(otherMember, preferences) : '未知节点';
                return <View key={relationship.id} style={styles.directRelationRow}>
                  <Pressable accessibilityLabel={`编辑与${otherName}的关系`} accessibilityRole="button" onPress={() => openRelationshipEditor(relationship)} style={({ pressed }) => [styles.directRelationMain, pressed && styles.pressed]}>
                    <Text numberOfLines={1} style={styles.directRelationName}>{otherName}</Text>
                    <Text style={styles.directRelationKind}>{relationshipLabelForNode(selectedMember.node.id, relationship)}</Text>
                    <SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={14} tintColor={colors.inkFaint} />
                  </Pressable>
                  <View style={styles.directRelationDivider} />
                  <Pressable accessibilityLabel={`解除与${otherName}的关系`} accessibilityRole="button" onPress={() => confirmRemove(relationship)} style={({ pressed }) => [styles.directRelationRemove, pressed && styles.directRelationRemovePressed]}>
                    <SymbolView name={{ android: 'link_off', ios: 'xmark.circle', web: 'link_off' }} size={13} tintColor={colors.danger} />
                    <Text style={styles.directRelationRemoveText}>解除</Text>
                  </Pressable>
                </View>;
              })}
            </View> : null}
            {selectedMember.key === SELF_KEY ? <Pressable accessibilityRole="button" onPress={() => openNewRelationship(selectedMember.node.id)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>建立关系</Text><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={17} tintColor={colors.onLife} /></Pressable> : selectedMember.person ? (
              <>
                <Pressable accessibilityRole="button" onPress={() => { setSelectedMember(null); router.push({ pathname: '/person/[id]', params: { id: selectedMember.person!.id } }); }} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>进入人物页</Text><SymbolView name={{ android: 'arrow_forward', ios: 'arrow.right', web: 'arrow_forward' }} size={17} tintColor={colors.onLife} /></Pressable>
                <Pressable accessibilityRole="button" onPress={() => openNewRelationship(selectedMember.node.id)} style={({ pressed }) => [styles.secondaryAction, styles.singleSecondaryAction, pressed && styles.pressed]}><Text style={styles.secondaryActionText}>建立关系</Text><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={15} tintColor={colors.life} /></Pressable>
                <Pressable accessibilityRole="button" onPress={() => confirmUnbind(selectedMember)} style={({ pressed }) => [styles.tertiaryAction, pressed && styles.pressed]}><Text style={styles.secondaryActionText}>解除人物绑定</Text></Pressable>
              </>
            ) : <><Pressable accessibilityRole="button" onPress={() => openNewRelationship(selectedMember.node.id)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>建立关系</Text><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={17} tintColor={colors.onLife} /></Pressable><Text style={styles.memberActionLabel}>补全这个节点</Text><View style={styles.memberSecondaryActions}><Pressable accessibilityRole="button" onPress={() => { setBindingNodeId(selectedMember.node.id); setSelectedMember(null); }} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Text style={styles.secondaryActionText}>选择人物资料</Text></Pressable><Pressable accessibilityRole="button" onPress={() => createAndBindPerson(selectedMember.node)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Text style={styles.secondaryActionText}>新建人物资料</Text></Pressable></View></>}
          </>
        ) : null}
      </DraggableBottomSheet>

      <DraggableBottomSheet dismissDisabled={saving} onClose={() => setEditorOpen(false)} open={editorOpen} sheetStyle={styles.editorSheet}>
        <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.editorEyebrow}>{editingId ? 'EDIT RELATIONSHIP' : 'NEW RELATIONSHIP'}</Text>
          <Text style={styles.editorTitle}>{editingId ? '编辑关系' : `从${sourceDisplayName}建立关系`}</Text>
          <Text style={styles.editorHint}>{editingId ? '修改这两个节点之间的关系类型。' : '先选择对方与当前节点的关系，再决定如何创建或连接。'}</Text>

          <Text style={styles.fieldLabel}>对方是{sourceNodeId === SELF_KEY ? '我' : sourceDisplayName}的</Text>
          <View style={styles.kindGrid}>
            {RELATION_OPTIONS.map((option) => {
              const selected = kind === option.kind;
              return <Pressable key={option.kind} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setKind(option.kind)} style={({ pressed }) => [styles.kindOption, selected && styles.kindOptionSelected, pressed && styles.pressed]}><SymbolView name={option.icon} size={15} tintColor={selected ? colors.lifeDeep : colors.life} type="hierarchical" /><Text style={[styles.kindLabel, selected && styles.kindLabelSelected]}>{option.label}</Text></Pressable>;
            })}
          </View>

          {!editingId ? <><Text style={styles.fieldLabel}>选择对象</Text><View style={styles.targetModeControl}><Pressable accessibilityRole="button" accessibilityState={{ selected: targetMode === 'placeholder' }} onPress={() => setTargetMode('placeholder')} style={[styles.targetModeOption, targetMode === 'placeholder' && styles.targetModeOptionSelected]}><Text style={[styles.targetModeText, targetMode === 'placeholder' && styles.targetModeTextSelected]}>新建节点</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: targetMode === 'node' }} onPress={() => setTargetMode('node')} style={[styles.targetModeOption, targetMode === 'node' && styles.targetModeOptionSelected]}><Text style={[styles.targetModeText, targetMode === 'node' && styles.targetModeTextSelected]}>树中节点</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: targetMode === 'person' }} onPress={() => setTargetMode('person')} style={[styles.targetModeOption, targetMode === 'person' && styles.targetModeOptionSelected]}><Text style={[styles.targetModeText, targetMode === 'person' && styles.targetModeTextSelected]}>人物资料</Text></Pressable></View>{targetMode === 'placeholder' ? <View style={styles.placeholderNotice}><View style={styles.placeholderNoticeIcon}><SymbolView name={{ android: 'person_add', ios: 'person.crop.circle.badge.plus', web: 'person_add' }} size={20} tintColor={colors.life} type="hierarchical" /></View><View style={styles.placeholderNoticeCopy}><Text numberOfLines={1} style={styles.placeholderNoticeTitle}>{placeholderLabel}</Text><Text style={styles.placeholderNoticeText}>先创建关系位置，之后可以绑定人物资料。</Text></View></View> : targetMode === 'person' ? <><Text style={styles.fieldLabel}>选择人物资料</Text><View style={styles.targetList}>
            {people.filter((person) => isPersonTargetAvailable(sourceNodeId, person.id, people, personRelationshipNodes, personRelationships, editingId)).map((person, index, available) => {
              const selected = targetPersonId === person.id;
              return <Pressable key={person.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setTargetPersonId(person.id)} style={({ pressed }) => [styles.targetRow, index === available.length - 1 && styles.targetRowLast, selected && styles.targetRowSelected, pressed && styles.pressed]}><PersonAvatar media={media} person={person} size={40} /><Text numberOfLines={1} style={[styles.targetName, nameTextStyle(preferences.friendNameStyle)]}>{personDisplayName(person)}</Text><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View></Pressable>;
            })}
            {!people.some((person) => isPersonTargetAvailable(sourceNodeId, person.id, people, personRelationshipNodes, personRelationships, editingId)) ? <Text style={styles.noTarget}>当前没有可绑定的人物。</Text> : null}
          </View></> : <><Text style={styles.fieldLabel}>选择树中节点</Text><View style={styles.targetList}>{members.filter((member) => isNodeTargetAvailable(sourceNodeId, member.node.id, personRelationships, editingId)).map((member, index, available) => { const selected = existingTargetNodeId === member.node.id; return <Pressable key={member.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setExistingTargetNodeId(member.node.id)} style={({ pressed }) => [styles.targetRow, index === available.length - 1 && styles.targetRowLast, selected && styles.targetRowSelected, pressed && styles.pressed]}><PersonAvatar media={media} person={member.person} placeholder={member.node.kind === 'placeholder'} size={40} /><Text numberOfLines={1} style={styles.targetName}>{memberDisplayName(member, preferences)}</Text><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View></Pressable>; })}{!members.some((member) => isNodeTargetAvailable(sourceNodeId, member.node.id, personRelationships, editingId)) ? <Text style={styles.noTarget}>当前没有可以连接的树中节点。</Text> : null}</View></>}</> : null}

          <View style={styles.relationshipPreview}><Text numberOfLines={1} style={styles.relationshipPreviewName}>{editingRelationship ? (editorTarget ? memberDisplayName(editorTarget, preferences) : '未选择节点') : targetMode === 'person' ? (people.find((person) => person.id === targetPersonId) ? personDisplayName(people.find((person) => person.id === targetPersonId)!) : '未选择人物') : targetMode === 'node' ? (editorTarget ? memberDisplayName(editorTarget, preferences) : '未选择节点') : placeholderLabel}</Text><Text style={styles.relationshipPreviewConnector}>是</Text><Text numberOfLines={1} style={styles.relationshipPreviewName}>{sourceNodeId === SELF_KEY ? '我' : sourceDisplayName}</Text><Text style={styles.relationshipPreviewConnector}>的</Text><Text style={styles.relationshipPreviewKind}>{relationLabel(kind)}</Text></View>

          <Pressable accessibilityRole="button" disabled={(!editingId && ((targetMode === 'person' && !targetPersonId) || (targetMode === 'node' && !existingTargetNodeId))) || saving} onPress={() => void saveRelationship()} style={({ pressed }) => [styles.saveButton, ((!editingId && ((targetMode === 'person' && !targetPersonId) || (targetMode === 'node' && !existingTargetNodeId))) || saving) && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveButtonText}>{saving ? '正在保存' : editingId ? '保存关系' : targetMode === 'placeholder' ? '创建关系节点' : '建立关系'}</Text></Pressable>
          {editingId ? <Pressable accessibilityRole="button" onPress={() => { const relationship = personRelationships.find((item) => item.id === editingId); if (relationship) { setEditorOpen(false); confirmRemove(relationship); } }} style={({ pressed }) => [styles.removeRelationshipButton, pressed && styles.pressed]}><Text style={styles.removeActionText}>解除这条关系</Text></Pressable> : null}
        </ScrollView>
      </DraggableBottomSheet>

      <DraggableBottomSheet onClose={() => setBindingNodeId(null)} open={Boolean(bindingNodeId)} sheetStyle={styles.bindingSheet}>
        <Text style={styles.editorEyebrow}>BIND PERSON</Text>
        <Text style={styles.editorTitle}>绑定已有人物</Text>
        <Text style={styles.editorHint}>人物资料和共同记录会显示在这个关系节点中。</Text>
        <View style={[styles.targetList, styles.bindingList]}>
          {people.filter((person) => !personRelationshipNodes.some((node) => node.personId === person.id)).map((person, index, available) => <Pressable key={person.id} accessibilityRole="button" onPress={() => bindingNodeId && void bindExistingPerson(bindingNodeId, person.id)} style={({ pressed }) => [styles.targetRow, index === available.length - 1 && styles.targetRowLast, pressed && styles.pressed]}><PersonAvatar media={media} person={person} size={40} /><Text numberOfLines={1} style={[styles.targetName, nameTextStyle(preferences.friendNameStyle)]}>{personDisplayName(person)}</Text><SymbolView name={{ android: 'arrow_forward', ios: 'arrow.right', web: 'arrow_forward' }} size={16} tintColor={colors.life} /></Pressable>)}
          {!people.some((person) => !personRelationshipNodes.some((node) => node.personId === person.id)) ? <Text style={styles.noTarget}>没有尚未绑定的人物，可以返回后选择“新建并绑定”。</Text> : null}
        </View>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

function TreeNode({ media, member, onPress, preferences, profileAvatarUri }: { media: ReturnType<typeof useAppState>['media']; member: TreeMember; onPress(): void; preferences: ReturnType<typeof useAppState>['preferences']; profileAvatarUri: string | null }) {
  const isSelf = member.key === SELF_KEY;
  const isPlaceholder = member.node.kind === 'placeholder';
  return (
    <Pressable accessibilityLabel={`查看${memberDisplayName(member, preferences)}的关系信息`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.node, isSelf && styles.selfNode, isPlaceholder && styles.placeholderNode, pressed && styles.nodePressed]}>
      {isSelf ? <Text style={styles.rootBadge}>根</Text> : null}
      {isPlaceholder ? <Text style={styles.placeholderBadge}>待补全</Text> : null}
      <PersonAvatar media={media} person={member.person} placeholder={isPlaceholder} profileAvatarUri={profileAvatarUri} size={50} />
      <Text numberOfLines={1} style={[styles.nodeName, isPlaceholder && styles.placeholderNodeName, member.person && nameTextStyle(preferences.friendNameStyle)]}>{memberDisplayName(member, preferences)}</Text>
      <Text numberOfLines={1} style={styles.nodeRelation}>{member.relationLabel}</Text>
    </Pressable>
  );
}

function RelationshipEdges({ layout, relationships }: { layout: TreeGraphLayout; relationships: PersonRelationship[] }) {
  const collapsed = new Set<string>();
  const sharedChildEdges = new Map<string, { partner: PersonRelationship; child: PersonRelationship }>();
  const sameGenerationLaneIndexes = new Map<string, number>();
  const sameGenerationLaneCounts = new Map<number, number>();
  const parentChildEdges = relationships.flatMap((relationship) => relationship.kind === 'parent'
    ? [{ relationship, childId: relationship.sourceNodeId, parentId: relationship.targetNodeId }]
    : relationship.kind === 'child'
      ? [{ relationship, childId: relationship.targetNodeId, parentId: relationship.sourceNodeId }]
      : []);
  relationships.filter((relationship) => relationship.kind === 'partner').forEach((partner) => {
    const partnerIds = new Set([partner.sourceNodeId, partner.targetNodeId]);
    const childIds = new Set(parentChildEdges.filter((edge) => partnerIds.has(edge.parentId)).map((edge) => edge.childId));
    childIds.forEach((childId) => {
      const sharedEdges = parentChildEdges.filter((edge) => edge.childId === childId && partnerIds.has(edge.parentId));
      if (new Set(sharedEdges.map((edge) => edge.parentId)).size !== 2) return;
      const key = `${partner.id}:${childId}`;
      sharedChildEdges.set(key, { partner, child: sharedEdges[0].relationship });
      sharedEdges.forEach((edge) => collapsed.add(edge.relationship.id));
    });
  });
  relationships.forEach((relationship) => {
    if (collapsed.has(relationship.id)) return;
    const source = layout.positions.get(relationship.sourceNodeId);
    const target = layout.positions.get(relationship.targetNodeId);
    if (!source || !target || source.member.level !== target.member.level) return;
    const laneKey = source.member.level;
    sameGenerationLaneIndexes.set(relationship.id, sameGenerationLaneCounts.get(laneKey) ?? 0);
    sameGenerationLaneCounts.set(laneKey, (sameGenerationLaneCounts.get(laneKey) ?? 0) + 1);
  });
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{relationships.filter((relationship) => !collapsed.has(relationship.id)).map((relationship) => {
    const source = layout.positions.get(relationship.sourceNodeId);
    const target = layout.positions.get(relationship.targetNodeId);
    if (!source || !target) return null;
    const sourceCenter = { x: source.x + NODE_WIDTH / 2, y: source.y + NODE_HEIGHT / 2 };
    const targetCenter = { x: target.x + NODE_WIDTH / 2, y: target.y + NODE_HEIGHT / 2 };
    const sameGeneration = source.member.level === target.member.level;
    if (sameGeneration) {
      const laneY = Math.max(source.y, target.y) + NODE_HEIGHT + 10 + (sameGenerationLaneIndexes.get(relationship.id) ?? 0) * 18;
      const sourceBottom = { x: sourceCenter.x, y: source.y + NODE_HEIGHT };
      const targetBottom = { x: targetCenter.x, y: target.y + NODE_HEIGHT };
      const labelLeft = (sourceBottom.x + targetBottom.x) / 2 - 21;
      return <View key={relationship.id}>
        <RelationshipLine end={{ x: sourceBottom.x, y: laneY }} start={sourceBottom} />
        <RelationshipLine end={{ x: targetBottom.x, y: laneY }} start={targetBottom} />
        <RelationshipLine end={{ x: targetBottom.x, y: laneY }} start={{ x: sourceBottom.x, y: laneY }} />
        <View style={[styles.edgeLabel, { left: labelLeft, top: laneY - 9 }]}><Text style={styles.edgeLabelText}>{relationLabel(relationship.kind)}</Text></View>
      </View>;
    }
    const start = { x: sourceCenter.x, y: sourceCenter.y + Math.sign(targetCenter.y - sourceCenter.y) * NODE_HEIGHT / 2 };
    const end = { x: targetCenter.x, y: targetCenter.y - Math.sign(targetCenter.y - sourceCenter.y) * NODE_HEIGHT / 2 };
    return <View key={relationship.id}>
      <RelationshipLine end={end} start={start} />
      <View style={[styles.edgeLabel, { left: (start.x + end.x) / 2 - 21, top: (start.y + end.y) / 2 - 9 }]}><Text style={styles.edgeLabelText}>{relationLabel(relationship.kind)}</Text></View>
    </View>;
  }).concat([...sharedChildEdges.values()].map(({ partner, child }) => {
    const left = layout.positions.get(partner.sourceNodeId);
    const right = layout.positions.get(partner.targetNodeId);
    const target = layout.positions.get(child.kind === 'parent' ? child.sourceNodeId : child.targetNodeId);
    if (!left || !right || !target) return null;
    const x = (left.x + right.x + NODE_WIDTH) / 2;
    const y = Math.max(left.y, right.y) + NODE_HEIGHT + 10 + (sameGenerationLaneIndexes.get(partner.id) ?? 0) * 18;
    const targetCenterX = target.x + NODE_WIDTH / 2;
    const targetEdgeY = target.y > y ? target.y : target.y + NODE_HEIGHT;
    return <View key={`family-${partner.id}-${target.member.node.id}`}><RelationshipLine end={{ x: targetCenterX, y: targetEdgeY }} start={{ x, y }} /></View>;
  }))}</View>;
}

function RelationshipLine({ end, start }: { end: { x: number; y: number }; start: { x: number; y: number } }) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  return <View style={[styles.relationshipLine, { left: (start.x + end.x) / 2 - length / 2, top: (start.y + end.y) / 2 - 1, width: length, transform: [{ rotate: `${angle}deg` }] }]} />;
}

function PersonAvatar({ media, person, placeholder = false, profileAvatarUri = null, size }: { media: ReturnType<typeof useAppState>['media']; person: Person | null; placeholder?: boolean; profileAvatarUri?: string | null; size: number }) {
  const avatar = person?.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
  const uri = profileAvatarUri ?? avatar?.localPath ?? null;
  const label = person ? personDisplayName(person).slice(0, 1) : '我';
  return <View style={[styles.avatar, placeholder && styles.placeholderAvatar, { width: size, height: size, borderRadius: size / 2 }]}>{uri ? <Image accessibilityLabel={`${label}的头像`} resizeMode="cover" source={{ uri }} style={styles.avatarImage} /> : placeholder ? <SymbolView name={{ android: 'person_add', ios: 'person.crop.circle.badge.plus', web: 'person_add' }} size={size * 0.42} tintColor={colors.life} type="hierarchical" /> : <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{label}</Text>}</View>;
}

function buildTreeMembers(people: Person[], nodes: PersonRelationshipNode[], relationships: PersonRelationship[]): TreeMember[] {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rootNode = nodes.find((node) => node.id === SELF_KEY) ?? nodes.find((node) => node.kind === 'self') ?? { id: SELF_KEY, kind: 'self' as const, personId: null, label: null, createdAt: '', updatedAt: '' };
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  nodesById.set(rootNode.id, rootNode);
  const levels = new Map<string, number>([[SELF_KEY, 0]]);
  const primaryRelationships = new Map<string, PersonRelationship>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const relationship of relationships) {
      const sourceKey = relationship.sourceNodeId;
      const targetKey = relationship.targetNodeId;
      if (!nodesById.has(sourceKey) || !nodesById.has(targetKey)) continue;
      const delta = generationDelta(relationship.kind);
      if (levels.has(sourceKey) && !levels.has(targetKey)) {
        levels.set(targetKey, levels.get(sourceKey)! + delta);
        primaryRelationships.set(targetKey, relationship);
        changed = true;
      } else if (!levels.has(sourceKey) && levels.has(targetKey)) {
        levels.set(sourceKey, levels.get(targetKey)! - delta);
        primaryRelationships.set(sourceKey, relationship);
        changed = true;
      }
    }
  }
  for (const relationship of relationships) {
    if (nodesById.has(relationship.targetNodeId) && !levels.has(relationship.targetNodeId)) {
      levels.set(relationship.targetNodeId, 0);
      primaryRelationships.set(relationship.targetNodeId, relationship);
    }
    if (nodesById.has(relationship.sourceNodeId) && !levels.has(relationship.sourceNodeId)) {
      levels.set(relationship.sourceNodeId, 0);
      primaryRelationships.set(relationship.sourceNodeId, relationship);
    }
  }

  const selfRelationships = relationships.filter((item) => item.sourceNodeId === SELF_KEY || item.targetNodeId === SELF_KEY);
  const self: TreeMember = { key: SELF_KEY, level: 0, node: rootNode, person: null, relationship: selfRelationships[0] ?? null, directRelationships: selfRelationships, relationLabel: '我自己' };
  const linked = [...levels.entries()].filter(([key]) => key !== SELF_KEY).flatMap(([key, level]) => {
    const node = nodesById.get(key);
    if (!node) return [];
    const person = node.personId ? peopleById.get(node.personId) ?? null : null;
    const relationship = primaryRelationships.get(key) ?? relationships.find((item) => item.targetNodeId === key || item.sourceNodeId === key) ?? null;
    const directRelationships = relationships.filter((item) => item.sourceNodeId === key || item.targetNodeId === key);
    return [{ key, level, node, person, relationship, directRelationships, relationLabel: relationshipLabelForNode(key, relationship) }];
  });
  return [self, ...linked];
}

function buildTreeGraphLayout(generations: Array<{ level: number; members: TreeMember[] }>, relationships: PersonRelationship[], viewportWidth: number): TreeGraphLayout {
  const branchKeys = buildBranchKeys(generations, relationships);
  const rows = generations.map((generation) => {
    const members = [...generation.members].sort((left, right) => branchKeys.get(left.node.id)!.localeCompare(branchKeys.get(right.node.id)!));
    const gaps = members.slice(1).map((member, index) => graphNodeGap(members[index], member, relationships, branchKeys));
    return { gaps, members, width: members.length * NODE_WIDTH + gaps.reduce((total, gap) => total + gap, 0) };
  });
  const contentWidth = Math.max(NODE_WIDTH, ...rows.map((row) => row.width)) + GRAPH_SIDE_PADDING * 2;
  const width = Math.max(viewportWidth, contentWidth);
  const memberCount = generations.reduce((total, generation) => total + generation.members.length, 0);
  const nodes: PositionedMember[] = [];
  const positions = new Map<string, PositionedMember>();
  let rowTop = 0;
  rows.forEach((row, rowIndex) => {
    let x = (width - row.width) / 2;
    row.members.forEach((member, index) => {
      const positioned = { member, branchKey: branchKeys.get(member.node.id) ?? member.node.id, x, y: rowTop + GRAPH_HEADING_HEIGHT + 32 };
      nodes.push(positioned);
      positions.set(member.node.id, positioned);
      x += NODE_WIDTH + (row.gaps[index] ?? 0);
    });
    const sameGenerationRelationshipCount = countSameGenerationRelationships(row.members, relationships);
    rowTop += GRAPH_ROW_HEIGHT + Math.max(0, sameGenerationRelationshipCount - 2) * 18;
  });
  const height = memberCount === 1 ? 500 : Math.max(260, rowTop + 28);
  return { width, height, nodes, positions };
}

function countSameGenerationRelationships(members: TreeMember[], relationships: PersonRelationship[]): number {
  const nodeIds = new Set(members.map((member) => member.node.id));
  return relationships.filter((relationship) => nodeIds.has(relationship.sourceNodeId) && nodeIds.has(relationship.targetNodeId)).length;
}

function graphNodeGap(left: TreeMember, right: TreeMember, relationships: PersonRelationship[], branchKeys: Map<string, string>): number {
  const arePartners = relationships.some((relationship) => relationship.kind === 'partner' && ((relationship.sourceNodeId === left.node.id && relationship.targetNodeId === right.node.id) || (relationship.sourceNodeId === right.node.id && relationship.targetNodeId === left.node.id)));
  if (arePartners) return PARTNER_NODE_GAP;
  const leftAnchor = branchKeys.get(left.node.id)?.split('|')[0];
  const rightAnchor = branchKeys.get(right.node.id)?.split('|')[0];
  return leftAnchor && rightAnchor && leftAnchor !== rightAnchor ? BRANCH_NODE_GAP : NODE_GAP;
}

function groupMembersByLevel(members: TreeMember[], relationships: PersonRelationship[]): Array<{ level: number; members: TreeMember[] }> {
  const grouped = new Map<number, TreeMember[]>();
  for (const member of members) grouped.set(member.level, [...(grouped.get(member.level) ?? []), member]);
  return [...grouped.entries()].sort(([left], [right]) => left - right).map(([level, items]) => ({ level, members: items.sort((left, right) => left.key === SELF_KEY ? -1 : right.key === SELF_KEY ? 1 : branchSortKey(left, relationships).localeCompare(branchSortKey(right, relationships), 'zh-CN')) }));
}

function branchSortKey(member: TreeMember, relationships: PersonRelationship[]): string {
  const partner = relationships.find((relationship) => relationship.kind === 'partner' && (relationship.sourceNodeId === member.node.id || relationship.targetNodeId === member.node.id));
  return partner ? `0:${partner.sourceNodeId === member.node.id ? partner.targetNodeId : partner.sourceNodeId}` : `1:${member.person?.name ?? member.node.label ?? member.node.id}`;
}

function buildBranchKeys(generations: Array<{ level: number; members: TreeMember[] }>, relationships: PersonRelationship[]): Map<string, string> {
  const keys = new Map<string, string>();
  const levels = new Map(generations.flatMap((generation) => generation.members.map((member) => [member.node.id, generation.level] as const)));
  const partnerPairs = relationships.filter((relationship) => relationship.kind === 'partner');
  const parentChildPairs = relationships.flatMap((relationship) => relationship.kind === 'parent'
    ? [{ parentId: relationship.targetNodeId, childId: relationship.sourceNodeId }]
    : relationship.kind === 'child'
      ? [{ parentId: relationship.sourceNodeId, childId: relationship.targetNodeId }]
      : []);
  const rootMembers = generations.find((generation) => generation.level === 0)?.members ?? [];
  const rootPartnerIds = new Set(partnerPairs.filter((pair) => pair.sourceNodeId === SELF_KEY || pair.targetNodeId === SELF_KEY).flatMap((pair) => [pair.sourceNodeId, pair.targetNodeId]));
  [...rootMembers].sort((left, right) => left.node.id === SELF_KEY ? -1 : right.node.id === SELF_KEY ? 1 : rootPartnerIds.has(left.node.id) && !rootPartnerIds.has(right.node.id) ? -1 : !rootPartnerIds.has(left.node.id) && rootPartnerIds.has(right.node.id) ? 1 : left.node.id.localeCompare(right.node.id)).forEach((member, index) => keys.set(member.node.id, String(index).padStart(3, '0')));
  const maximumDistance = Math.max(0, ...generations.map((generation) => Math.abs(generation.level)));
  for (let distance = 1; distance <= maximumDistance; distance += 1) {
    for (const level of [-distance, distance]) {
      const generation = generations.find((item) => item.level === level);
      if (!generation) continue;
      for (const member of generation.members) {
        const adjacentIds = parentChildPairs.flatMap((pair) => pair.parentId === member.node.id ? [pair.childId] : pair.childId === member.node.id ? [pair.parentId] : []).filter((id) => levels.get(id) === (level < 0 ? level + 1 : level - 1));
        const anchor = adjacentIds.map((id) => keys.get(id)).filter((key): key is string => Boolean(key)).sort()[0] ?? '999';
        const partner = partnerPairs.find((pair) => pair.sourceNodeId === member.node.id || pair.targetNodeId === member.node.id);
        const group = partner ? [partner.sourceNodeId, partner.targetNodeId].sort().join(':') : member.node.id;
        keys.set(member.node.id, `${anchor}|${group}|${member.node.id}`);
      }
    }
  }
  for (const generation of generations) for (const member of generation.members) if (!keys.has(member.node.id)) keys.set(member.node.id, `999|${member.node.id}`);
  return keys;
}

function generationDelta(kind: PersonRelationshipKind): number {
  if (kind === 'parent') return -1;
  if (kind === 'child') return 1;
  return 0;
}

function inverseKind(kind: PersonRelationshipKind): PersonRelationshipKind {
  if (kind === 'parent') return 'child';
  if (kind === 'child') return 'parent';
  return kind;
}

function relationshipLabelForNode(nodeId: string, relationship: PersonRelationship | null): string {
  if (!relationship) return '重要的人';
  return relationLabel(relationship.sourceNodeId === nodeId ? inverseKind(relationship.kind) : relationship.kind);
}

function relationLabel(kind: PersonRelationshipKind): string {
  return RELATION_OPTIONS.find((option) => option.kind === kind)?.label ?? '其他';
}

function generationLabel(level: number): string {
  if (level === 0) return '我的一代';
  if (level === -1) return '上一代';
  if (level === 1) return '下一代';
  return level < 0 ? `上 ${Math.abs(level)} 代` : `下 ${level} 代`;
}

function memberDisplayName(member: TreeMember, preferences: ReturnType<typeof useAppState>['preferences']): string {
  if (member.key === SELF_KEY) return preferences.profileName || preferences.nickname || '我';
  if (member.person) return personDisplayName(member.person);
  return member.node.label?.trim() || '待补全档案';
}

function placeholderBaseName(sourceName: string, sourceIsSelf: boolean, sourceRelationToSelf: PersonRelationshipKind | null, kind: PersonRelationshipKind): string {
  const label = sourceIsSelf
    ? kind === 'parent' ? '我的父母' : kind === 'child' ? '我的子女' : `我的${relationLabel(kind)}`
    : sourceRelationToSelf === 'parent' && kind === 'partner'
      ? '我的父母'
      : `${sourceName}的${relationLabel(kind)}`;
  return label.slice(0, 40);
}

function relationKindBetween(sourceNodeId: string, targetNodeId: string, relationships: PersonRelationship[]): PersonRelationshipKind | null {
  const relationship = relationships.find((item) => (item.sourceNodeId === sourceNodeId && item.targetNodeId === targetNodeId) || (item.sourceNodeId === targetNodeId && item.targetNodeId === sourceNodeId));
  if (!relationship) return null;
  return relationship.sourceNodeId === sourceNodeId ? relationship.kind : inverseKind(relationship.kind);
}

function uniquePlaceholderLabel(base: string, nodes: PersonRelationshipNode[]): string {
  const used = new Set(nodes.map((node) => node.label?.trim()).filter((label): label is string => Boolean(label)));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base.slice(0, 39 - String(suffix).length)} ${suffix}`)) suffix += 1;
  return `${base.slice(0, 39 - String(suffix).length)} ${suffix}`;
}

function firstAvailablePersonTarget(sourceNodeId: string, people: Person[], nodes: PersonRelationshipNode[], relationships: PersonRelationship[], editingId: string | null = null): string {
  return people.find((person) => isPersonTargetAvailable(sourceNodeId, person.id, people, nodes, relationships, editingId))?.id ?? '';
}

function firstAvailableNodeTarget(sourceNodeId: string, members: TreeMember[], relationships: PersonRelationship[], editingId: string | null = null): string {
  return members.find((member) => isNodeTargetAvailable(sourceNodeId, member.node.id, relationships, editingId))?.node.id ?? '';
}

function isNodeTargetAvailable(sourceNodeId: string, targetNodeId: string, relationships: PersonRelationship[], editingId: string | null = null): boolean {
  if (!targetNodeId || sourceNodeId === targetNodeId) return false;
  return !relationships.some((item) => item.id !== editingId && ((item.sourceNodeId === sourceNodeId && item.targetNodeId === targetNodeId) || (item.sourceNodeId === targetNodeId && item.targetNodeId === sourceNodeId)));
}

function isPersonTargetAvailable(sourceNodeId: string, targetPersonId: string, people: Person[], nodes: PersonRelationshipNode[], relationships: PersonRelationship[], editingId: string | null = null): boolean {
  if (!people.some((person) => person.id === targetPersonId)) return false;
  const targetNode = nodes.find((node) => node.personId === targetPersonId);
  if (!targetNode) return true;
  if (sourceNodeId === targetNode.id) return false;
  return !relationships.some((item) => item.id !== editingId && ((item.sourceNodeId === sourceNodeId && item.targetNodeId === targetNode.id) || (item.sourceNodeId === targetNode.id && item.targetNodeId === sourceNodeId)));
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: colors.paper },
  canvasGestureArea: { flex: 1, overflow: 'hidden' },
  treeBody: { position: 'relative', transformOrigin: 'top left' },
  graphRow: { width: '100%', height: GRAPH_HEADING_HEIGHT, position: 'absolute', left: 0 },
  graphNode: { width: NODE_WIDTH, height: NODE_HEIGHT, position: 'absolute', zIndex: 3 },
  generationHeading: { minHeight: 30, marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  generationLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  generationRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lifeLine },
  generationCount: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  node: { width: 100, minHeight: 116, paddingHorizontal: 7, paddingTop: 10, paddingBottom: 11, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopLeftRadius: 31, borderTopRightRadius: 31, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 },
  selfNode: { borderWidth: 1.5, borderColor: colors.life, backgroundColor: colors.sheet },
  placeholderNode: { borderStyle: 'dashed', borderColor: colors.lifeLine, backgroundColor: colors.paper },
  nodePressed: { opacity: 0.74, transform: [{ translateY: 2 }] },
  rootBadge: { position: 'absolute', zIndex: 2, top: 4, right: 2, minWidth: 25, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.life, color: colors.onLife, fontSize: 8, textAlign: 'center' },
  placeholderBadge: { position: 'absolute', zIndex: 2, top: 4, right: 2, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 10, backgroundColor: colors.paper, color: colors.life, fontSize: 8, textAlign: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.life },
  placeholderAvatar: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.life, backgroundColor: colors.lifeLight },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.onLife, fontFamily: typography.display },
  nodeName: { width: '100%', marginTop: 8, color: colors.ink, fontFamily: typography.display, fontSize: 14, textAlign: 'center' },
  placeholderNodeName: { color: colors.inkSoft, fontSize: 12 },
  nodeRelation: { maxWidth: '100%', marginTop: 4, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.lifeLight, color: colors.life, fontSize: 8 },
  relationshipLine: { height: 2, position: 'absolute', zIndex: 1, borderRadius: 1, backgroundColor: colors.life, opacity: 0.72 },
  edgeLabel: { width: 42, height: 18, position: 'absolute', zIndex: 2, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 9, backgroundColor: colors.paper },
  edgeLabelText: { color: colors.life, fontSize: 8, fontWeight: '700' },
  emptyBlock: { position: 'absolute', top: 210, left: spacing.lg, right: spacing.lg, padding: spacing.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  emptySprout: { width: 52, height: 58, position: 'relative' },
  emptyStem: { width: 1, height: 42, position: 'absolute', bottom: 0, left: 26, backgroundColor: colors.life },
  emptyLeaf: { width: 23, height: 13, position: 'absolute', borderTopLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: colors.lifeLight },
  emptyLeafLeft: { top: 16, left: 4, transform: [{ rotate: '20deg' }] },
  emptyLeafRight: { top: 5, right: 3, transform: [{ rotate: '-18deg' }] },
  emptyTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  emptyText: { maxWidth: 250, marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 19, textAlign: 'center' },
  emptyButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.life },
  emptyButtonText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  zoomDock: { position: 'absolute', bottom: 18, left: '50%', marginLeft: -116, width: 232, height: 50, padding: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 25, backgroundColor: colors.toolbar, shadowColor: colors.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 18, elevation: 5 },
  zoomButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  zoomValue: { width: 44, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, textAlign: 'center' },
  zoomDivider: { width: StyleSheet.hairlineWidth, height: 22, marginHorizontal: 5, backgroundColor: colors.line },
  panoramaButton: { width: 66, flexDirection: 'row', gap: 5 },
  panoramaText: { color: colors.life, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.36 },
  memberSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  memberIdentity: { flexDirection: 'row', alignItems: 'center' },
  memberIdentityCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  memberName: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  memberRelation: { marginTop: 5, color: colors.life, fontSize: 10 },
  directRelations: { marginTop: spacing.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper },
  directRelationsHeader: { minHeight: 36, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  directRelationsTitle: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  directRelationsHint: { color: colors.inkFaint, fontSize: 8 },
  directRelationRow: { minHeight: 48, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  directRelationMain: { minWidth: 0, flex: 1, paddingLeft: spacing.md, paddingRight: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  directRelationName: { minWidth: 0, flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 12 },
  directRelationKind: { marginHorizontal: spacing.sm, color: colors.life, fontSize: 9 },
  directRelationDivider: { width: StyleSheet.hairlineWidth, marginVertical: 10, backgroundColor: colors.lineSoft },
  directRelationRemove: { width: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  directRelationRemovePressed: { backgroundColor: colors.dangerLight, opacity: 0.76 },
  directRelationRemoveText: { color: colors.danger, fontSize: 9, fontWeight: '700' },
  memoryCount: { minWidth: 68, paddingLeft: spacing.md, alignItems: 'flex-end', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  memoryCountValue: { color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  memoryCountLabel: { marginTop: 3, color: colors.inkFaint, fontSize: 8 },
  primaryAction: { minHeight: 50, marginTop: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.life },
  primaryActionText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  memberActionLabel: { marginTop: spacing.lg, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  memberSecondaryActions: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  tertiaryAction: { minHeight: 36, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md },
  singleSecondaryAction: { width: '100%', marginTop: spacing.sm, paddingHorizontal: spacing.md, flex: 0 },
  secondaryActionText: { color: colors.life, fontSize: 10, fontWeight: '700' },
  removeActionText: { color: colors.danger, fontSize: 10, fontWeight: '700' },
  editorSheet: { maxHeight: '91%', paddingHorizontal: 0 },
  editorContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  editorEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 },
  editorTitle: { marginTop: 6, color: colors.ink, fontFamily: typography.display, fontSize: 27 },
  editorHint: { marginTop: 7, color: colors.inkSoft, fontSize: 10, lineHeight: 17 },
  relationshipPreview: { minHeight: 50, marginTop: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  relationshipPreviewName: { maxWidth: '25%', color: colors.lifeDeep, fontFamily: typography.display, fontSize: 13 },
  relationshipPreviewConnector: { color: colors.inkFaint, fontSize: 9 },
  relationshipPreviewKind: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.sheet, color: colors.life, fontSize: 9, fontWeight: '700' },
  fieldLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  kindOption: { minWidth: '31%', minHeight: 42, paddingHorizontal: spacing.sm, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet },
  kindOptionSelected: { borderColor: colors.life, backgroundColor: colors.lifeLight },
  kindLabel: { color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  kindLabelSelected: { color: colors.lifeDeep },
  targetModeControl: { padding: 4, flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper },
  targetModeOption: { minHeight: 40, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  targetModeOptionSelected: { backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 1 },
  targetModeText: { color: colors.inkFaint, fontSize: 10 },
  targetModeTextSelected: { color: colors.life, fontWeight: '700' },
  placeholderNotice: { minHeight: 74, marginTop: spacing.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  placeholderNoticeIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.sheet },
  placeholderNoticeCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  placeholderNoticeTitle: { color: colors.lifeDeep, fontFamily: typography.display, fontSize: 15 },
  placeholderNoticeText: { marginTop: 3, color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
  targetList: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet },
  targetRow: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  targetRowLast: { borderBottomWidth: 0 },
  targetRowSelected: { backgroundColor: colors.lifeLight },
  targetName: { minWidth: 0, flex: 1, marginLeft: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  radioSelected: { borderColor: colors.life },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.life },
  noTarget: { padding: spacing.lg, color: colors.inkFaint, fontSize: 10, textAlign: 'center' },
  bindingSheet: { maxHeight: '82%', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  bindingList: { marginTop: spacing.lg },
  saveButton: { minHeight: 52, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  saveButtonText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  removeRelationshipButton: { minHeight: 42, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
}));
