import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { isAvatar } from '@/features/avatar/avatar';
import { IrlyAvatar } from '@/features/avatar/IrlyAvatar';
import { cardPhoto } from '@/features/server/faceRule';
import { useAccountFace } from '@/features/server/faces';
import { forgetLink, fullOfThumb, storedKey, useSignedLinks } from '@/features/server/media';
import { PressableScale } from '@/motion/PressableScale';

type Props = {
  name: string;
  hue: number;
  /** The member's id: her current profile photo, the same one as everywhere else in IRLY. */
  userId?: string | null;
  /** Her own other photos at full size (IRLY Girl photos, the profile photo's signed link). */
  photos?: string[];
  style?: StyleProp<ViewStyle>;
  /** Behind the photo while it loads, and the neutral placeholder's ground. */
  ground: string;
  /** Initials disc of the neutral placeholder. */
  placeholderSize?: number;
};

const NONE: string[] = [];

/**
 * A member's photo on a big card (Match tiles). The same choice as every
 * avatar (her profile photo first, then her own other photos, else a neutral
 * placeholder with her initials, never someone else's picture), but at the
 * right size: the 256 px copy avatars use shows at once, and the full photo
 * (≤1600 px) dissolves in over it, so a tile is never an enlarged thumbnail.
 * Cached on the phone under the stored file's path. A photo that cannot load
 * leaves the placeholder with a small "Try again".
 */
export const ProfilePhoto = memo(function ProfilePhoto({ name, hue, userId, photos, style, ground, placeholderSize = 72 }: Props) {
  const face = useAccountFace(userId);
  const chosen = cardPhoto(face, photos);
  const fromFace = Boolean(face && chosen === face.uri);
  // The profile photo's full file, next to its small copy.
  const fullPath = fromFace ? fullOfThumb(face?.key) : undefined;
  const asked = useMemo(() => (fullPath ? [fullPath] : NONE), [fullPath]);
  const links = useSignedLinks('profile-photos', asked);
  const full = fullPath ? links[fullPath] : undefined;
  // Small copy underneath (instant), full photo on top; without a small copy the chosen photo is the full one.
  const low = fromFace && fullPath ? chosen : undefined;
  const high = fromFace && fullPath ? full : chosen;
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [attempt, setAttempt] = useState(0);
  const lowOk = low && !failed[low] ? low : undefined;
  const highOk = high && !failed[high] ? high : undefined;
  const drawing = chosen && isAvatar(chosen) ? chosen : undefined;
  const broken = !drawing && Boolean(chosen) && !lowOk && !highOk && !(fromFace && fullPath && !full);

  const retry = () => {
    for (const u of Object.keys(failed)) forgetLink(u);
    setFailed({});
    setAttempt((n) => n + 1);
  };

  return (
    <View style={[styles.fill, { backgroundColor: ground }, style]}>
      {drawing ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <IrlyAvatar config={drawing} size={placeholderSize * 1.8} />
        </View>
      ) : !lowOk && !highOk ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Avatar name={name} hue={hue} size={placeholderSize} />
        </View>
      ) : null}
      {lowOk && !drawing ? (
        <Image
          key={`l${attempt}`}
          source={{ uri: lowOk, cacheKey: face?.key }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={userId ?? undefined}
          onError={() => setFailed((f) => ({ ...f, [lowOk]: true }))}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {highOk && !drawing ? (
        <Image
          key={`h${attempt}`}
          source={{ uri: highOk, cacheKey: (fullPath ? `profile-photos/${fullPath}` : undefined) ?? storedKey(highOk) }}
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
          <Text variant="caption" color="#FFFFFF">
            Try again
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
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
