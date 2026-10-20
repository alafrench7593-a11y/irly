import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, LinearTransition, useAnimatedRef, useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/navigation/Headers';
import { AreaPicker } from '@/components/ui/AreaPicker';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Ambient } from '@/components/visual/Ambient';
import { confirm } from '@/lib/confirm';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useMyPro, type ProDraft } from '@/features/network/api';
import { FormSection, RoleCard, StepProgress, Tile, useColumns } from '@/features/network/form';
import { LINK_KINDS, MAX_LINK, normaliseLink, NO_LINKS, type LinkKind, type ProLinks } from '@/features/network/links';
import type { ProProfile } from '@/features/network/match';
import {
  GOALS,
  INDUSTRIES,
  INDUSTRY,
  JOB_SUGGESTIONS,
  MAX_INDUSTRIES,
  MAX_SKILLS,
  ROLE_CHOICES,
  ROLE_LABEL,
  roleChoice,
  SKILL_SUGGESTIONS,
  type IndustryId,
  type IntentId,
} from '@/features/network/taxonomy';
import { useT } from '@/i18n';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';

const TITLE = 'Professional profile';
const SUBTITLE = 'What you do, what you build, what you look for. Shown in Networking and used for your matches.';

const STEPS = ['Professional identity', 'Industries & skills', 'Project & goals', 'Links & location', 'Visibility & confirm'];

// New profiles start with no goal: the member picks theirs (the server allows none).
const EMPTY = (cityId: string): ProDraft => ({
  role: 'entrepreneur',
  jobTitle: '',
  company: '',
  industries: [],
  skills: [],
  project: '',
  lookingFor: '',
  canOffer: '',
  intents: [],
  cityId,
  areaId: null,
  visible: true,
});

// Saved as is: an older 'founder' role or 'meet' goal stays until the member changes it.
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
  const t = useTheme();
  // The form opens once the saved profile (if any) has loaded, already filled in.
  if (me.signedIn && me.loading)
    return (
      <Page overline="IRLY Network" title={TITLE}>
        <ActivityIndicator color={t.c.text} style={{ marginTop: 24 }} accessibilityLabel="Loading" />
      </Page>
    );
  // Unread is not "no profile": an empty form saved here would replace the real one.
  if (me.signedIn && me.error && !me.pro)
    return (
      <Page overline="IRLY Network" title={TITLE}>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Text variant="body" tone="secondary">
            Can’t reach IRLY right now
          </Text>
          <Button label="Try again" variant="secondary" onPress={me.reload} />
        </View>
      </Page>
    );
  const initial = me.pro ? draftOf(me.pro, me.visible) : EMPTY(cityId);
  return <Editor key={me.pro ? 'edit' : 'new'} me={me} initial={{ ...initial, links: me.pro ? me.links : NO_LINKS }} cityId={cityId} />;
}

/**
 * Five steps over one draft: going back and forth keeps everything typed.
 * Next checks the step's own required fields; the final button checks them
 * all and opens the first step that needs a fix.
 */
