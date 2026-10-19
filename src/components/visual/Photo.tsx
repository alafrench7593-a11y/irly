import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { photo as photoUrl } from "@/data/photos";
import type { Visual } from "@/data/types";
import type { LightId } from "@/theme/lights";
import { useTheme } from "@/theme/useTheme";

type Props = {
  visual: Visual;
  /** Destination light: tints the loading state behind the photo. */
  light: LightId;
  style?: StyleProp<ViewStyle>;
  /** Bottom gradient so text stays legible on any photo. */
  scrim?: "none" | "soft" | "strong" | "full";
  width?: number;
  /** Background use: heavy blur (desktop frame backdrop). */
  blur?: number;
  children?: ReactNode;
  recyclingKey?: string;
  /** Large headers only: the photo drifts slowly (a quiet Ken Burns), never with reduced motion. */
  drift?: boolean;
  /** The frame's colours while loading (or when the photo cannot load): a universe's own, e.g. IRLY Girl's pinks. */
  tint?: { base: string; pulse: string };
  /** Always the key's first picture (the Dubai photo of a Dubai key), never another photo of the subject. */
  pinned?: boolean;
};

const SCRIMS = {
  soft: { colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"] as const, start: 0.45 },
  strong: {
    colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.78)"] as const,
    start: 0.25,
  },
  full: { colors: ["rgba(0,0,0,0.3)", "rgba(0,0,0,0.84)"] as const, start: 0 },
};

/**
 * A real photograph. While it loads, the frame is a skeleton with the
 * exact geometry of the photo: grey with a soft breathing pulse. The photo
 * then arrives blur-to-sharp (a soft cross-dissolve) and is cached on disk
 * for next time.
 */
export const Photo = memo(function Photo({
  visual,
  light,
  style,
  scrim = "none",
  width = 900,
  blur,
  children,
  recyclingKey,
  drift,
  tint,
  pinned,
}: Props) {
  // loading: breathing placeholder · done: photo shown, or the plain
  // destination colours if the network refused it (no endless pulse).
  const [status, setStatus] = useState<"loading" | "done">("loading");
  // Chosen once per place on screen (never on every render): this place keeps
  // its photo, the next place showing the same subject gets another one.
  const stockUrl = useMemo(() => photoUrl(visual.photo, width, recyclingKey, pinned), [visual.photo, width, recyclingKey, pinned]);
  // A cover link that fails (expired, file gone) falls back to the stock
  // photo once, instead of leaving a grey box.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri = visual.uri && visual.uri !== failedUri ? visual.uri : stockUrl;
  const t = useTheme();
  const night = t.mode === "night";
  void light;
  const pulse = useSharedValue(0);
  const loading = status === "loading";

  useEffect(() => {
    if (!loading) {
      cancelAnimation(pulse);
      return;
    }
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [loading, pulse]);

  const reduced = useReducedMotion();
  const move = useSharedValue(0);
  const drifting = Boolean(drift) && !reduced && !loading;
  useEffect(() => {
    if (!drifting) return;
    move.set(
      withRepeat(
        withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(move);
  }, [drifting, move]);
  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.02 + move.get() * 0.07 },
      { translateX: (move.get() - 0.5) * 14 },
      { translateY: (0.5 - move.get()) * 8 },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: loading ? 0.18 + pulse.get() * 0.22 : 0,
  }));
  const sc = scrim !== "none" ? SCRIMS[scrim] : null;

  return (
    <View style={[styles.root, style]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint?.base ?? (night ? "#15171B" : "#E4E4E1") },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint?.pulse ?? (night ? "#20232A" : "#F4F4F2") },
          pulseStyle,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, drift && !reduced ? driftStyle : null]}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={{ duration: 520, effect: "cross-dissolve" }}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          blurRadius={blur}
          onLoad={() => setStatus("done")}
          onError={() => {
            if (visual.uri && uri === visual.uri) setFailedUri(visual.uri);
            else setStatus("done");
          }}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      {sc ? (
        <LinearGradient
          colors={sc.colors}
          start={{ x: 0, y: sc.start }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
});
