import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { CharCount } from '@/components/ui/CharCount';
import { Field } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { a11y, t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CommunityDetail } from './data';
import { RULES_MAX, updateCommunityInfo, useCommunityRules } from './space';

const NAME_MIN = 3;
const NAME_MAX = 60;
const TAGLINE_MAX = 80;
const ABOUT_MAX = 600;

/**
 * « Manage → Settings »: the community's name, tagline, description and
 * rules (the owner, or a co-admin with `settings`). Official communities
 * keep their name; the server decides and writes the journal.
 */
export function SettingsSection({ c }: { c: CommunityDetail | null }) {
  const { rules, loading } = useCommunityRules(c?.id ?? '');
  if (!c || loading) {
    return (
      <View style={[styles.pad, { gap: 12 }]}>
        <Skeleton height={52} radius={radius.md} />
        <Skeleton height={52} radius={radius.md} />
        <Skeleton height={120} radius={radius.md} />
        <Skeleton height={160} radius={radius.md} />
      </View>
    );
  }
  // The form starts from what the server has, once (a reload while typing keeps what is typed).
  return <SettingsForm key={c.id} c={c} rules={rules} />;
}

function SettingsForm({ c, rules }: { c: CommunityDetail; rules: string | null }) {
  const t = useTheme();
  const [form, setForm] = useState({ name: c.name, tagline: c.tagline ?? '', description: c.description ?? '', rules: rules ?? '' });
  const [busy, setBusy] = useState(false);
  const name = form.name.trim();
  const changed = {
    name: !c.official && name !== c.name,
    tagline: form.tagline.trim() !== (c.tagline ?? ''),
    description: form.description.trim() !== (c.description ?? ''),
    rules: form.rules.trim() !== (rules ?? ''),
  };
  const dirty = changed.name || changed.tagline || changed.description || changed.rules;
  const valid = c.official || (name.length >= NAME_MIN && name.length <= NAME_MAX);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (busy || !dirty || !valid) return;
    setBusy(true);
    try {
      await updateCommunityInfo(c.id, {
        name: changed.name ? name : undefined,
        tagline: changed.tagline ? form.tagline : undefined,
        description: changed.description ? form.description : undefined,
        rules: changed.rules ? form.rules : undefined,
      });
      haptic('success');
      toast('Saved', 'check', 'brand');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.pad, { gap: space[4] }]}>
      <View style={{ gap: 6 }}>
        <Text variant="label">Name</Text>
        {c.official ? (
          <View style={styles.locked}>
            <GlassLayer radius={radius.md} />
            <Icon name="lock" size={16} color={t.c.textSecondary} />
            <Text variant="body" style={{ flex: 1 }}>
              {c.name}
            </Text>
          </View>
        ) : (
          <>
            <Field value={form.name} onChangeText={set('name')} maxLength={NAME_MAX} placeholder={tx('Community name')} accessibilityLabel={a11y('Community name')} invalid={name.length > 0 && name.length < NAME_MIN} />
            <CharCount length={name.length} min={NAME_MIN} max={NAME_MAX} />
          </>
        )}
        {c.official ? (
          <Text variant="caption" tone="tertiary">
            IRLY’s own communities keep their name.
          </Text>
        ) : null}
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label">Tagline</Text>
        <Field value={form.tagline} onChangeText={set('tagline')} maxLength={TAGLINE_MAX} placeholder={tx('One line about the community')} accessibilityLabel={a11y('Tagline')} />
        <CharCount length={form.tagline.length} max={TAGLINE_MAX} />
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label">Description</Text>
        <Field value={form.description} onChangeText={set('description')} maxLength={ABOUT_MAX} multiline placeholder={tx('Who it is for, what members do together')} accessibilityLabel={a11y('Description')} />
        <CharCount length={form.description.length} max={ABOUT_MAX} />
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label">Rules</Text>
        <Text variant="caption" tone="tertiary">
          Shown to everyone in « About ». One rule per line works best.
        </Text>
        <Field value={form.rules} onChangeText={set('rules')} maxLength={RULES_MAX} multiline placeholder={tx('Be kind. No ads. Plans happen in public places first.')} accessibilityLabel={a11y('Rules')} style={{ minHeight: 140 }} />
        <CharCount length={form.rules.length} max={RULES_MAX} />
      </View>
      <Button label="Save" icon="check" full loading={busy} disabled={!dirty || !valid} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14, borderRadius: radius.md, overflow: 'hidden' },
});
