import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { InboxButtons } from '@/components/navigation/Headers';
import { Button } from '@/components/ui/Button';
import { Field, IconButton } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { CITIES, cityScope } from '@/data/destinations';
import { usePros, useMyPro, type ProFilters } from '@/features/network/api';
import { NETWORK_CATEGORY, useNetworkCommunities, useNetworkPosts } from '@/features/network/hub';
import { CommunityTile, MeetupCard, NetworkIntro, OpportunityRow, PostRow, Rail, RowsSkeleton, SectionHead, SectionState } from '@/features/network/sections';
import { useNews } from '@/features/news/news';
import { useServerActivities } from '@/features/server/activities';
import { scorePro } from '@/features/network/match';
import { blockIn, cardIn, cardOut, reflow, UpdatingLine, useBump } from '@/features/network/motion';
import { NetworkPage } from '@/features/network/page';
import { INDUSTRIES, INDUSTRY, LOOKING_FILTERS, ROLE_LABEL, ROLES, type IndustryId, type IntentId, type RoleId } from '@/features/network/taxonomy';
import { FilterChip, NetworkState, ProCard, ProCardSkeleton } from '@/features/network/ui';
import { useT } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { duration } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { NetworkScreen, useNetworkTone } from '@/features/network/tone';

/**
 * IRLY Network: your professional profile (or what Network is and the way
 * in), then the professionals of the country (search, filters, sorted by
 * match when you have a profile), then networking meetups (activities of
 * the Networking category), posts from networking communities, those
 * communities and business news from IRLY's sources. Everything is read
 * from the server; nothing is made up for an empty city.
 */
/** Network pages are violet in IRLY Girl, silver in IRLY (see NetworkScope). */
export default function NetworkDiscover() {
  return (
    <NetworkScreen>
      <NetworkDiscoverPage />
    </NetworkScreen>
  );
}

/** Professionals shown at first, then this many more per "Show more". */
const PAGE = 8;