function Editor({ me, initial, cityId }: { me: ReturnType<typeof useMyPro>; initial: ProDraft; cityId: CityId }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const grid = useColumns(150, 8);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const [d, setD] = useState<ProDraft>(initial);
  const [skill, setSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  // Which way the last move went (the next step slides in from that side).
  const [dir, setDir] = useState(1);
  // Steps whose errors show (after a Next or a save that stopped there).
  const [tried, setTried] = useState<number[]>([]);
  // What is typed in each link field (normalised on save).
  const [typedLinks, setTypedLinks] = useState<ProLinks>(initial.links ?? NO_LINKS);
  const linkResults = Object.fromEntries(LINK_KINDS.map((k) => [k.id, normaliseLink(k.id, typedLinks[k.id] ?? '')])) as Record<LinkKind, ReturnType<typeof normaliseLink>>;
  const linkError = (k: LinkKind) => {
    const r = linkResults[k];
    return r.ok ? null : tr(r.error);
  };
  const linksInvalid = me.linksOn && LINK_KINDS.some((k) => !linkResults[k.id].ok);

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
  // Only the goals on screen change: an older 'meet' stays in the list.
  const toggleIntent = (id: IntentId) => set('intents', d.intents.includes(id) ? d.intents.filter((x) => x !== id) : [...d.intents, id]);
  const hasSkill = (s: string) => d.skills.some((x) => x.toLowerCase() === s.toLowerCase());
  const addSkill = (raw: string) => {
    const s = raw.trim().slice(0, 40);
    if (!s) return;
    if (hasSkill(s)) return setSkill('');
    if (d.skills.length >= MAX_SKILLS) {
      haptic('warning');
      toast(tr('Up to {n} skills', { n: MAX_SKILLS }), 'x', 'live');
      return;
    }
    set('skills', [...d.skills, s]);
    setSkill('');
  };
  const toggleSkill = (s: string) => (hasSkill(s) ? set('skills', d.skills.filter((x) => x.toLowerCase() !== s.toLowerCase())) : addSkill(s));

  const jobError = d.jobTitle.trim().length < 2 ? tr('Add your job title (at least 2 characters)') : null;
  const industryError = d.industries.length ? null : tr('Pick at least one industry');
  const linksError = linksInvalid ? tr('Fix the links above or leave them empty') : null;
  const errorsOf = (i: number) => [i === 0 ? jobError : null, i === 1 ? industryError : null, i === 3 ? linksError : null].filter((e): e is string => Boolean(e));
  const shows = (i: number) => tried.includes(i);

  const go = (i: number) => {
    setDir(i > step ? 1 : -1);
    setStep(i);
    scrollRef.current?.scrollTo({ y: 0, animated: !reduced });
  };
  const next = () => {
    const errors = errorsOf(step);
    if (errors.length) {
      setTried((x) => (x.includes(step) ? x : [...x, step]));
      haptic('warning');
      toast(errors[0], 'x', 'live');
      return;
    }
    go(step + 1);
  };

  const save = async () => {
    if (busy) return;
    const stop = [0, 1, 3].find((i) => errorsOf(i).length);
    if (stop != null) {
      setTried((x) => (x.includes(stop) ? x : [...x, stop]));
      haptic('warning');
      toast(errorsOf(stop)[0], 'x', 'live');
      go(stop);
      return;
    }
    const links = Object.fromEntries(LINK_KINDS.map((k) => [k.id, (linkResults[k.id] as { ok: true; url: string | null }).url ?? null])) as ProLinks;
    setBusy(true);
    try {
      await me.save({ ...d, cityId: d.cityId in CITIES ? d.cityId : cityId, links: me.linksOn ? links : undefined });
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
      <Page overline="IRLY Network" title={TITLE}>
        <View style={[styles.box, { backgroundColor: 'transparent', overflow: 'hidden', marginHorizontal: space.gutter }]}>
          <GlassLayer radius={radius.xl} />
          <Text variant="body" tone="secondary">
            Sign in to create your professional profile.
          </Text>
          <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }

  const city = CITIES[(d.cityId in CITIES ? d.cityId : cityId) as CityId];
  const shownRole = roleChoice(d.role);
  const customSkills = d.skills.filter((s) => !SKILL_SUGGESTIONS.some((x) => x.toLowerCase() === s.toLowerCase()));
  const filledLinks = me.linksOn ? LINK_KINDS.filter((k) => linkResults[k.id].ok && (linkResults[k.id] as { ok: true; url: string | null }).url) : [];
  const entering = reduced ? undefined : (dir > 0 ? FadeInRight : FadeInLeft).springify(520).dampingRatio(0.92);

  const body = [
    // 1 · Professional identity
    <Fragment key="identity">
      <FormSection title="I am">
        <View style={[styles.grid, { gap: grid.gap }]} onLayout={grid.onLayout} accessibilityRole="radiogroup">
          {ROLE_CHOICES.map((r) => (
            <RoleCard key={r.id} label={r.label} hint={r.hint} icon={r.icon} width={grid.cols >= 4 ? grid.tile : Math.floor((grid.width - grid.gap) / 2)} selected={shownRole === r.id} onPress={() => set('role', r.id)} />
          ))}
        </View>
      </FormSection>

      <FormSection title="Job title" error={shows(0) ? jobError : null}>
        <Field icon="briefcase" placeholder="Founder, CEO, Product Manager…" value={d.jobTitle} onChangeText={(v) => set('jobTitle', v)} maxLength={60} autoCapitalize="words" invalid={shows(0) && Boolean(jobError)} accessibilityLabel="Job title" />
        <View style={styles.wrap}>
          {JOB_SUGGESTIONS.map((s) => {
            const label = tr(s);
            return <Chip key={s} size="sm" label={s} selected={d.jobTitle.trim().toLowerCase() === label.toLowerCase()} onPress={() => set('jobTitle', label)} />;
          })}
        </View>
      </FormSection>

      <FormSection title="Company or project name">
        <Field icon="building" placeholder="Optional" value={d.company} onChangeText={(v) => set('company', v)} maxLength={60} accessibilityLabel="Company or project name" />
      </FormSection>
    </Fragment>,

    // 2 · Industries & skills
    <Fragment key="industries">
      <FormSection title={tr('Industry · up to {n}', { n: MAX_INDUSTRIES })} count={`${d.industries.length}/${MAX_INDUSTRIES}`} error={shows(1) ? industryError : null}>
        <View style={[styles.grid, { gap: grid.gap }]} onLayout={grid.onLayout}>
          {INDUSTRIES.map((i) => (
            <Tile key={i.id} emoji={i.emoji} label={i.label} width={grid.tile} selected={d.industries.includes(i.id)} onPress={() => toggleIndustry(i.id)} />
          ))}
        </View>
      </FormSection>

      <FormSection title="Skills" count={`${d.skills.length}/${MAX_SKILLS}`}>
        <View style={styles.wrap}>
          {SKILL_SUGGESTIONS.map((s) => (
            <Chip key={s} size="sm" label={s} selected={hasSkill(s)} onPress={() => toggleSkill(s)} />
          ))}
        </View>
        <Field
          icon="plus"
          placeholder="Add your own skill"
          value={skill}
          onChangeText={setSkill}
          onSubmitEditing={() => addSkill(skill)}
          returnKeyType="done"
          blurOnSubmit={false}
          maxLength={40}
          accessibilityLabel="Add a skill"
          trailing={
            skill.trim() ? (
              <PressableScale haptic="select" onPress={() => addSkill(skill)} hitSlop={8} accessibilityLabel={tr('Add')}>
                <Text variant="label">Add</Text>
              </PressableScale>
            ) : null
          }
        />
        {customSkills.length ? (
          <View style={styles.wrap}>
            {customSkills.map((s) => (
              <Animated.View key={s} entering={reduced ? undefined : FadeIn.duration(180)} layout={reduced ? undefined : LinearTransition.springify().dampingRatio(0.9)}>
                <PressableScale haptic="select" scaleTo={0.95} onPress={() => toggleSkill(s)} style={[styles.skill, { backgroundColor: t.c.text }]} accessibilityLabel={tr('Remove {skill}', { skill: s })}>
                  <Text variant="label" color={t.c.bg} raw>
                    {s}
                  </Text>
                  <Icon name="x" size={14} color={t.c.bg} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </FormSection>
    </Fragment>,

    // 3 · Project & goals
    <Fragment key="project">
      <FormSection title="Current project">
        <Field placeholder="An AI assistant for clinics in Dubai…" value={d.project} onChangeText={(v) => set('project', v)} maxLength={200} multiline accessibilityLabel="Current project" />
      </FormSection>
      <FormSection title="What I'm looking for">
        <Field placeholder="A technical cofounder, first clients in hospitality…" value={d.lookingFor} onChangeText={(v) => set('lookingFor', v)} maxLength={200} multiline accessibilityLabel="What I'm looking for" />
      </FormSection>
      <FormSection title="What I can offer">
        <Field placeholder="Growth advice, intros to investors, design reviews…" value={d.canOffer} onChangeText={(v) => set('canOffer', v)} maxLength={200} multiline accessibilityLabel="What I can offer" />
      </FormSection>
      <FormSection title="My networking goals" hint="Pick as many as you like." count={`${GOALS.filter((g) => d.intents.includes(g.id)).length}/${GOALS.length}`}>
        <View style={[styles.grid, { gap: grid.gap }]} onLayout={grid.onLayout}>
          {GOALS.map((g) => (
            <Tile key={g.id} emoji={g.emoji} label={g.label} width={grid.tile} selected={d.intents.includes(g.id)} onPress={() => toggleIntent(g.id)} />
          ))}
        </View>
      </FormSection>
    </Fragment>,

    // 4 · Links & location
    <Fragment key="links">
      {me.linksOn ? (
        <FormSection title="Links" hint="Optional. Shown on your professional profile, only to members who can see it. HTTPS links only." error={shows(3) ? linksError : null}>
          {LINK_KINDS.map((k) => {
            const typed = typedLinks[k.id] ?? '';
            const err = shows(3) || typed.length > 6 ? linkError(k.id) : null;
            return (
              <View key={k.id} style={{ gap: 6 }}>
                <Field
                  icon={k.icon}
                  placeholder={`${k.label} · ${k.placeholder}`}
                  value={typed}
                  onChangeText={(v) => setTypedLinks((x) => ({ ...x, [k.id]: v }))}
                  onEndEditing={() => {
                    const r = linkResults[k.id];
                    if (r.ok) setTypedLinks((x) => ({ ...x, [k.id]: r.url ?? '' }));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  maxLength={MAX_LINK}
                  invalid={Boolean(err)}
                  valid={Boolean(typed.trim()) && linkResults[k.id].ok}
                  accessibilityLabel={k.label}
                />
                {err ? (
                  <Text variant="caption" color={t.c.live}>
                    {err}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </FormSection>
      ) : null}

      <FormSection title="Where I work from" hint="Others see the neighbourhood and an approximate distance, never your position.">
        <AreaPicker cityId={city.id} value={d.areaId} onChange={(id) => set('areaId', d.areaId === id ? null : id)} label="Neighbourhood" placeholder="Choose a neighbourhood" />
      </FormSection>
    </Fragment>,

    // 5 · Visibility & confirm
    <Fragment key="confirm">
      <PressableScale haptic="select" scaleTo={0.98} onPress={() => set('visible', !d.visible)} style={[styles.toggle, { borderColor: t.c.line }]} accessibilityRole="switch" accessibilityState={{ checked: d.visible }} accessibilityLabel="Show me in Networking">
        <GlassLayer radius={radius.lg} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS">Show me in Networking</Text>
          <Text variant="caption" tone="tertiary">
            {d.visible ? 'Professionals across the country can find you.' : 'Hidden from Networking'}
          </Text>
        </View>
        <View style={[styles.switch, { backgroundColor: d.visible ? t.c.text : t.c.line }]}>
          <Animated.View layout={reduced ? undefined : LinearTransition.springify().dampingRatio(0.8)} style={[styles.knob, { backgroundColor: t.c.bg, alignSelf: d.visible ? 'flex-end' : 'flex-start' }]} />
        </View>
      </PressableScale>

      <FormSection title="Summary">
        <View style={[styles.summary, { borderColor: t.c.line }]}>
          <GlassLayer radius={radius.xl} variant="card" />
          <Row label="I am" value={[tr(ROLE_LABEL[shownRole]), d.company.trim() ? `${d.jobTitle.trim()} · ${d.company.trim()}` : d.jobTitle.trim()].filter(Boolean).join(' · ')} onEdit={() => go(0)} />
          <Row label="Industries" value={d.industries.map((i) => `${INDUSTRY[i].emoji} ${tr(INDUSTRY[i].short)}`).join(', ')} onEdit={() => go(1)} />
          <Row label="Skills" value={d.skills.map((s) => tr(s)).join(', ')} onEdit={() => go(1)} />
          <Row label="Goals" value={GOALS.filter((g) => d.intents.includes(g.id)).map((g) => `${g.emoji} ${tr(g.label)}`).join(', ')} onEdit={() => go(2)} />
          {me.linksOn ? <Row label="Links" value={filledLinks.map((k) => k.label).join(', ')} onEdit={() => go(3)} /> : null}
          <Row label="Where I work from" value={d.areaId ? `${areaName(city, d.areaId)} · ${city.name}` : ''} onEdit={() => go(3)} last />
        </View>
      </FormSection>
    </Fragment>,
  ][step];

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 12, paddingBottom: insets.bottom + 40 }}
        >
          <Animated.View entering={enter.rise(0, 40)} style={styles.head}>
            <Text variant="overline" tone="accent">
              IRLY Network
            </Text>
            <Text variant="displayL" accessibilityRole="header">
              {TITLE}
            </Text>
            <Text variant="body" tone="secondary">
              {SUBTITLE}
            </Text>
          </Animated.View>

          <View style={styles.form}>
            <StepProgress steps={STEPS} step={step} onStep={go} />
            <Animated.View key={step} entering={entering} style={styles.step}>
              {body}
            </Animated.View>

            <View style={styles.nav}>
              {step < STEPS.length - 1 ? (
                <View style={styles.navRow}>
                  {step > 0 ? (
                    <View style={{ flex: 1 }}>
                      <Button label="Back" variant="secondary" icon="chevronLeft" full onPress={() => go(step - 1)} />
                    </View>
                  ) : null}
                  <View style={{ flex: 2 }}>
                    <Button label="Next" iconRight="arrowRight" full onPress={next} />
                  </View>
                </View>
              ) : (
                <>
                  <Button label={me.pro ? 'Save changes' : 'Create my professional profile'} icon="check" size="lg" full loading={busy} disabled={busy} onPress={save} />
                  <Button label="Back" variant="secondary" icon="chevronLeft" full disabled={busy} onPress={() => go(step - 1)} />
                </>
              )}
              {me.pro && step === STEPS.length - 1 ? (
                <Button
                  label="Delete my professional profile"
                  variant="ghost"
                  full
                  disabled={busy}
                  onPress={() =>
                    confirm('Delete your professional profile? You leave Networking; your connections stay.', () =>
                      me
                        .remove()
                        .then(() => {
                          toast(tr('Professional profile deleted'), 'check', 'brand');
                          if (router.canGoBack()) router.back();
                          else router.replace('/network');
                        })
                        .catch(() => toast(tr('Could not delete'), 'x', 'live')),
                    )
                  }
                />
              ) : null}
            </View>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <PageHeader title={TITLE} scrollY={scrollY} />
    </View>
  );
}

/** One line of the summary: what is filled in, and the way back to it. */
function Row({ label, value, onEdit, last }: { label: string; value: string; onEdit: () => void; last?: boolean }) {
  const t = useTheme();
  const tr = useT();
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onEdit}
      accessibilityLabel={tr('Edit {what}', { what: tr(label) })}
      style={[styles.row, last ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.c.line }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" tone="tertiary">
          {label}
        </Text>
        {value ? (
          <Text variant="bodyS" numberOfLines={2} raw>
            {value}
          </Text>
        ) : (
          <Text variant="bodyS" tone="tertiary">
            Not filled in
          </Text>
        )}
      </View>
      <Icon name="edit" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, gap: 4, marginBottom: space[7] },
  form: { paddingHorizontal: space.gutter, gap: space[7] },
  step: { gap: space[7] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill },
  box: { padding: 20, gap: 12, borderRadius: radius.xl },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11 },
  summary: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  nav: { gap: 10 },
  navRow: { flexDirection: 'row', gap: 10 },
});
