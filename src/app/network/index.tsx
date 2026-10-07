import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field, IconButton } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { CITIES, cityScope } from '@/data/destinations';
import { usePros, useMyPro, type ProFilters } from '@/features/network/api';
import { scorePro } from '@/features/network/match';
import { INDUSTRIES, INDUSTRY, LOOKING_FILTERS, ROLES, type IndustryId, type IntentId, type RoleId } from '@/features/network/taxonomy';
import { ProCard } from '@/features/network/ui';
import { useT } from '@/i18n';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Networking for professionals: founders, freelancers, investors and
 * anyone building something, in your city and the rest of the country.
 * Sorted by match when you have a professional profile.
 */
export default function NetworkDiscover() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const me = useMyPro();

  const [industry, setIndustry] = useState<IndustryId | null>(null);
  const [role, setRole] = useState<RoleId | null>(null);
  const [intent, setIntent] = useState<IntentId | null>(null);
  const [onlyCity, setOnlyCity] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  // Search as you type, once you pause.
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(id);
  }, [typed]);

  const filters: ProFilters = useMemo(() => ({ industry, role, intent, city: onlyCity, q }), [industry, role, intent, onlyCity, q]);
  const { list, photos, loading, error, setConnection, signedIn } = usePros(cityId, filters);

  const ranked = useMemo(() => {
    const rows = list.map((p) => ({ p, m: me.pro ? scorePro(me.pro, p) : null }));
    return me.pro ? rows.sort((a, b) => (b.m?.percent ?? 0) - (a.m?.percent ?? 0)) : rows;
  }, [list, me.pro]);

  const count = [role, intent, onlyCity].filter(Boolean).length;
  const scope = cityScope(cityId);
  const reset = () => {
    setIndustry(null);
    setRole(null);
    setIntent(null);
    setOnlyCity(null);
    setTyped('');
  };

  return (
    <Page
      overline={`${city.name} · Networking`}
      title="Professionals"
      subtitle="Founders, freelancers, investors and builders near you. Connect, then meet IRL."
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="sliders" label={tr('Filters')} onPress={() => setOpen(true)} badge={count || undefined} />
          <IconButton icon="briefcase" label={tr('My professional profile')} onPress={() => router.push('/network/profile')} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: space.gutter, gap: space[3] }}>
        <Field icon="search" placeholder="Job, company, skill…" value={typed} onChangeText={setTyped} autoCorrect={false} returnKeyType="search" accessibilityLabel={tr('Search professionals')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        <Chip size="sm" label="All domains" selected={!industry} onPress={() => setIndustry(null)} />
        {INDUSTRIES.map((i) => (
          <Chip key={i.id} size="sm" label={`${i.emoji} ${tr(i.short)}`} selected={industry === i.id} onPress={() => setIndustry(industry === i.id ? null : i.id)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rail, { paddingTop: 0 }]}>
        {LOOKING_FILTERS.map((l) => (
          <Chip key={l.id} size="sm" label={l.label} selected={intent === l.id} onPress={() => setIntent(intent === l.id ? null : l.id)} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
        {signedIn && !me.loading && !me.pro && !me.error ? (
          <Animated.View entering={enter.rise(0)}>
            <PressableScale haptic="tap" scaleTo={0.98} onPress={() => router.push('/network/profile')} style={[styles.cta, { backgroundColor: t.c.text }]} accessibilityRole="button" accessibilityLabel={tr('Create your professional profile')}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="titleM" color={t.c.bg}>
                  Create your professional profile
                </Text>
                <Text variant="bodyS" color={t.c.bg} style={{ opacity: 0.75 }}>
                  Your job, your project, what you look for: we show your match with everyone here.
                </Text>
              </View>
              <Icon name="arrowRight" size={20} color={t.c.bg} />
            </PressableScale>
          </Animated.View>
        ) : null}

        {!signedIn ? (
          <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="network" size={24} color={t.c.textSecondary} />
            <Text variant="titleS" align="center">
              Sign in to meet professionals
            </Text>
            <Text variant="bodyS" tone="secondary" align="center">
              Networking lists real members only, so you need an IRLY account.
            </Text>
            <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
          </View>
        ) : error && !list.length ? (
          <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="network" size={24} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" align="center">
              Can’t reach IRLY right now. Check your connection.
            </Text>
          </View>
        ) : loading && !list.length ? (
          [0, 1, 2].map((i) => <View key={i} style={[styles.skeleton, { backgroundColor: t.c.surface }]} />)
        ) : !ranked.length ? (
          <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="search" size={24} color={t.c.textSecondary} />
            <Text variant="titleS" align="center">
              {industry || role || intent || onlyCity || q ? tr('No one matches these filters yet') : tr('No professionals here yet')}
            </Text>
            <Text variant="bodyS" tone="secondary" align="center">
              {industry || role || intent || onlyCity || q ? tr('Try another domain or clear the filters.') : tr('Be one of the first: your profile shows to everyone who opens Networking.')}
            </Text>
            {industry || role || intent || onlyCity || q ? <Button label="Clear filters" variant="secondary" onPress={reset} /> : !me.pro ? <Button label="Create my profile" onPress={() => router.push('/network/profile')} /> : null}
          </View>
        ) : (
          <>
            <Text variant="caption" tone="tertiary">
              {tr(ranked.length === 1 ? '1 professional' : '{n} professionals', { n: ranked.length })}
              {me.pro ? ` · ${tr('best match first')}` : ''}
            </Text>
            {ranked.map(({ p, m }, i) => (
              <Animated.View key={p.userId} entering={FadeInDown.springify().dampingRatio(0.9).delay(Math.min(i, 6) * 50)} layout={LinearTransition.springify().dampingRatio(0.9)}>
                <ProCard pro={p} photo={p.photoPath ? photos[p.photoPath] : undefined} match={m} onConnection={(c) => setConnection(p.userId, c)} />
              </Animated.View>
            ))}
          </>
        )}
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Filters" subtitle={industry ? `${INDUSTRY[industry].emoji} ${tr(INDUSTRY[industry].label)}` : undefined} maxHeight={0.9}>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Group title="Domain">
            {INDUSTRIES.map((i) => (
              <Chip key={i.id} size="sm" label={`${i.emoji} ${tr(i.label)}`} selected={industry === i.id} onPress={() => setIndustry(industry === i.id ? null : i.id)} />
            ))}
          </Group>
          <Group title="Job">
            <View style={{ flex: 1 }}>
              <Field icon="briefcase" placeholder="Designer, CTO, lawyer…" value={typed} onChangeText={setTyped} autoCorrect={false} accessibilityLabel={tr('Job')} />
            </View>
          </Group>
          <Group title="Profile">
            {ROLES.map((r) => (
              <Chip key={r.id} size="sm" label={r.label} selected={role === r.id} onPress={() => setRole(role === r.id ? null : r.id)} />
            ))}
          </Group>
          <Group title="Looking for">
            {LOOKING_FILTERS.map((l) => (
              <Chip key={l.id} size="sm" label={l.label} selected={intent === l.id} onPress={() => setIntent(intent === l.id ? null : l.id)} />
            ))}
          </Group>
          <Group title="City">
            <Chip size="sm" label={scope.length > 1 ? tr('All Emirates') : city.name} selected={!onlyCity} onPress={() => setOnlyCity(null)} />
            {scope.length > 1
              ? scope.map((c) => <Chip key={c} size="sm" label={CITIES[c].name} selected={onlyCity === c} onPress={() => setOnlyCity(onlyCity === c ? null : c)} />)
              : null}
          </Group>
        </ScrollView>
        <View style={styles.sheetActions}>
          <View style={{ flex: 1 }}>
            <Button label="Reset" variant="secondary" full onPress={reset} />
          </View>
          <View style={{ flex: 2 }}>
            <Button label={loading ? tr('Searching…') : tr('Show {n} results', { n: list.length })} full onPress={() => setOpen(false)} />
          </View>
        </View>
      </Sheet>
    </Page>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: space.gutter, paddingVertical: space[3], gap: 8 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.xl },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
  skeleton: { height: 210, borderRadius: radius.xl, opacity: 0.6 },
  sheet: { paddingHorizontal: space.gutter, paddingBottom: space[4], gap: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingTop: space[3] },
});