function NetworkDiscoverPage() {
  const t = useTheme();
  const tone = useNetworkTone();
  const tr = useT();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const me = useMyPro();
  const myName = useStore((s) => s.profile?.name ?? '');

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
  const { list, photos, loading, retrying, error, setConnection, retry, signedIn } = usePros(cityId, filters);

  const ranked = useMemo(() => {
    const rows = list.map((p) => ({ p, m: me.pro ? scorePro(me.pro, p) : null }));
    return me.pro ? rows.sort((a, b) => (b.m?.percent ?? 0) - (a.m?.percent ?? 0)) : rows;
  }, [list, me.pro]);

  // A new search starts again from the first page.
  const filterKey = JSON.stringify(filters);
  const [page, setPage] = useState({ for: filterKey, n: PAGE });
  const limit = page.for === filterKey ? page.n : PAGE;

  const meetups = useServerActivities(cityId, { categoryId: NETWORK_CATEGORY });
  const communities = useNetworkCommunities(cityId);
  const posts = useNetworkPosts(communities.list, 4);
  const news = useNews(cityId, 'business', '', false);
  const [now] = useState(() => Date.now());

  const count = [role, intent, onlyCity].filter(Boolean).length;
  const filtered = Boolean(industry || role || intent || onlyCity || q);
  const scope = cityScope(cityId);
  const reset = useCallback(() => {
    setIndustry(null);
    setRole(null);
    setIntent(null);
    setOnlyCity(null);
    setTyped('');
    setQ('');
  }, []);

  // The list on screen answers older filters while the new answer is on its way: it dims, a light runs above it.
  const updating = (loading || typed.trim() !== q) && list.length > 0;
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.set(withTiming(updating ? 0.55 : 1, { duration: updating ? duration.fast : duration.base }));
  }, [updating, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const countBump = useBump(ranked.length);

  // Each removable pill of what is filtered, so every active filter is visible (those of the sheet too).
  const active: { key: string; label: string; clear: () => void }[] = [
    industry ? { key: 'industry', label: `${INDUSTRY[industry].emoji} ${tr(INDUSTRY[industry].short)}`, clear: () => setIndustry(null) } : null,
    role ? { key: 'role', label: tr(ROLE_LABEL[role]), clear: () => setRole(null) } : null,
    intent ? { key: 'intent', label: tr(LOOKING_FILTERS.find((l) => l.id === intent)?.label ?? ''), clear: () => setIntent(null) } : null,
    onlyCity ? { key: 'city', label: CITIES[onlyCity as keyof typeof CITIES]?.name ?? onlyCity, clear: () => setOnlyCity(null) } : null,
    q ? { key: 'q', label: `“${q}”`, clear: () => setTyped('') } : null,
  ].filter((x): x is { key: string; label: string; clear: () => void } => Boolean(x));

  const state = !signedIn ? 'signedOut' : error && !list.length ? 'error' : loading && !list.length ? 'loading' : !ranked.length ? 'empty' : 'list';

  return (
    <NetworkPage overline={city.name} title="IRLY Network" subtitle="Meet the people building something around you." right={<InboxButtons />}>
      <NetworkIntro
        signedIn={signedIn}
        pro={me.pro}
        name={myName}
        loading={me.loading}
        onProfile={() => router.push('/network/profile')}
        onMine={() => (me.pro ? router.push(`/network/${me.pro.userId}`) : router.push('/network/profile'))}
        onSignIn={() => router.push('/account')}
        index={0}
      />

      <Animated.View entering={blockIn(1)}>
        <View style={styles.proHead}>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.row}>
              <Text variant="titleL" accessibilityRole="header">
                Professionals
              </Text>
              {state === 'list' ? (
                <Animated.View style={[styles.count, { backgroundColor: tone.soft, borderColor: tone.softLine }, countBump]}>
                  <Text variant="caption" color={tone.isGirl ? tone.accent : t.c.text} raw>
                    {String(ranked.length)}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
            <Text variant="caption" tone="tertiary">
              Founders, freelancers, investors and builders. Connect, then meet IRL.
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={blockIn(2)} style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <Field
            icon="search"
            placeholder="Job, company, skill…"
            value={typed}
            onChangeText={setTyped}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search professionals"
            trailing={
              typed ? (
                <PressableScale haptic="select" scaleTo={0.88} onPress={() => setTyped('')} hitSlop={10} accessibilityLabel={tr('Clear the search')} style={[styles.clear, { backgroundColor: tone.soft }]}>
                  <Icon name="x" size={13} color={t.c.textSecondary} strokeWidth={2.4} />
                </PressableScale>
              ) : null
            }
          />
        </View>
        <IconButton icon="sliders" label={tr('Filters')} onPress={() => setOpen(true)} badge={count || undefined} size={48} />
      </Animated.View>

      <Animated.View entering={blockIn(3)}>
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <FilterChip label="All domains" selected={!industry} onPress={() => setIndustry(null)} />
          {INDUSTRIES.map((i) => (
            <FilterChip key={i.id} label={`${i.emoji} ${tr(i.short)}`} selected={industry === i.id} onPress={() => setIndustry(industry === i.id ? null : i.id)} />
          ))}
        </ScrollView>
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rail, { paddingTop: 0 }]}>
          {LOOKING_FILTERS.map((l) => (
            <FilterChip key={l.id} label={l.label} selected={intent === l.id} onPress={() => setIntent(intent === l.id ? null : l.id)} />
          ))}
        </ScrollView>
      </Animated.View>

      {active.length ? (
        <Animated.View entering={cardIn(0)} exiting={cardOut} layout={reflow} style={styles.activeRow}>
          {active.map((a) => (
            <Animated.View key={a.key} entering={cardIn(0)} exiting={cardOut} layout={reflow}>
              <PressableScale
                haptic="select"
                scaleTo={0.94}
                onPress={a.clear}
                accessibilityLabel={tr('Remove the filter {name}', { name: a.label })}
                style={[styles.activePill, { backgroundColor: tone.accent }]}
              >
                <Text variant="caption" color={tone.onAccent} numberOfLines={1} raw style={{ flexShrink: 1 }}>
                  {a.label}
                </Text>
                <Icon name="x" size={12} color={tone.onAccent} strokeWidth={2.6} />
              </PressableScale>
            </Animated.View>
          ))}
          <Animated.View layout={reflow}>
            <PressableScale haptic="select" scaleTo={0.94} onPress={reset} hitSlop={8} accessibilityLabel={tr('Clear all filters')} style={styles.clearAll}>
              <Text variant="label" color={tone.isGirl ? tone.accent : t.c.textSecondary}>
                Clear all
              </Text>
            </PressableScale>
          </Animated.View>
        </Animated.View>
      ) : null}

      <View style={styles.list}>
        <UpdatingLine active={updating} />
        {state === 'signedOut' ? (
          <NetworkState key="signedOut" icon="network" title="Sign in to meet professionals" body="Networking lists real members only, so you need an IRLY account.">
            <Button label="Sign in" icon="user" size="md" onPress={() => router.push('/account')} />
          </NetworkState>
        ) : state === 'error' ? (
          <NetworkState key="error" icon="satellite" error title="Can’t reach IRLY right now" body="Check your connection and try again. Your filters are kept.">
            <Button label="Try again" icon="repeat" variant="secondary" size="md" loading={retrying} onPress={retry} />
          </NetworkState>
        ) : state === 'loading' ? (
          <View key="loading" style={{ gap: 14 }} accessibilityLabel={tr('Loading')}>
            {[0, 1, 2].map((i) => (
              <Animated.View key={i} entering={cardIn(i, 200)}>
                <ProCardSkeleton />
              </Animated.View>
            ))}
          </View>
        ) : state === 'empty' ? (
          filtered ? (
            <NetworkState key="none" icon="search" title="No one matches these filters yet" body="Try another domain or fewer filters: new members join every week.">
              <Button label="Clear filters" icon="x" variant="secondary" size="md" onPress={reset} />
              <Button label="Edit filters" icon="sliders" variant="secondary" size="md" onPress={() => setOpen(true)} />
            </NetworkState>
          ) : (
            <NetworkState key="nobody" icon="users" title="No professionals here yet" body="Be one of the first: your profile shows to everyone who opens Networking.">
              {!me.pro ? <Button label="Create my profile" icon="briefcase" size="md" onPress={() => router.push('/network/profile')} /> : null}
            </NetworkState>
          )
        ) : (
          <Animated.View style={[{ gap: 14 }, dimStyle]}>
            {error ? (
              // The list stays (the last answer); the failed refresh says so, with a way to retry.
              <Animated.View entering={cardIn(0)} exiting={cardOut} style={[styles.stale, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
                <Icon name="satellite" size={14} color={t.c.textSecondary} />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  Couldn’t refresh. Showing the last results.
                </Text>
                <Button label="Retry" variant="ghost" size="sm" loading={retrying} onPress={retry} />
              </Animated.View>
            ) : null}
            <Text variant="caption" tone="tertiary">
              {tr(ranked.length === 1 ? '1 professional' : '{n} professionals', { n: ranked.length })}
              {me.pro ? ` · ${tr('best match first')}` : ''}
            </Text>
            {ranked.slice(0, limit).map(({ p, m }, i) => (
              <Animated.View key={p.userId} entering={cardIn(i, 120)} exiting={cardOut} layout={reflow}>
                <ProCard pro={p} photo={p.photoPath ? photos[p.photoPath] : undefined} match={m} mine={me.pro} onConnection={setConnection} />
              </Animated.View>
            ))}
            {ranked.length > limit ? (
              <Animated.View layout={reflow}>
                <Button label={tr('Show {n} more', { n: Math.min(PAGE, ranked.length - limit) })} icon="chevronDown" variant="secondary" size="md" full onPress={() => setPage({ for: filterKey, n: limit + PAGE })} />
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
      </View>

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
            <SectionState kind="loading" skeleton={{ width: 248, height: 148 }} />
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

          <SectionHead title="Communities" caption="Business, founders, tech and more" action={tr('All communities')} onAction={() => router.push('/communities')} index={2} />
          {communities.loading ? (
            <SectionState kind="loading" skeleton={{ width: 204, height: 156 }} />
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

          <SectionHead title="From networking communities" caption="Latest posts from members" index={3} />
          {communities.loading || (posts.loading && !posts.list.length) ? (
            <RowsSkeleton height={96} />
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

          <SectionHead
            title={tr('Opportunities in {city}', { city: city.name })}
            caption="Business & networking news from IRLY’s sources"
            action={news.items.length ? tr('News') : undefined}
            onAction={() => router.push('/news')}
            index={4}
          />
          {news.loading ? (
            <RowsSkeleton height={84} />
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

      <Sheet visible={open} onClose={() => setOpen(false)} title="Filters" subtitle={industry ? `${INDUSTRY[industry].emoji} ${tr(INDUSTRY[industry].label)}` : undefined} maxHeight={0.9}>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Group title="Domain">
            {INDUSTRIES.map((i) => (
              <FilterChip key={i.id} label={`${i.emoji} ${tr(i.label)}`} selected={industry === i.id} onPress={() => setIndustry(industry === i.id ? null : i.id)} />
            ))}
          </Group>
          <Group title="Job">
            <View style={{ flex: 1 }}>
              <Field icon="briefcase" placeholder="Designer, CTO, lawyer…" value={typed} onChangeText={setTyped} autoCorrect={false} accessibilityLabel={tr('Job')} />
            </View>
          </Group>
          <Group title="Profile">
            {ROLES.map((r) => (
              <FilterChip key={r.id} label={r.label} selected={role === r.id} onPress={() => setRole(role === r.id ? null : r.id)} />
            ))}
          </Group>
          <Group title="Looking for">
            {LOOKING_FILTERS.map((l) => (
              <FilterChip key={l.id} label={l.label} selected={intent === l.id} onPress={() => setIntent(intent === l.id ? null : l.id)} />
            ))}
          </Group>
          <Group title="City">
            <FilterChip label={scope.length > 1 ? tr('All Emirates') : city.name} selected={!onlyCity} onPress={() => setOnlyCity(null)} />
            {scope.length > 1
              ? scope.map((c) => <FilterChip key={c} label={CITIES[c].name} selected={onlyCity === c} onPress={() => setOnlyCity(onlyCity === c ? null : c)} />)
              : null}
          </Group>
        </ScrollView>
        <View style={styles.sheetActions}>
          <View style={{ flex: 1 }}>
            <Button label="Reset" variant="secondary" full disabled={!filtered} onPress={reset} />
          </View>
          <View style={{ flex: 2 }}>
            <Button label={loading ? tr('Searching…') : tr('Show {n} results', { n: list.length })} full onPress={() => setOpen(false)} />
          </View>
        </View>
      </Sheet>
    </NetworkPage>
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
  proHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.gutter, marginTop: space[9], marginBottom: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { minWidth: 28, height: 24, paddingHorizontal: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  rail: { paddingHorizontal: space.gutter, paddingVertical: space[3], gap: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter },
  clear: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter, paddingBottom: space[3] },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, maxWidth: 220, paddingHorizontal: 12, borderRadius: radius.pill },
  clearAll: { height: 28, justifyContent: 'center', paddingHorizontal: 4 },
  list: { paddingHorizontal: space.gutter, paddingTop: space[2], gap: 12 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 4, minHeight: 40, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  sheet: { paddingHorizontal: space.gutter, paddingBottom: space[4], gap: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingTop: space[3] },
});
