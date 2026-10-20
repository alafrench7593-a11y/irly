import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { InboxButtons } from '@/components/navigation/Headers';
import { Button } from '@/components/ui/Button';
import { Chip, Field, IconButton } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { CITIES, cityScope } from '@/data/destinations';
import { usePros, useMyPro, type ProFilters } from '@/features/network/api';
import { NETWORK_CATEGORY, useNetworkCommunities, useNetworkPosts } from '@/features/network/hub';
import { CommunityTile, MeetupCard, NetworkIntro, OpportunityRow, PostRow, Rail, SectionHead, SectionState } from '@/features/network/sections';
import { useNews } from '@/features/news/news';
import { useServerActivities } from '@/features/server/activities';
import { scorePro } from '@/features/network/match';
import { INDUSTRIES, INDUSTRY, LOOKING_FILTERS, ROLES, type IndustryId, type IntentId, type RoleId } from '@/features/network/taxonomy';
import { ProCard } from '@/features/network/ui';
import { useT } from '@/i18n';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * IRLY Network: what it is and your professional profile, then networking
 * meetups (activities of the Networking category), posts from networking
 * communities, those communities, business news from IRLY's sources, and the
 * professionals of the country (sorted by match when you have a profile).
 * Everything is read from the server; nothing is made up for an empty city.
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
  const { list, photos, loading, error, setConnection, retry, signedIn } = usePros(cityId, filters);

  const ranked = useMemo(() => {
    const rows = list.map((p) => ({ p, m: me.pro ? scorePro(me.pro, p) : null }));
    return me.pro ? rows.sort((a, b) => (b.m?.percent ?? 0) - (a.m?.percent ?? 0)) : rows;
  }, [list, me.pro]);

  const meetups = useServerActivities(cityId, { categoryId: NETWORK_CATEGORY });
  const communities = useNetworkCommunities(cityId);
  const posts = useNetworkPosts(communities.list, 4);
  const news = useNews(cityId, 'business', '', false);
  const [now] = useState(() => Date.now());

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
    <Page overline={city.name} title="IRLY Network" right={<InboxButtons />}>
      <NetworkIntro
        signedIn={signedIn}
        hasPro={Boolean(me.pro)}
        loading={me.loading}
        onProfile={() => router.push('/network/profile')}
        onMine={() => (me.pro ? router.push(`/network/${me.pro.userId}`) : router.push('/network/profile'))}
        onSignIn={() => router.push('/account')}
      />

      {signedIn ? (
        <>
          <SectionHead
            title="Professional meetups"
            caption={tr('Networking activities across {city}', { city: scope.length > 1 ? tr('the Emirates') : city.name })}
            action={meetups.activities.length ? tr('See all') : undefined}
            onAction={() => router.push('/category/networking')}
            index={1}
          />
          {meetups.loading && !meetups.activities.length ? (
            <SectionState kind="loading" skeleton={{ width: 240, height: 140 }} />
          ) : meetups.error && !meetups.activities.length ? (
            <SectionState kind="error" onAction={meetups.refresh} />
          ) : !meetups.activities.length ? (
            <SectionState kind="empty" icon="calendar" title="No networking meetup planned yet" body="Host the first one: people into business nearby will see it." action="Explore" onAction={() => router.push('/category/networking')} />
          ) : (
            <Rail>
              {meetups.activities.slice(0, 10).map((a, i) => (
                <MeetupCard key={a.id} a={a} index={i} />
              ))}
            </Rail>
          )}

          <SectionHead title="From networking communities" caption="Latest posts from members" index={2} />
          {communities.loading || (posts.loading && !posts.list.length) ? (
            <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} height={96} radius={radius.lg} />
              ))}
            </View>
          ) : (communities.error && !communities.list.length) || (posts.error && !posts.list.length) ? (
            <SectionState kind="error" onAction={() => (communities.error ? communities.retry() : posts.retry())} />
          ) : !posts.list.length ? (
            <SectionState kind="empty" icon="message" title="No posts yet" body={communities.list.length ? 'Join a networking community and start the conversation.' : 'Networking communities show here once they exist.'} />
          ) : (
            <View style={{ gap: 10 }}>
              {posts.list.map((p, i) => (
                <PostRow key={p.id} p={p} index={i} now={now} />
              ))}
            </View>
          )}

          <SectionHead title="Communities" caption="Business, founders, tech and more" action={tr('All communities')} onAction={() => router.push('/communities')} index={3} />
          {communities.loading ? (
            <SectionState kind="loading" skeleton={{ width: 200, height: 150 }} />
          ) : communities.error && !communities.list.length ? (
            <SectionState kind="error" onAction={communities.retry} />
          ) : !communities.list.length ? (
            <SectionState kind="empty" icon="users" title="No networking community here yet" body="Start one for the people you want to meet." action="Create" onAction={() => router.push('/community/new')} />
          ) : (
            <Rail>
              {communities.list.slice(0, 12).map((c, i) => (
                <CommunityTile key={c.id} c={c} index={i} />
              ))}
            </Rail>
          )}

          <SectionHead
            title={tr('Opportunities in {city}', { city: city.name })}
            caption="Business & networking news from IRLY’s sources"
            action={news.items.length ? tr('News') : undefined}
            onAction={() => router.push('/news')}
            index={4}
          />
          {news.loading ? (
            <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} height={84} radius={radius.lg} />
              ))}
            </View>
          ) : news.error && !news.items.length ? (
            <SectionState kind="error" onAction={news.reload} />
          ) : !news.items.length ? (
            <SectionState kind="empty" icon="news" title="No business news this month" body="Headlines show here when IRLY’s sources publish them." />
          ) : (
            <View style={{ gap: 10 }}>
              {news.items.slice(0, 3).map((n, i) => (
                <OpportunityRow key={n.id} n={n} index={i} now={now} />
              ))}
            </View>
          )}
        </>
      ) : null}

      <SectionHead title="Professionals" caption="Founders, freelancers, investors and builders. Connect, then meet IRL." index={5} />
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <Field icon="search" placeholder="Job, company, skill…" value={typed} onChangeText={setTyped} autoCorrect={false} returnKeyType="search" accessibilityLabel={tr('Search professionals')} />
        </View>
        <IconButton icon="sliders" label={tr('Filters')} onPress={() => setOpen(true)} badge={count || undefined} />
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
        {!signedIn ? (
          <View style={[styles.empty, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
            <GlassLayer radius={radius.xl} />
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
          <View style={[styles.empty, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
            <GlassLayer radius={radius.xl} />
            <Icon name="network" size={24} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" align="center">
              Can’t reach IRLY right now. Check your connection.
            </Text>
            <Button label="Try again" icon="repeat" variant="secondary" onPress={retry} />
          </View>
        ) : loading && !list.length ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={210} radius={radius.xl} />)
        ) : !ranked.length ? (
          <View style={[styles.empty, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
            <GlassLayer radius={radius.xl} />
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
  sheet: { paddingHorizontal: space.gutter, paddingBottom: space[4], gap: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingTop: space[3] },
});
