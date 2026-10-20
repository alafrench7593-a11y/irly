import { memo, useState } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { surprise } from '@/features/create/photoLibrary';
import { PhotoLibrarySheet } from '@/features/create/PhotoLibrarySheet';
import { pickPhoto } from '@/features/server/covers';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';

/** The IRLY library offered next to the upload (an activity's host): the type's photos and how to save one. */
export type CoverLibrary = {
  urls: readonly string[];
  /** The type shown in the sheet ("Padel session"). */
  title?: string;
  /** The photo shown now (a library link), checked in the grid and never drawn again by « Surprise me ». */
  current?: string | null;
  choose: (url: string) => Promise<void>;
};

/**
 * Glass controls laid on a cover photo: "Change the photo" (pick, upload,
 * save) and, when a photo of its own is set, a reset to the app's photo.
 * With `library`, the IRLY library too (the grid, and « Surprise me »), as
 * when the activity was created. The server decides who may change it; a
 * refusal is shown as is.
 */
export const CoverEditor = memo(function CoverEditor({
  hasOwn,
  save,
  onChanged,
  staff,
  library,
  style,
}: {
  hasOwn: boolean;
  /** Saves a picked image (uri) or null to go back to the app's photo. */
  save: (uri: string | null) => Promise<void>;
  onChanged: () => void;
  /** Shown as "IRLY team" so the editor knows the change is made as staff. */
  staff?: boolean;
  /** Also the IRLY library (the host of an activity). */
  library?: CoverLibrary;
  style?: StyleProp<ViewStyle>;
}) {
  const [saving, setSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // The library photo saved last from here: « Surprise me » twice never draws it again.
  const [lastDrawn, setLastDrawn] = useState<string | null>(null);
  const change = async (next: 'pick' | 'reset' | { url: string }) => {
    if (saving) return;
    try {
      const picked = next === 'pick' ? await pickPhoto() : null;
      if (next === 'pick' && !picked) return;
      setSaving(true);
      if (typeof next === 'object') {
        await library?.choose(next.url);
        setLastDrawn(next.url);
      } else await save(picked);
      haptic('success');
      toast(next === 'reset' ? 'Back to the IRLY photo' : 'Photo updated', 'check', 'brand');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the photo', 'x', 'live');
    } finally {
      setSaving(false);
    }
  };
  const surpriseMe = () => {
    const url = library ? surprise(library.urls, [library.current, lastDrawn]) : null;
    if (url) change({ url });
  };
  return (
    <Animated.View entering={enter.rise(0, 120)} style={[styles.row, style]}>
      {library && library.urls.length ? (
        <PressableScale haptic="select" scaleTo={0.94} onPress={() => !saving && setLibraryOpen(true)} accessibilityLabel="IRLY library">
          <Glass dark level="regular" style={styles.pill}>
            <Icon name="image" size={16} color="#FFFFFF" />
            <Text variant="label" color="#FFFFFF">
              IRLY library
            </Text>
          </Glass>
        </PressableScale>
      ) : null}
      <PressableScale haptic="select" scaleTo={0.94} onPress={() => change('pick')} accessibilityLabel={library ? 'My photos' : 'Change the photo'}>
        <Glass dark level="regular" style={styles.pill}>
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon name="camera" size={16} color="#FFFFFF" />}
          <Text variant="label" color="#FFFFFF">
            {library ? 'My photos' : staff ? 'Change the photo (IRLY team)' : 'Change the photo'}
          </Text>
        </Glass>
      </PressableScale>
      {library && library.urls.length > 1 ? (
        <PressableScale haptic="select" scaleTo={0.9} onPress={surpriseMe} accessibilityLabel="Surprise me">
          <Glass dark level="regular" style={[styles.pill, styles.round]}>
            <Icon name="sparkles" size={16} color="#FFFFFF" />
          </Glass>
        </PressableScale>
      ) : null}
      {hasOwn ? (
        <PressableScale haptic="select" scaleTo={0.9} onPress={() => change('reset')} accessibilityLabel="Use the IRLY photo">
          <Glass dark level="regular" style={[styles.pill, styles.round]}>
            <Icon name="repeat" size={16} color="#FFFFFF" />
          </Glass>
        </PressableScale>
      ) : null}
      {library ? (
        <PhotoLibrarySheet
          visible={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          urls={library.urls}
          selected={library.current ?? null}
          title={library.title}
          onPick={(url) => {
            setLibraryOpen(false);
            if (url !== library.current) change({ url });
          }}
        />
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 36, borderRadius: 18, overflow: 'hidden' },
  round: { width: 36, paddingHorizontal: 0, justifyContent: 'center' },
});

/** Where the editor sits on a cover: bottom left, over the scrim. */
export const coverEditorSlot: ViewStyle = { position: 'absolute', left: 12, bottom: 12 };
