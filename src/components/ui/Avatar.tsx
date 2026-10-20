import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { isAvatar } from '@/features/avatar/avatar';
import { cardPhoto, shownPhoto } from '@/features/server/faceRule';
import { useAccountFace } from '@/features/server/faces';
import { forgetLink, fullOfThumb, useSignedLinks } from '@/features/server/media';
import { PressableScale } from '@/motion/PressableScale';
import { IrlyAvatar } from '@/features/avatar/IrlyAvatar';
import { initials } from '@/lib/format';
import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from './Icon';
import { Text as UIText } from './Text';

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
  /** A real photo (member's profile picture), or an IRLY avatar string (`irly-avatar:v1:...`). */
  photo?: string;
  /**
   * The member's id: their current profile photo is fetched (shared, kept in
   * sync) and wins over `photo`. For a real account, `photo` is only shown
   * while the face is still unknown: once the server says she has no photo,
   * the initials are shown, never a photo from somewhere else.
   */
  userId?: string | null;
};

/**
 * Avatars: initials on a grey disc (v3 is black and white; the hue only
 * shifts the grey by a hair so neighbours stay distinguishable). A photo,
 * when there is one, covers the initials. Real members show their own
 * photo; example portraits exist only in the demonstration build.
 */
export const Avatar = memo(function Avatar({ name, hue, size = 44, online, verified, ring, photo: given, userId }: Props) {
  const face = useAccountFace(userId);
  const photo = shownPhoto(userId, face, given);
  // Cached on the phone under the file's stored path, not its signed link (which changes).
  const cacheKey = face && face.uri === photo ? face.key : undefined;
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
        {photo && isAvatar(photo) ? (
          <View style={StyleSheet.absoluteFill}>
            <IrlyAvatar config={photo} size={size - ringW * 2} />
          </View>
        ) : photo ? (
          <Image source={{ uri: photo, cacheKey }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} />
        ) : null}
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
          <Avatar name={p.name} hue={p.hue} size={size} ring photo={p.photo} userId={p.id} />
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

type FacePhotoProps = {
  name: string;
  hue: number;
  /** The member's id: her current profile photo, the same one as everywhere else in IRLY. */
  userId?: string | null;
  /** Her own other photos (e.g. IRLY Girl photos), shown when she has no profile photo. */
  photos?: string[];
  style?: StyleProp<ViewStyle>;
  /** Size of the initials disc on the neutral placeholder. */
  placeholderSize?: number;
  /** Background of the neutral placeholder. */
  placeholderColor?: string;
  /**
   * `full` (default, a photo filling a card): the 256 px copy shows at once
   * and the full profile photo (≤1600 px) dissolves in over it, as
   * features/match/ProfilePhoto. `avatar`: the small copy only.
   */
  size?: 'full' | 'avatar';
};

const NO_PATHS: string[] = [];

/**
 * A member's photo filling a card (IRLY Girl deck, match moment): her
 * profile photo first, the same as on every other screen, then her own
 * other photos, else a quiet placeholder with her initials. Never someone
 * else's photo, never a stock picture. A photo that cannot load leaves the
 * placeholder with a small « Try again ».
 */
export const FacePhoto = memo(function FacePhoto({ name, hue, userId, photos, style, placeholderSize = 88, placeholderColor, size = 'full' }: FacePhotoProps) {
  const t = useTheme();
  const face = useAccountFace(userId);
  // A real photo wins over an IRLY avatar: on a big card the drawing is the last resort.
  const uri = cardPhoto(face, photos);
  const fromFace = Boolean(face && face.uri === uri);
  const fullPath = size === 'full' && fromFace ? fullOfThumb(face?.key) : undefined;
  const asked = useMemo(() => (fullPath ? [fullPath] : NO_PATHS), [fullPath]);
  const links = useSignedLinks('profile-photos', asked);
  const full = fullPath ? links[fullPath] : undefined;
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [attempt, setAttempt] = useState(0);
  const drawing = uri && isAvatar(uri) ? uri : undefined;
  const lowOk = uri && !drawing && !failed[uri] ? uri : undefined;
  const highOk = full && !failed[full] ? full : undefined;
  // Broken: a photo was chosen, nothing of it could load (the full one is not still being signed).
  const broken = Boolean(uri) && !drawing && !lowOk && !highOk && !(fullPath && !full);
  const retry = () => {
    for (const u of Object.keys(failed)) forgetLink(u);
    setFailed({});
    setAttempt((n) => n + 1);
  };
  return (
    <View style={[styles.fill, { backgroundColor: placeholderColor ?? t.c.surface }, style]}>
      {drawing ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <IrlyAvatar config={drawing} size={placeholderSize * 1.8} />
        </View>
      ) : !lowOk && !highOk ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Avatar name={name} hue={hue} size={placeholderSize} />
        </View>
      ) : null}
      {lowOk ? (
        <Image
          key={`l${attempt}`}
          source={{ uri: lowOk, cacheKey: fromFace ? face?.key : undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          recyclingKey={userId ?? undefined}
          onError={() => setFailed((f) => ({ ...f, [lowOk]: true }))}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {highOk ? (
        <Image
          key={`h${attempt}`}
          source={{ uri: highOk, cacheKey: `profile-photos/${fullPath}` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={{ duration: 260, effect: 'cross-dissolve' }}
          recyclingKey={userId ? `${userId}-full` : undefined}
          onError={() => setFailed((f) => ({ ...f, [highOk]: true }))}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {broken ? (
        <PressableScale haptic="tap" scaleTo={0.94} onPress={retry} style={styles.retry} accessibilityRole="button" accessibilityLabel="Try again">
          <Icon name="repeat" size={13} color="#FFFFFF" />
          <UIText variant="caption" color="#FFFFFF">
            Try again
          </UIText>
        </PressableScale>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  fill: { overflow: 'hidden' },
  retry: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(20,12,18,0.55)',
  },
});
