import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { duration } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import { GlassLayer } from './GlassLayer';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { toast } from './Toast';

export type PickedPhoto = ImagePicker.ImagePickerAsset;
export type PhotoSource = 'library' | 'camera';

export type PhotoSourceOptions = {
  /** Crop frame offered after picking ([4, 5] a portrait, [16, 10] a cover, [1, 1] a face). */
  aspect?: [number, number];
  /** Offer the system crop (on by default when an aspect is given). */
  allowsEditing?: boolean;
  /** The picker's own JPEG quality, never below 0.9 (see pickerOptions). */
  quality?: number;
  /** The camera opens on the front lens (a profile photo, a selfie). */
  front?: boolean;
  title?: string;
  subtitle?: string;
};

/**
 * The camera needs its permission text in the native build (app config,
 * `expo-image-picker` plugin). Never offered on the web: browsers only
 * open the file chooser there, the same as "Choose from library".
 */
export function cameraSupported(): boolean {
  if (Platform.OS === 'web') return false;
  const plugins = (Constants.expoConfig?.plugins ?? []) as unknown[];
  const picker = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, { cameraPermission?: unknown }] | undefined;
  return picker?.[1]?.cameraPermission !== false;
}

/**
 * Every picked photo is encoded once more before upload (prepareImage: 1600 px,
 * 0.85), so the picker itself keeps nearly all of it: a 0.8 here, then 0.85,
 * visibly bands skin tones and skies. Orientation is fixed by that step too.
 */
const pickerOptions = (o: PhotoSourceOptions): ImagePicker.ImagePickerOptions => ({
  mediaTypes: ['images'],
  quality: Math.max(0.9, o.quality ?? 1),
  allowsEditing: o.allowsEditing ?? Boolean(o.aspect),
  ...(o.aspect ? { aspect: o.aspect } : {}),
});

const permissionError = (e: unknown) => /permission|denied|not granted|unauthori[sz]ed/i.test(e instanceof Error ? e.message : String(e));

type SheetProps = {
  visible: boolean;
  /** Closed without a photo (Cancel, backdrop, swipe down). */
  onClose: () => void;
  /** The member chose where the photo comes from (the sheet is closing). */
  onSource: (source: PhotoSource) => void;
  /** Camera access refused for good: the sheet explains and offers Settings. */
  denied?: PhotoSource | null;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
};

/**
 * Where a photo comes from: the library, the camera (native only, after
 * its permission), or nothing. A pane of the shared glass, so it is rose in
 * IRLY Girl and neutral in Mixte; each option springs in and presses down.
 * Use it through usePhotoSource(), which also runs the system pickers.
 */
export const PhotoSourceSheet = memo(function PhotoSourceSheet({
  visible,
  onClose,
  onSource,
  denied,
  onBack,
  title = 'Add a photo',
  subtitle = 'Clear, friendly, recent.',
}: SheetProps) {
  const t = useTheme();
  const camera = cameraSupported();
  const options: { id: PhotoSource; icon: IconName; label: string; hint: string }[] = [
    { id: 'library', icon: 'image', label: 'Choose from library', hint: Platform.OS === 'web' ? 'A photo from this device' : 'From your photos' },
    ...(camera ? [{ id: 'camera' as const, icon: 'camera' as const, label: 'Take a photo', hint: 'Opens the camera' }] : []),
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={denied ? undefined : title} subtitle={denied ? undefined : subtitle}>
      {denied ? (
        <Animated.View key="denied" entering={enter.fade()} style={styles.denied}>
          <View style={[styles.badge, { backgroundColor: t.c.brandSoft }]}>
            <Icon name={denied === 'camera' ? 'camera' : 'image'} size={22} color={t.c.brand} />
          </View>
          <Text variant="titleM" align="center">
            {denied === 'camera' ? 'Camera access is off' : 'Photo access is off'}
          </Text>
          <Text variant="body" tone="secondary" align="center">
            {denied === 'camera'
              ? 'IRLY only uses the camera when you take a photo. Turn it on in Settings, then come back.'
              : 'IRLY only sees the photos you choose. Turn access on in Settings, then come back.'}
          </Text>
          <View style={styles.actions}>
            <Button label="Open Settings" icon="settings" full onPress={() => Linking.openSettings().catch(() => toast('Open Settings from your home screen', 'settings', 'brand'))} />
            <Button label="Back" variant="secondary" full haptic="tap" onPress={onBack ?? onClose} />
          </View>
        </Animated.View>
      ) : (
        <View key="choices" style={styles.list}>
          {options.map((o, i) => (
            <Animated.View key={o.id} entering={enter.rise(i, 40)}>
              <PressableScale haptic="select" scaleTo={0.97} onPress={() => onSource(o.id)} accessibilityLabel={o.label} style={styles.row}>
                <GlassLayer radius={radius.lg} level="regular" />
                <View style={[styles.badge, { backgroundColor: t.c.brandSoft }]}>
                  <Icon name={o.icon} size={20} color={t.c.brand} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="titleS">{o.label}</Text>
                  <Text variant="bodyS" tone="secondary">
                    {o.hint}
                  </Text>
                </View>
                <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
              </PressableScale>
            </Animated.View>
          ))}
          <Animated.View entering={enter.rise(options.length, 40)} style={{ marginTop: space[2] }}>
            <Button label="Cancel" variant="ghost" full haptic="tap" onPress={onClose} />
          </Animated.View>
        </View>
      )}
    </Sheet>
  );
});

