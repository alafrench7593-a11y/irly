import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { AVATAR_FRAME, decodeAvatar, drawAvatar, type AvatarConfig, type Shape } from './avatar';

type Props = {
  /** A config, or an encoded `irly-avatar:v1:` string. */
  config: AvatarConfig | string;
  size?: number;
};

function paint(s: Shape) {
  return {
    fill: s.fill ?? 'none',
    fillRule: s.evenodd ? ('evenodd' as const) : undefined,
    stroke: s.stroke,
    strokeWidth: s.stroke ? (s.sw ?? 1) : undefined,
    strokeLinecap: s.stroke ? ('round' as const) : undefined,
    strokeLinejoin: s.stroke ? ('round' as const) : undefined,
    opacity: s.op,
  };
}

function render(s: Shape, key: number) {
  const p = paint(s);
  switch (s.t) {
    case 'path':
      return <Path key={key} d={s.d} {...p} />;
    case 'circle':
      return <Circle key={key} cx={s.cx} cy={s.cy} r={s.r} {...p} />;
    case 'ellipse':
      return <Ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...p} />;
    case 'rect':
      return <Rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...p} />;
  }
}

/**
 * An IRLY avatar: flat vector portrait in a circle, drawn from its config.
 * The circle is clipped by the view (no SVG clip ids, so any number of
 * avatars can share a web page). Pure and memoized: it only redraws when
 * the encoded config or the size changes.
 */
export const IrlyAvatar = memo(function IrlyAvatar({ config, size = 44 }: Props) {
  const key = typeof config === 'string' ? config : JSON.stringify(config);
  const shapes = useMemo(() => {
    const c = typeof config === 'string' ? decodeAvatar(config) : config;
    return c ? drawAvatar(c) : null;
    // `key` is the content of `config`: a new object with the same values keeps the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!shapes) return null;
  const [bg, ...figure] = shapes;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {render(bg, -1)}
        <G transform={AVATAR_FRAME}>{figure.map(render)}</G>
      </Svg>
    </View>
  );
});
