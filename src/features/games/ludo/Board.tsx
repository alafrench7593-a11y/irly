import { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { t as tx } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import type { LudoState } from '../api';
import { homeColumnCells, LUDO_COLORS, SAFE, TRACK, tokenCell, YARD_ORIGIN } from './geometry';

type Props = {
  state: LudoState;
  size: number;
  /** Tokens of the player on this phone that may move now (index into its four). */
  movable: number[];
  /** The player on this phone (index in state.players), or -1 when watching. */
  me: number;
  onMove: (token: number) => void;
};

/** The board, drawn once per size; the tokens move on top of it. */
export const LudoBoard = memo(function LudoBoard({ state, size, movable, me, onMove }: Props) {
  const cell = size / 15;
  return (
    <View style={{ width: size, height: size }}>
      <BoardArt size={size} />
      {state.players.map((_, idx) =>
        state.out[idx]
          ? null
          : state.tokens[idx].map((p, k) => {
              const at = tokenCell(state.colors[idx], p, k);
              // Tokens sharing a square are fanned out a little so each stays visible.
              const twins = sharing(state, idx, k);
              return (
                <Token
                  key={`${idx}-${k}`}
                  x={(at.x + twins.dx) * cell}
                  y={(at.y + twins.dy) * cell}
                  r={cell * (p >= 56 ? 0.28 : 0.36)}
                  color={LUDO_COLORS[state.colors[idx]]}
                  active={idx === me && movable.includes(k)}
                  onPress={() => onMove(k)}
                  label={tx('Token {n}', { n: k + 1 })}
                />
              );
            }),
      )}
    </View>
  );
});

function sharing(state: LudoState, idx: number, k: number) {
  const here = tokenCell(state.colors[idx], state.tokens[idx][k], k);
  const same: string[] = [];
  state.players.forEach((_, j) => {
    if (state.out[j]) return;
    state.tokens[j].forEach((p, t) => {
      if (p < 0 || p >= 56) return;
      const c = tokenCell(state.colors[j], p, t);
      if (c.x === here.x && c.y === here.y) same.push(`${j}-${t}`);
    });
  });
  const i = same.indexOf(`${idx}-${k}`);
  if (same.length < 2 || i < 0) return { dx: 0, dy: 0 };
  const angle = (i / same.length) * Math.PI * 2;
  return { dx: Math.cos(angle) * 0.2, dy: Math.sin(angle) * 0.2 };
}

const BoardArt = memo(function BoardArt({ size }: { size: number }) {
  const t = useTheme();
  const c = size / 15;
  const track = t.isDay ? '#FFFFFF' : '#1C1C1F';
  const line = t.isDay ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const startOf = (color: number) => TRACK[color * 13];
  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} rx={c * 0.8} fill={t.isDay ? '#EDEDEA' : '#0E0E10'} />
      {/* Yards */}
      {YARD_ORIGIN.map((o, color) => (
        <G key={`yard-${color}`}>
          <Rect x={o.x * c + c * 0.25} y={o.y * c + c * 0.25} width={c * 5.5} height={c * 5.5} rx={c * 0.9} fill={LUDO_COLORS[color]} opacity={0.9} />
          <Rect x={o.x * c + c * 1} y={o.y * c + c * 1} width={c * 4} height={c * 4} rx={c * 0.6} fill={track} />
          {[
            [2, 2],
            [4, 2],
            [2, 4],
            [4, 4],
          ].map(([x, y]) => (
            <Circle key={`${x}${y}`} cx={(o.x + x) * c} cy={(o.y + y) * c} r={c * 0.42} fill={LUDO_COLORS[color]} opacity={0.22} />
          ))}
        </G>
      ))}
      {/* Track */}
      {TRACK.map((sq, i) => (
        <Rect key={`t-${i}`} x={sq.x * c + 0.5} y={sq.y * c + 0.5} width={c - 1} height={c - 1} rx={c * 0.18} fill={track} stroke={line} strokeWidth={0.6} />
      ))}
      {/* Start squares in their colour, stars on the safe ones */}
      {[0, 1, 2, 3].map((color) => {
        const s = startOf(color);
        return <Rect key={`s-${color}`} x={s.x * c + 0.5} y={s.y * c + 0.5} width={c - 1} height={c - 1} rx={c * 0.18} fill={LUDO_COLORS[color]} opacity={0.85} />;
      })}
      {[...SAFE]
        .filter((i) => i % 13 !== 0)
        .map((i) => {
          const s = TRACK[i];
          return <Path key={`star-${i}`} d={star((s.x + 0.5) * c, (s.y + 0.5) * c, c * 0.3, c * 0.13)} fill={t.isDay ? '#B8B8B2' : '#5A5A60'} />;
        })}
      {/* Home columns */}
      {[0, 1, 2, 3].map((color) =>
        homeColumnCells(color).map((sq, i) => (
          <Rect key={`h-${color}-${i}`} x={sq.x * c + 0.5} y={sq.y * c + 0.5} width={c - 1} height={c - 1} rx={c * 0.18} fill={LUDO_COLORS[color]} opacity={0.75} />
        )),
      )}
      {/* Home: four triangles meeting in the centre */}
      <Polygon points={`${6 * c},${6 * c} ${7.5 * c},${7.5 * c} ${6 * c},${9 * c}`} fill={LUDO_COLORS[0]} />
      <Polygon points={`${6 * c},${6 * c} ${9 * c},${6 * c} ${7.5 * c},${7.5 * c}`} fill={LUDO_COLORS[1]} />
      <Polygon points={`${9 * c},${6 * c} ${9 * c},${9 * c} ${7.5 * c},${7.5 * c}`} fill={LUDO_COLORS[2]} />
      <Polygon points={`${6 * c},${9 * c} ${7.5 * c},${7.5 * c} ${9 * c},${9 * c}`} fill={LUDO_COLORS[3]} />
    </Svg>
  );
});

function star(cx: number, cy: number, outer: number, inner: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }
  return `${d}Z`;
}

const Token = memo(function Token({ x, y, r, color, active, onPress, label }: { x: number; y: number; r: number; color: string; active: boolean; onPress: () => void; label: string }) {
  const reduced = useReducedMotion();
  const px = useSharedValue(x);
  const py = useSharedValue(y);
  const pulse = useSharedValue(1);
  useEffect(() => {
    px.set(reduced ? x : withSpring(x, { damping: 18, stiffness: 180 }));
    py.set(reduced ? y : withSpring(y, { damping: 18, stiffness: 180 }));
  }, [x, y, px, py, reduced]);
  useEffect(() => {
    pulse.set(active && !reduced ? withRepeat(withSequence(withTiming(1.18, { duration: 420 }), withTiming(1, { duration: 420 })), -1) : withTiming(1, { duration: 120 }));
  }, [active, pulse, reduced]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: px.get() - r }, { translateY: py.get() - r }, { scale: pulse.get() }],
  }));
  const ring = useMemo(() => ({ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: color }), [r, color]);
  return (
    <Animated.View style={[styles.token, style, active && styles.activeLayer]} pointerEvents={active ? 'auto' : 'none'}>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} disabled={!active}>
        <View style={[styles.disc, ring, active && styles.activeDisc]}>
          <View style={[styles.shine, { width: r * 0.9, height: r * 0.9, borderRadius: r }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  token: { position: 'absolute', left: 0, top: 0 },
  activeLayer: { zIndex: 2 },
  disc: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  activeDisc: { borderColor: '#FFFFFF', borderWidth: 3.5 },
  shine: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
