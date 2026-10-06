import { memo, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  /** Distance between dot centres. */
  pitch?: number;
  /** The black of the screen between the dots. */
  ink?: string;
  /** Colours of the moving light seen through the dots. */
  lights?: string[];
  /** Freeze the light (reduced motion, thumbnails). */
  still?: boolean;
};

/**
 * The IRLY halftone field: a black screen pierced by a grid of dots, with
 * slow light drifting behind it, so the dots brighten and fade as it passes.
 * Same idea as a CSS radial-gradient mask, drawn once in SVG; only the light
 * layers move, which keeps it cheap on a phone.
 */
export const DotField = memo(function DotField({ pitch = 12, ink = '#050506', lights = ['#FFFFFF', '#8EA3BF', '#C9D3E0'], still = false }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 1 || Math.abs(height - box.h) > 1) setBox({ w: width, h: height });
  };

  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    const drift = (ms: number) => withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1, false);
    a.set(drift(7000));
    b.set(drift(9500));
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
    };
  }, [still, a, b]);

  const { w, h } = box;
  const L = Math.max(w, h) * 0.9;
  const lightA = useAnimatedStyle(() => ({ transform: [{ translateX: w * (0.1 + 0.5 * a.value) - L / 2 }, { translateY: h * (0.42 - 0.08 * b.value) - L / 2 }] }));
  const lightB = useAnimatedStyle(() => ({ transform: [{ translateX: w * (0.85 - 0.45 * b.value) - L / 2 }, { translateY: h * (0.3 + 0.3 * a.value) - L / 2 }] }));
  const lightC = useAnimatedStyle(() => ({ transform: [{ translateX: w * (0.3 + 0.3 * b.value) - L / 2 }, { translateY: h * (0.75 - 0.1 * a.value) - L / 2 }] }));

  const r = pitch * 0.28;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {w ? (
        <>
          <Light size={L} color={lights[0]} strength={0.55} style={lightA} />
          <Light size={L * 0.8} color={lights[1] ?? lights[0]} strength={0.45} style={lightB} />
          <Light size={L * 0.7} color={lights[2] ?? lights[0]} strength={0.3} style={lightC} />
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Defs>
              <Pattern id="irlyDots" x={0} y={0} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
                <Circle cx={pitch / 2} cy={pitch / 2} r={r} fill="#000000" />
              </Pattern>
              <Mask id="irlyScreen" x={0} y={0} width={w} height={h} maskUnits="userSpaceOnUse">
                <Rect x={0} y={0} width={w} height={h} fill="#FFFFFF" />
                <Rect x={0} y={0} width={w} height={h} fill="url(#irlyDots)" />
              </Mask>
            </Defs>
            <Rect x={0} y={0} width={w} height={h} fill={ink} mask="url(#irlyScreen)" />
          </Svg>
        </>
      ) : null}
    </View>
  );
});

function Light({ size, color, strength, style }: { size: number; color: string; strength: number; style: object }) {
  const id = `irlyLight-${color.replace('#', '')}`;
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.55" stopColor={color} stopOpacity={strength * 0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
