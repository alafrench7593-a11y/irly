import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { isContentStaff, replaceAppPhoto, type PhotoStep } from '@/features/admin/api';
import { isPhotoKey, usesOf } from '@/features/admin/photos';
import { AdminInput, adminStyles, Card, day, Fact, NoAccess, useAdminRole } from '@/features/admin/ui';
import { usePhotoOverrideRows } from '@/features/photo/overrides';
import { pickPhoto } from '@/features/server/covers';
import { t as tx } from '@/i18n';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const STEP_LABEL: Record<PhotoStep, string> = { checking: 'Checking the photo…', uploading: 'Uploading…', saving: 'Saving…' };

/**
 * One of IRLY's own photos (a key such as "padel"): where the app shows it,
 * and for content staff, Replace (the team's photo shows instead, for every
 * member, without a new app version) or Restore IRLY's photo. A reason is
 * kept in the moderation log; the old file is deleted once nothing uses it.
 */
export default function AdminAppPhoto() {
  const { key = '' } = useLocalSearchParams<{ key?: string }>();
  const t = useTheme();
  const role = useAdminRole();
  const rows = usePhotoOverrideRows();
  const replaced = rows.find((r) => r.key === key);
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [step, setStep] = useState<PhotoStep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const why = reason.trim();
  const busy = step !== null;
  const editable = isContentStaff(role);

  if (!isPhotoKey(key)) {
    return (
      <Page title="Photo">
        <View style={adminStyles.body}>
          <Text variant="body" tone="secondary">
            This photo does not exist.
          </Text>
        </View>
      </Page>
    );
  }
  if (role === null) {
    return (
      <Page title="Photo">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }

  const uses = usesOf(key);
  const run = async (uri: string | null, done: string) => {
    setFailed(null);
    setStep(uri ? 'checking' : 'saving');
    try {
      await replaceAppPhoto(key, uri, why, setStep);
      toast(done, 'check', 'brand');
      setReason('');
      setPicked(null);
      setConfirmRestore(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not save';
      setFailed(m);
      toast(m, 'x', 'live');
    } finally {
      setStep(null);
    }
  };

  return (
    <Page title={uses[0]?.split(' · ').slice(1).join(' · ') || key} overline={tx('IRLY photo')}>
      <View style={adminStyles.body}>
        <Photo visual={{ photo: key as PhotoKey }} light="dubai" width={900} pinned style={styles.hero} recyclingKey={`admin-sheet-${key}`} />
        <Card>
          <Fact label={tx('Key')} value={key} />
          <Fact label={tx('Now')} value={replaced ? replaced.updated_at ? tx('Replaced by the team on {d}', { d: day(replaced.updated_at) }) : tx('Replaced by the team') : tx('IRLY’s own photo')} />
          {uses.length ? (
            <View style={{ gap: 4 }}>
              <Text variant="caption" tone="tertiary">
                Shown for
              </Text>
              {uses.slice(0, 12).map((u) => (
                <Text key={u} variant="bodyS" raw>
                  {u}
                </Text>
              ))}
              {uses.length > 12 ? (
                <Text variant="caption" tone="tertiary">
                  {tx('and {n} more', { n: uses.length - 12 })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text variant="caption" tone="tertiary">
            Also every activity, community or card that shows this subject without its own photo.
          </Text>
        </Card>

        {editable ? (
          <Card>
            <Text variant="label">Change it</Text>
            <Text variant="caption" tone="secondary">
              The new photo shows for every member at once (phones load it on their next sync), without a new app version. IRLY’s own photo stays available: Restore brings it back.
            </Text>
            {picked ? (
              <View style={{ gap: 8 }}>
                <Text variant="caption" tone="secondary">
                  New photo, not saved yet:
                </Text>
                <Image source={{ uri: picked }} style={[styles.preview, { backgroundColor: t.c.overlay }]} contentFit="cover" accessibilityLabel={tx('New photo')} />
              </View>
            ) : null}
            <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the moderation log)" label="Reason" />
            {step ? (
              <View style={adminStyles.row}>
                <ActivityIndicator color={t.c.text} />
                <Text variant="bodyS" tone="secondary">
                  {STEP_LABEL[step]}
                </Text>
              </View>
            ) : null}
            {failed ? (
              <Text variant="bodyS" tone="live">
                {tx(failed)}
              </Text>
            ) : null}
            {picked ? (
              <View style={adminStyles.row}>
                <Button size="sm" label="Use this photo" icon="check" disabled={why.length < 3 || busy} loading={busy} onPress={() => run(picked, tx('Photo replaced'))} />
                <Button size="sm" label="Cancel" variant="ghost" disabled={busy} onPress={() => setPicked(null)} />
              </View>
            ) : confirmRestore ? (
              <View style={{ gap: 8 }}>
                <Text variant="bodyS">Bring back IRLY’s own photo everywhere?</Text>
                <View style={adminStyles.row}>
                  <Button size="sm" label="Restore IRLY’s photo" icon="repeat" variant="danger" disabled={why.length < 3 || busy} loading={busy} onPress={() => run(null, tx('IRLY’s photo restored'))} />
                  <Button size="sm" label="Cancel" variant="ghost" disabled={busy} onPress={() => setConfirmRestore(false)} />
                </View>
              </View>
            ) : (
              <View style={adminStyles.row}>
                <Button
                  size="sm"
                  label="Replace the photo"
                  icon="image"
                  variant="secondary"
                  disabled={busy}
                  onPress={async () => {
                    setFailed(null);
                    const uri = await pickPhoto().catch(() => null);
                    if (uri) setPicked(uri);
                  }}
                />
                {replaced ? <Button size="sm" label="Restore IRLY’s photo…" variant="ghost" disabled={busy} onPress={() => setConfirmRestore(true)} /> : null}
              </View>
            )}
            {why.length < 3 && (picked || confirmRestore) ? (
              <Text variant="caption" tone="tertiary">
                Give a reason first.
              </Text>
            ) : null}
          </Card>
        ) : (
          <Text variant="bodyS" tone="secondary">
            Only the content team and admins change IRLY’s photos.
          </Text>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', maxWidth: 720, aspectRatio: 16 / 10, borderRadius: radius.xl },
  preview: { width: '100%', maxWidth: 520, aspectRatio: 16 / 10, borderRadius: radius.lg },
});
