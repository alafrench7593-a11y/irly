import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { AreaPicker } from '@/components/ui/AreaPicker';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useMyPro, type ProDraft } from '@/features/network/api';
import type { ProProfile } from '@/features/network/match';
import { INDUSTRIES, INTENTS, MAX_INDUSTRIES, MAX_SKILLS, ROLES, SKILL_SUGGESTIONS, type IndustryId, type IntentId } from '@/features/network/taxonomy';
import { useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const EMPTY = (cityId: string): ProDraft => ({
  role: 'founder',
  jobTitle: '',
  company: '',
  industries: [],
  skills: [],
  project: '',
  lookingFor: '',
  canOffer: '',
  intents: ['meet'],
  cityId,
  areaId: null,
  visible: true,
});

const draftOf = (p: ProProfile, visible: boolean): ProDraft => ({
  role: p.role,
  jobTitle: p.jobTitle,
  company: p.company ?? '',
  industries: p.industries,
  skills: p.skills,
  project: p.project ?? '',
  lookingFor: p.lookingFor ?? '',
  canOffer: p.canOffer ?? '',
  intents: p.intents,
  cityId: p.cityId,
  areaId: p.areaId,
  visible,
});

/** The "Professional" part of your profile: what Networking shows and matches on. */
export default function ProProfileEditor() {
  const cityId = useCityId();
  const me = useMyPro();
  // The form opens once the saved profile (if any) has loaded, already filled in.
  if (me.signedIn && me.loading) return <Page overline="Networking" title="Professional profile">{null}</Page>;
  return <Editor key={me.pro ? 'edit' : 'new'} me={me} initial={me.pro ? draftOf(me.pro, me.visible) : EMPTY(cityId)} cityId={cityId} />;
}

function Editor({ me, initial, cityId }: { me: ReturnType<typeof useMyPro>; initial: ProDraft; cityId: CityId }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const [d, setD] = useState<ProDraft>(initial);
  const [skill, setSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const set = <K extends keyof ProDraft>(k: K, v: ProDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggleIndustry = (id: IndustryId) => {
    if (d.industries.includes(id)) return set('industries', d.industries.filter((x) => x !== id));
    if (d.industries.length >= MAX_INDUSTRIES) {
      haptic('warning');
      toast(tr('Up to {n} domains', { n: MAX_INDUSTRIES }), 'x', 'live');
      return;
    }
    set('industries', [...d.industries, id]);
  };
  const toggleIntent = (id: IntentId) => set('intents', d.intents.includes(id) ? d.intents.filter((x) => x !== id) : [...d.intents, id]);
  const addSkill = (raw: string) => {
    const s = raw.trim().slice(0, 40);
    if (!s) return;
    if (d.skills.some((x) => x.toLowerCase() === s.toLowerCase())) return setSkill('');
    if (d.skills.length >= MAX_SKILLS) {
      haptic('warning');
      toast(tr('Up to {n} skills', { n: MAX_SKILLS }), 'x', 'live');
      return;
    }
    set('skills', [...d.skills, s]);
    setSkill('');
  };

  const jobError = d.jobTitle.trim().length < 2 ? tr('Add your job title') : null;
  const industryError = d.industries.length ? null : tr('Pick at least one domain');

  const save = async () => {
    setTried(true);
    if (jobError || industryError) {
      haptic('warning');
      return;
    }
    setBusy(true);
    try {
      await me.save({ ...d, cityId: d.cityId in CITIES ? d.cityId : cityId });
      haptic('success');
      toast(tr('Professional profile saved'), 'check', 'brand');
      if (router.canGoBack()) router.back();
      else router.replace('/network');
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Could not save'), 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  if (!me.signedIn) {
    return (
      <Page overline="Networking" title="Professional profile">
        <View style={[styles.box, { backgroundColor: t.c.surface, marginHorizontal: space.gutter }]}>
          <Text variant="body" tone="secondary">
            Sign in to create your professional profile.
          </Text>
          <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }

  const city = CITIES[(d.cityId in CITIES ? d.cityId : cityId) as CityId];

  return (
    <Page overline="Networking" title="Professional profile" subtitle="What you do, what you build, what you look for. Shown in Networking and used for your matches.">
      <View style={styles.form}>
        <Section title="I am">
          <View style={styles.wrap}>
            {ROLES.map((r) => (
              <Chip key={r.id} size="sm" label={r.label} selected={d.role === r.id} onPress={() => set('role', r.id)} />
            ))}
          </View>
        </Section>

        <Section title="Job title" error={tried ? jobError : null}>
          <Field placeholder="Founder & CEO, Product designer…" value={d.jobTitle} onChangeText={(v) => set('jobTitle', v)} maxLength={60} accessibilityLabel={tr('Job title')} />
        </Section>

        <Section title="Company or project name">
          <Field placeholder="Optional" value={d.company} onChangeText={(v) => set('company', v)} maxLength={60} accessibilityLabel={tr('Company')} />
        </Section>

        <Section title={tr('Industry · up to {n}', { n: MAX_INDUSTRIES })} error={tried ? industryError : null}>
          <View style={styles.wrap}>
            {INDUSTRIES.map((i) => (
              <Chip key={i.id} size="sm" label={`${i.emoji} ${tr(i.label)}`} selected={d.industries.includes(i.id)} onPress={() => toggleIndustry(i.id)} />
            ))}
          </View>
        </Section>

        <Section title={tr('Skills · {n}/{max}', { n: d.skills.length, max: MAX_SKILLS })}>
          <Field
            icon="plus"
            placeholder="Add a skill and press enter"
            value={skill}
            onChangeText={setSkill}
            onSubmitEditing={() => addSkill(skill)}
            returnKeyType="done"
            blurOnSubmit={false}
            maxLength={40}
            accessibilityLabel={tr('Add a skill')}
            trailing={
              skill.trim() ? (
                <PressableScale haptic="select" onPress={() => addSkill(skill)} hitSlop={8} accessibilityLabel={tr('Add')}>
                  <Text variant="label">Add</Text>
                </PressableScale>
              ) : null
            }
          />
          {d.skills.length ? (
            <View style={styles.wrap}>
              {d.skills.map((s) => (
                <Animated.View key={s} entering={FadeIn.duration(180)} layout={LinearTransition.springify().dampingRatio(0.9)}>
                  <PressableScale haptic="select" scaleTo={0.95} onPress={() => set('skills', d.skills.filter((x) => x !== s))} style={[styles.skill, { backgroundColor: t.c.text }]} accessibilityLabel={tr('Remove {skill}', { skill: s })}>
                    <Text variant="label" color={t.c.bg} raw>
                      {s}
                    </Text>
                    <Icon name="x" size={14} color={t.c.bg} />
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          ) : null}
          <View style={styles.wrap}>
            {SKILL_SUGGESTIONS.filter((s) => !d.skills.some((x) => x.toLowerCase() === s.toLowerCase()))
              .slice(0, 10)
              .map((s) => (
                <Chip key={s} size="sm" icon="plus" label={s} onPress={() => addSkill(s)} />
              ))}
          </View>
        </Section>

        <Section title="Current project">
          <Field placeholder="An AI assistant for clinics in Dubai…" value={d.project} onChangeText={(v) => set('project', v)} maxLength={200} multiline accessibilityLabel={tr('Current project')} />
        </Section>

        <Section title="What I'm looking for">
          <Field placeholder="A technical cofounder, first clients in hospitality…" value={d.lookingFor} onChangeText={(v) => set('lookingFor', v)} maxLength={200} multiline accessibilityLabel={tr("What I'm looking for")} />
        </Section>

        <Section title="What I can offer">
          <Field placeholder="Growth advice, intros to investors, design reviews…" value={d.canOffer} onChangeText={(v) => set('canOffer', v)} maxLength={200} multiline accessibilityLabel={tr('What I can offer')} />
        </Section>

        <Section title="My networking goals">
          <View style={styles.wrap}>
            {INTENTS.map((i) => (
              <Chip key={i.id} size="sm" label={`${i.emoji} ${tr(i.label)}`} selected={d.intents.includes(i.id)} onPress={() => toggleIntent(i.id)} />
            ))}
          </View>
        </Section>

        <Section title="Where I work from">
          <AreaPicker cityId={city.id} value={d.areaId} onChange={(id) => set('areaId', d.areaId === id ? null : id)} label="Neighbourhood" placeholder="Choose a neighbourhood" />
          <Text variant="caption" tone="tertiary">
            Others see the neighbourhood and an approximate distance, never your position.
          </Text>
        </Section>

        <PressableScale haptic="select" scaleTo={0.98} onPress={() => set('visible', !d.visible)} style={[styles.toggle, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityRole="switch" accessibilityState={{ checked: d.visible }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleS">Show me in Networking</Text>
            <Text variant="caption" tone="tertiary">
              {d.visible ? tr('Professionals of the country can find you') : tr('Hidden: only your connections keep you')}
            </Text>
          </View>
          <View style={[styles.switch, { backgroundColor: d.visible ? t.c.text : t.c.line }]}>
            <Animated.View layout={LinearTransition.springify().dampingRatio(0.8)} style={[styles.knob, { backgroundColor: t.c.bg, alignSelf: d.visible ? 'flex-end' : 'flex-start' }]} />
          </View>
        </PressableScale>

        <Button label={me.pro ? 'Save' : 'Create my professional profile'} icon="check" full loading={busy} onPress={save} />
        {me.pro ? (
          <Button
            label="Delete my professional profile"
            variant="ghost"
            full
            onPress={() =>
              me
                .remove()
                .then(() => {
                  toast(tr('Professional profile deleted'), 'check', 'brand');
                  router.back();
                })
                .catch(() => toast(tr('Could not delete'), 'x', 'live'))
            }
          />
        ) : null}
      </View>
    </Page>
  );
}

function Section({ title, error, children }: { title: string; error?: string | null; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" color={t.c.live}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: space.gutter, gap: space[6] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill },
  box: { padding: 20, gap: 12, borderRadius: radius.xl },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11 },
});