/**
 * Opens the photo source sheet and resolves with the picked photo, or null
 * when the member cancels (anywhere: the sheet, the system picker). Errors
 * are said in a toast and resolve null too. Render `sheet` once in the screen.
 *
 *   const photos = usePhotoSource({ aspect: [4, 5] });
 *   const asset = await photos.pick();
 *   …
 *   {photos.sheet}
 */
export function usePhotoSource(defaults: PhotoSourceOptions = {}): {
  pick: (options?: PhotoSourceOptions) => Promise<PickedPhoto | null>;
  sheet: ReactElement;
  open: boolean;
} {
  // Callers pass a fresh object each render: compared by value.
  const defaultsKey = JSON.stringify(defaults);
  const base = useMemo(() => JSON.parse(defaultsKey) as PhotoSourceOptions, [defaultsKey]);
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState<PhotoSource | null>(null);
  const [current, setCurrent] = useState<PhotoSourceOptions>(defaults);
  const waiting = useRef<((p: PickedPhoto | null) => void) | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      waiting.current?.(null);
      waiting.current = null;
    },
    [],
  );

  const settle = useCallback((p: PickedPhoto | null) => {
    const done = waiting.current;
    waiting.current = null;
    done?.(p);
  }, []);

  const pick = useCallback(
    (options?: PhotoSourceOptions) => {
      // A second tap while the sheet is open gets the same answer as the first.
      settle(null);
      setCurrent({ ...base, ...options });
      setDenied(null);
      setOpen(true);
      return new Promise<PickedPhoto | null>((resolve) => {
        waiting.current = resolve;
      });
    },
    [settle, base],
  );

  const close = useCallback(() => {
    setOpen(false);
    setDenied(null);
    settle(null);
  }, [settle]);

  const launch = useCallback(
    async (source: PhotoSource) => {
      const o = pickerOptions(current);
      try {
        const res =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ ...o, ...(current.front ? { cameraType: ImagePicker.CameraType.front } : {}) })
            : await ImagePicker.launchImageLibraryAsync(o);
        if (res.canceled || !res.assets?.[0]) return settle(null);
        haptic('select');
        settle(res.assets[0]);
      } catch (e) {
        if (Platform.OS !== 'web' && permissionError(e) && alive.current) {
          // Refused in Settings: the sheet comes back to say so (still waiting for a photo).
          setDenied(source);
          setOpen(true);
          return;
        }
        toast(source === 'camera' ? 'The camera could not open. Try again or choose from your library.' : 'Your photos could not open. Try again.', 'x', 'live');
        settle(null);
      }
    },
    [current, settle],
  );

  const onSource = useCallback(
    async (source: PhotoSource) => {
      if (source === 'camera') {
        // Asked while the sheet is still up: a refusal is explained right there.
        const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
        if (!perm?.granted) {
          haptic('warning');
          if (perm && !perm.canAskAgain) setDenied('camera');
          else toast('Allow camera access to take a photo.', 'camera', 'live');
          return;
        }
      }
      setOpen(false);
      setDenied(null);
      // The web only opens the file chooser during the tap itself; on a phone
      // the system picker waits for the sheet to finish leaving.
      if (Platform.OS === 'web') void launch(source);
      else setTimeout(() => void launch(source), duration.base + 60);
    },
    [launch],
  );

  const sheet = useMemo(
    () => (
      <PhotoSourceSheet
        visible={open}
        onClose={close}
        onSource={onSource}
        denied={denied}
        onBack={() => setDenied(null)}
        title={current.title}
        subtitle={current.subtitle}
      />
    ),
    [open, close, onSource, denied, current.title, current.subtitle],
  );

  return { pick, sheet, open };
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, overflow: 'hidden' },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  denied: { paddingHorizontal: space.gutter, paddingTop: space[5], gap: 10, alignItems: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: space[3] },
});
