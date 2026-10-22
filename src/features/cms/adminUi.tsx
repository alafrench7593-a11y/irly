import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { AdminInput } from '@/features/admin/ui';
import { a11y, t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { pickCmsPhoto, uploadCmsFile, type NewsState, type UploadStep } from './api';
import { isDestination } from './destinations';
import type { CmsAudience } from './feed';
import { useCmsVisuals } from './ui';

/**
 * Form pieces shared by the editorial screens of the back office (news,
 * Home layout, banners). Words the team types are kept as typed.
 */
export const AUDIENCE_LABEL: Record<CmsAudience, string> = { mixte: 'IRLY (Mixte)', girl: 'IRLY Girl only', both: 'IRLY and IRLY Girl' };
export const STATE_LABEL: Record<NewsState, string> = { draft: 'Draft', scheduled: 'Scheduled', published: 'Published', unpublished: 'Unpublished' };
const STATE_TONE: Record<NewsState, 'secondary' | 'accent' | 'positive' | 'live'> = { draft: 'secondary', scheduled: 'accent', published: 'positive', unpublished: 'live' };

/** IRLY's own photos offered first (the owner's: src/data/photos OWN), before any upload. */
export const OWN_PICKS = ['palmAerial', 'dubaiPink', 'beachMix', 'dinnerMix', 'meetingMix', 'padelMix', 'girlsOut', 'brunchGirl', 'newcomerGirl', 'nightDinner'];

export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.toggle}>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel={a11y(label)} />
      <Text variant="bodyS" tone={disabled ? 'tertiary' : 'primary'} style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function Choice<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | null | undefined; onChange: (v: T) => void; labels: Record<T, string> }) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Chip key={o} size="sm" label={labels[o]} selected={value === o} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

export function NewsStatePill({ state, at }: { state: NewsState; at?: string | null }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.c.overlay }]} testID={`news-state-${state}`}>
      <Text variant="caption" tone={STATE_TONE[state]} raw>
        {state === 'scheduled' && at ? tx('Scheduled for {d}', { d: new Date(at).toLocaleString() }) : tx(STATE_LABEL[state])}
      </Text>
    </View>
  );
}

/** Up / down: the order members see. */
export function MoveButtons({ onUp, onDown, disabled, label }: { onUp?: () => void; onDown?: () => void; disabled?: boolean; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.moves}>
      <PressableScale haptic="select" onPress={onUp} disabled={disabled || !onUp} accessibilityRole="button" accessibilityLabel={tx('Move {name} up', { name: label })} style={[styles.move, { backgroundColor: t.c.overlay, opacity: onUp ? 1 : 0.35 }]}>
        <Icon name="chevronUp" size={16} color={t.c.text} />
      </PressableScale>
      <PressableScale haptic="select" onPress={onDown} disabled={disabled || !onDown} accessibilityRole="button" accessibilityLabel={tx('Move {name} down', { name: label })} style={[styles.move, { backgroundColor: t.c.overlay, opacity: onDown ? 1 : 0.35 }]}>
        <Icon name="chevronDown" size={16} color={t.c.text} />
      </PressableScale>
    </View>
  );
}

/** A link field that says at once whether the link can be used. */
export function DestinationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ok = isDestination(value.trim());
  return (
    <View style={{ gap: 4 }}>
      <AdminInput value={value} onChange={onChange} placeholder="Where it leads: /discover, /category/beach or https://…" label="Button link" max={500} autoCapitalize="none" />
      {value.trim() && !ok ? (
        <Text variant="caption" tone="live">
          This link cannot be used: pick a screen of the app or an https address
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One photo slot: IRLY's own photos first, or a photo from the device
 * (cropped where the picker allows it), uploaded as this item's own new file.
 */
export function PhotoSlot({ path, photoKey, fallback, onChange, height = 150 }: {
  path: string | null;
  photoKey: string | null;
  fallback: string;
  onChange: (next: { path: string | null; key: string | null }) => void;
  height?: number;
}) {
  const t = useTheme();
  const [step, setStep] = useState<UploadStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<{ for: string; uri: string } | null>(null);
  const [visual] = useCmsVisuals([{ path, key: photoKey, fallback }]);
  const pick = async () => {
    setError(null);
    const uri = await pickCmsPhoto().catch(() => null);
    if (!uri) return;
    try {
      const stored = await uploadCmsFile(uri, 'photo', setStep);
      setLocal({ for: stored, uri });
      onChange({ path: stored, key: photoKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the file');
    } finally {
      setStep(null);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {local && local.for === path ? (
        <Image source={{ uri: local.uri }} style={[styles.preview, { height, backgroundColor: t.c.overlay }]} contentFit="cover" accessibilityLabel={tx('New photo')} />
      ) : (
        <Photo visual={visual} light="dubai" width={900} pinned style={[styles.preview, { height }]} />
      )}
      <View style={styles.wrap}>
        <Button size="sm" icon="image" label={path ? 'Replace the photo' : 'Choose a photo'} variant="secondary" loading={step !== null} onPress={() => void pick()} />
        {path ? <Button size="sm" icon="x" label="Use an IRLY photo instead" variant="ghost" onPress={() => onChange({ path: null, key: photoKey })} /> : null}
      </View>
      {step ? (
        <Text variant="caption" tone="secondary">
          {step === 'checking' ? 'Checking the photo…' : 'Sending the photo…'}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" tone="live">
          {tx(error)}
        </Text>
      ) : null}
      {!path ? (
        <View style={styles.wrap}>
          {OWN_PICKS.map((k) => (
            <OwnPick key={k} photoKey={k} selected={(photoKey ?? fallback) === k} onPress={() => onChange({ path: null, key: k })} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OwnPick({ photoKey, selected, onPress }: { photoKey: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const [visual] = useCmsVisuals([{ path: null, key: photoKey, fallback: photoKey }]);
  return (
    <PressableScale haptic="select" onPress={onPress} accessibilityRole="button" accessibilityLabel={tx('IRLY photo')} accessibilityState={{ selected }} style={[styles.own, { borderColor: selected ? t.c.brand : 'transparent' }]}>
      <Photo visual={visual} light="dubai" width={200} pinned style={styles.ownImg} />
    </PressableScale>
  );
}

/** What went wrong, kept on screen next to the buttons (the draft stays as typed). */
export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Text variant="bodyS" tone="live" testID="cms-error">
      {tx(error)}
    </Text>
  );
}

/** A date and time typed as « 2026-11-02 18:30 » (this phone's time), or null when empty or unreadable. */
export function parseLocal(v: string): Date | null {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}
export const formatLocal = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  moves: { flexDirection: 'row', gap: 6 },
  move: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  own: { borderWidth: 2, borderRadius: radius.md + 2, padding: 1 },
  ownImg: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden' },
});
