import { memo, useState } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { pickPhoto } from '@/features/server/covers';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';

/**
 * Glass controls laid on a cover photo: "Change the photo" (pick, upload,
 * save) and, when a photo of its own is set, a reset to the app's photo.
 * The server decides who may change it; a refusal is shown as is.
 */
export const CoverEditor = memo(function CoverEditor({
  hasOwn,
  save,
  onChanged,
  staff,
  style,
}: {
  hasOwn: boolean;
  /** Saves a picked image (uri) or null to go back to the app's photo. */
  save: (uri: string | null) => Promise<void>;
  onChanged: () => void;
  /** Shown as "IRLY team" so the editor knows the change is made as staff. */
  staff?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [saving, setSaving] = useState(false);
  const change = async (next: 'pick' | 'reset') => {
    if (saving) return;
    try {
      const picked = next === 'pick' ? await pickPhoto() : null;
      if (next === 'pick' && !picked) return;
      setSaving(true);
      await save(picked);
      haptic('success');
      toast(next === 'pick' ? 'Photo updated' : 'Back to the IRLY photo', 'check', 'brand');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the photo', 'x', 'live');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Animated.View entering={enter.rise(0, 120)} style={[styles.row, style]}>
      <PressableScale haptic="select" scaleTo={0.94} onPress={() => change('pick')} accessibilityLabel="Change the photo">
        <Glass dark level="regular" style={styles.pill}>
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon name="camera" size={16} color="#FFFFFF" />}
          <Text variant="label" color="#FFFFFF">
            {staff ? 'Change the photo (IRLY team)' : 'Change the photo'}
          </Text>
        </Glass>
      </PressableScale>
      {hasOwn ? (
        <PressableScale haptic="select" scaleTo={0.9} onPress={() => change('reset')} accessibilityLabel="Use the IRLY photo">
          <Glass dark level="regular" style={[styles.pill, styles.round]}>
            <Icon name="repeat" size={16} color="#FFFFFF" />
          </Glass>
        </PressableScale>
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
