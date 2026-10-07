import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { initials } from '@/lib/format';
import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from './Icon';

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(((h % 360) + 360) % 360)}, ${s}%, ${l}%)`;
}

type Props = {
  name: string;
  hue: number;
  size?: number;
  online?: boolean;
  verified?: boolean;
  /** Draws a ring in the background colour, for stacks and overlaps. */
  ring?: boolean;
  /** A real photo (member's profile picture). */
  photo?: string;
};

/**
 * Avatars: initials on a grey disc (v3 is black and white; the hue only
 * shifts the grey by a hair so neighbours stay distinguishable). A photo,
 * when there is one, covers the initials. Real members show their own
 * photo; example portraits exist only in the demonstration build.
 */
export const Avatar = memo(function Avatar({ name, hue, size = 44, online, verified, ring, photo }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const ringW = ring ? Math.max(2, size * 0.06) : 0;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: ringW,
          borderColor: t.c.bg,
        }}
      >
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: night ? hsl(hue, 12, 20) : hsl(hue, 10, 89) }]}>
          <Text
            allowFontScaling={false}
            style={{ fontFamily: font.heavy, fontSize: size * 0.36, color: night ? 'rgba(255,255,255,0.88)' : '#3A3A3A', letterSpacing: -0.3 }}
          >
            {initials(name)}
          </Text>
        </View>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      {online ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size,
            backgroundColor: t.c.positive,
            borderWidth: Math.max(2, size * 0.05),
            borderColor: t.c.bg,
          }}
        />
      ) : null}
      {verified && size >= 40 ? (
        <View
          style={[
            styles.center,
            {
              position: 'absolute',
              right: -2,
              top: -2,
              width: size * 0.34,
              height: size * 0.34,
              borderRadius: size,
              backgroundColor: t.c.brand,
              borderWidth: 2,
              borderColor: t.c.bg,
            },
          ]}
        >
          <Icon name="check" size={size * 0.18} color={t.c.onBrand} strokeWidth={3} />
        </View>
      ) : null}
    </View>
  );
});

type StackProps = {
  people: { id: string; name: string; hue: number; photo?: string }[];
  size?: number;
  max?: number;
  extra?: number;
};

export const AvatarStack = memo(function AvatarStack({ people, size = 26, max = 4, extra = 0 }: StackProps) {
  const t = useTheme();
  const shown = people.slice(0, max);
  const rest = people.length - shown.length + extra;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: max - i }}>
          <Avatar name={p.name} hue={p.hue} size={size} ring photo={p.photo} />
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={[
            styles.center,
            {
              marginLeft: shown.length ? -size * 0.32 : 0,
              height: size,
              minWidth: size,
              paddingHorizontal: 6,
              borderRadius: size,
              backgroundColor: t.c.overlay,
              borderWidth: Math.max(2, size * 0.06),
              borderColor: t.c.bg,
            },
          ]}
        >
          <Text allowFontScaling={false} style={{ fontFamily: font.bold, fontSize: size * 0.38, color: t.c.textSecondary }}>
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
