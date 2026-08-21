import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const BRAND_GREEN = '#1D6B49';
const BRAND_PAPER = '#F4F6EF';
const BRAND_GOLD = '#D4A84F';
const MINIMUM_VISIBLE_MS = 1250;
const EXIT_DURATION_MS = 360;

interface LaunchScreenProps {
  ready: boolean;
  onFinish(): void;
}

export function LaunchScreen({ onFinish, ready }: LaunchScreenProps) {
  const { width } = useWindowDimensions();
  const mountedAt = useRef(Date.now());
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.78)).current;
  const markRotation = useRef(new Animated.Value(-18)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyLift = useRef(new Animated.Value(12)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const orbitOpacity = useRef(new Animated.Value(0)).current;

  const markSize = Math.min(168, width * 0.42);
  const innerOrbitSize = markSize + 86;
  const outerOrbitSize = markSize + 176;
  const innerOrbitInset = (outerOrbitSize - innerOrbitSize) / 2;

  useEffect(() => {
    let active = true;
    let introAnimation: Animated.CompositeAnimation | null = null;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!active) return;
      setReduceMotion(enabled);
      if (enabled) {
        markOpacity.setValue(1);
        markScale.setValue(1);
        markRotation.setValue(0);
        copyOpacity.setValue(1);
        copyLift.setValue(0);
        progress.setValue(1);
        orbitOpacity.setValue(1);
        return;
      }

      introAnimation = Animated.parallel([
        Animated.timing(orbitOpacity, {
          duration: 780,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(markOpacity, {
            duration: 430,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(markScale, {
            damping: 15,
            mass: 0.75,
            stiffness: 105,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(markRotation, {
            duration: 900,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(330),
          Animated.parallel([
            Animated.timing(copyOpacity, {
              duration: 440,
              easing: Easing.out(Easing.quad),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(copyLift, {
              duration: 520,
              easing: Easing.out(Easing.cubic),
              toValue: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.timing(progress, {
          duration: 1120,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]);

      introAnimation.start(({ finished }) => {
        if (!finished || !active) return;
        pulseAnimation.current = Animated.loop(Animated.sequence([
          Animated.timing(markScale, {
            duration: 1150,
            easing: Easing.inOut(Easing.ease),
            toValue: 1.035,
            useNativeDriver: true,
          }),
          Animated.timing(markScale, {
            duration: 1150,
            easing: Easing.inOut(Easing.ease),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]));
        pulseAnimation.current.start();
      });
    });

    return () => {
      active = false;
      introAnimation?.stop();
      pulseAnimation.current?.stop();
    };
  }, [copyLift, copyOpacity, markOpacity, markRotation, markScale, orbitOpacity, progress]);

  useEffect(() => {
    if (!ready) return;
    const remaining = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - mountedAt.current));
    const timeout = setTimeout(() => {
      pulseAnimation.current?.stop();
      Animated.timing(screenOpacity, {
        duration: reduceMotion ? 120 : EXIT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, reduceMotion ? 0 : remaining);

    return () => clearTimeout(timeout);
  }, [onFinish, ready, reduceMotion, screenOpacity]);

  return (
    <Animated.View
      accessibilityLabel="仍在，正在打开"
      accessibilityRole="summary"
      accessible
      importantForAccessibility="yes"
      pointerEvents="auto"
      style={[styles.screen, { opacity: screenOpacity }]}
    >
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={styles.edgeLine} />
        <View style={[styles.edgeTick, styles.edgeTickTop]} />
        <View style={[styles.edgeTick, styles.edgeTickMiddle]} />
        <View style={[styles.edgeTick, styles.edgeTickBottom]} />
        <View style={styles.cornerIndex}>
          <Text style={styles.cornerIndexText}>01</Text>
          <View style={styles.cornerIndexLine} />
          <Text style={styles.cornerIndexText}>TODAY</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.logoStage, { height: outerOrbitSize, width: outerOrbitSize }]}>
          <Animated.View style={[styles.markStage, { opacity: orbitOpacity }]}>
            <View style={[styles.orbit, styles.outerOrbit, { height: outerOrbitSize, width: outerOrbitSize }]} />
            <View
              style={[
                styles.orbit,
                styles.innerOrbit,
                { height: innerOrbitSize, left: innerOrbitInset, top: innerOrbitInset, width: innerOrbitSize },
              ]}
            />
            <View style={[styles.orbitNotch, { left: (outerOrbitSize / 2) - 3, top: innerOrbitInset + 7 }]} />
          </Animated.View>

          <Animated.View
            style={{
              opacity: markOpacity,
              transform: [
                { rotate: markRotation.interpolate({ inputRange: [-18, 0], outputRange: ['-18deg', '0deg'] }) },
                { scale: markScale },
              ],
            }}
          >
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require('../../../assets/splash-icon.png')}
              style={{ height: markSize, width: markSize }}
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, { opacity: copyOpacity, transform: [{ translateY: copyLift }] }]}>
          <Text style={styles.eyebrow}>STILL ALIVE / LOCAL MEMORY</Text>
          <Text style={styles.title}>仍在</Text>
          <View style={styles.titleRule} />
          <Text style={styles.tagline}>今天，也留下一个坐标。</Text>
        </Animated.View>
      </View>

      <View pointerEvents="none" style={styles.loadingArea}>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingProgress, { transform: [{ scaleX: progress }] }]} />
        </View>
        <View style={styles.loadingMeta}>
          <Text style={styles.loadingText}>OPENING YOUR SPACE</Text>
          <View style={styles.liveDot} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BRAND_GREEN,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  edgeLine: {
    backgroundColor: 'rgba(244, 246, 239, 0.16)',
    bottom: 48,
    left: 27,
    position: 'absolute',
    top: 48,
    width: StyleSheet.hairlineWidth,
  },
  edgeTick: {
    backgroundColor: 'rgba(244, 246, 239, 0.34)',
    height: StyleSheet.hairlineWidth,
    left: 27,
    position: 'absolute',
    width: 11,
  },
  edgeTickTop: { top: '20%' },
  edgeTickMiddle: { top: '50%' },
  edgeTickBottom: { top: '80%' },
  cornerIndex: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 24,
    top: 54,
  },
  cornerIndexLine: {
    backgroundColor: 'rgba(244, 246, 239, 0.35)',
    height: StyleSheet.hairlineWidth,
    width: 18,
  },
  cornerIndexText: {
    color: 'rgba(244, 246, 239, 0.68)',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 42,
    paddingHorizontal: 34,
  },
  logoStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markStage: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  orbit: {
    borderRadius: 999,
    position: 'absolute',
  },
  outerOrbit: {
    borderColor: 'rgba(244, 246, 239, 0.07)',
    borderWidth: 1,
    left: 0,
    top: 0,
  },
  innerOrbit: {
    borderColor: 'rgba(244, 246, 239, 0.14)',
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  orbitNotch: {
    backgroundColor: BRAND_GOLD,
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    width: 6,
  },
  copy: {
    alignItems: 'center',
    marginTop: -42,
  },
  eyebrow: {
    color: 'rgba(244, 246, 239, 0.64)',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0,
  },
  title: {
    color: BRAND_PAPER,
    fontFamily: 'serif',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 50,
    marginTop: 5,
  },
  titleRule: {
    backgroundColor: BRAND_GOLD,
    height: 2,
    marginBottom: 12,
    marginTop: 4,
    width: 24,
  },
  tagline: {
    color: 'rgba(244, 246, 239, 0.84)',
    fontFamily: 'serif',
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 22,
  },
  loadingArea: {
    bottom: 48,
    left: 46,
    position: 'absolute',
    right: 32,
  },
  loadingTrack: {
    backgroundColor: 'rgba(244, 246, 239, 0.14)',
    height: 1,
    overflow: 'hidden',
    width: '100%',
  },
  loadingProgress: {
    backgroundColor: BRAND_GOLD,
    height: 1,
    width: '100%',
  },
  loadingMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  loadingText: {
    color: 'rgba(244, 246, 239, 0.48)',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0,
  },
  liveDot: {
    backgroundColor: BRAND_GOLD,
    borderRadius: 2,
    height: 4,
    marginLeft: 7,
    width: 4,
  },
});
