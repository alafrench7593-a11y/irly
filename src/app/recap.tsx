import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { useAccount } from '@/features/auth/account';
import { useChallenges, useForYou, useGroupSuggestions, useRecap, type RecapItem } from '@/features/engage/engage';
import { t as tx } from '@/i18n';
import { cityWhen, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SECTIONS: { id: RecapItem['section']; title: string; icon: IconName }[] = [
  { id: 'discussion', title: 'Discussions you missed', icon: 'message' },
  { id: 'upcoming', title: 'Your next plans', icon: 'calendar' },
  { id: 'community', title: 'New in your communities', icon: 'users' },
  { id: 'for_you', title: 'Activities that may interest you', icon: 'sparkles' },
];

/**
 * My recap: since my last visit, what happened in my communities, my next
 * plans, what is new and activities that fit what I like; then posts for
 * me, groups to join and this month's shared challenges. Only real activity.
 */
export default function RecapScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const now = useNow();
  const recap = useRecap(cityId);
  const forYou = useForYou();
  const groups = useGroupSuggestions(cityId);
  const challenges = useChallenges(cityId);
  const { markSeen, loading, failed } = recap;
  // Seen once shown: next time, the recap starts from now. A failed load was not seen: it stays for next time.
  useEffect(() => {
    if (!loading && !failed) markSeen();
  }, [loading, failed, markSeen]);

  if (!account) {
    return (
      <Page title="My recap">
        <View style={styles.pad}>
          <Button label="Sign in" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }
  const open = (r: RecapItem) => (r.section === 'discussion' ? router.push({ pathname: '/comments', params: { type: 'community_post', id: r.id } }) : r.section === 'community' ? router.push(`/c/${r.id}`) : router.push(`/a/${r.id}`));
  const nothing = !recap.loading && !recap.items.length && !forYou.items.length && !groups.items.length;

  return (
    <Page overline={city.name} title="My recap" subtitle={recap.since ? tx('Since your last visit, {time}.', { time: timeAgo(Math.max(1, Math.round((now - Date.parse(recap.since)) / 60000))) }) : tx('The last 7 days.')}>
      <View style={{ gap: space[5] }}>
        {nothing ? (
          <View style={[styles.card, { backgroundColor: t.c.surface, marginHorizontal: space.gutter }]}>
            <Text variant="body" tone="secondary">
              Nothing new yet. Join communities and activities: your recap fills up with what really happens there.
            </Text>
            <Button label="Explore communities" variant="secondary" onPress={() => router.push('/communities')} />
          </View>
        ) : null}

        {SECTIONS.map((s) => {
          const items = recap.items.filter((r) => r.section === s.id);
          if (!items.length) return null;
          return (
            <View key={s.id} style={{ gap: 8 }}>
              <View style={[styles.pad, styles.row]}>
                <Icon name={s.icon} size={16} color={t.c.text} />
                <Text variant="titleS">{s.title}</Text>
              </View>
              {items.map((r) => (
                <PressableScale key={s.id + r.id} haptic="select" scaleTo={0.98} onPress={() => open(r)} style={[styles.item, { backgroundColor: t.c.surface }]} accessibilityLabel={r.title}>
                  <Text variant="label" numberOfLines={2} raw>
                    {r.title}
                  </Text>
                  <Text variant="caption" tone="tertiary" raw>
                    {s.id === 'discussion'
                      ? [r.detail, r.n ? tx('{n} new replies', { n: r.n }) : null].filter(Boolean).join(' · ')
                      : s.id === 'community'
                        ? tx('{n} new members', { n: r.n })
                        : [r.at ? cityWhen(r.at, cityId) : null, r.detail, tx('{n} going', { n: r.n })].filter(Boolean).join(' · ')}
                  </Text>
                </PressableScale>
              ))}
            </View>
          );
        })}

        {forYou.items.length ? (
          <View style={{ gap: 8 }}>
            <View style={[styles.pad, styles.row]}>
              <Icon name="heart" size={16} color={t.c.text} />
              <Text variant="titleS">For you</Text>
            </View>
            {forYou.items.slice(0, 6).map((p) => (
              <PressableScale key={p.id} haptic="select" scaleTo={0.98} onPress={() => router.push({ pathname: '/comments', params: { type: 'community_post', id: p.id } })} style={[styles.item, { backgroundColor: t.c.surface }]} accessibilityLabel={p.body.slice(0, 80)}>
                <Text variant="caption" tone="tertiary" raw>
                  {[p.firstName, p.communityName ?? tx('Profile'), timeAgo(Math.max(0, Math.round((now - p.at) / 60000)))].join(' · ')}
                </Text>
                <Text variant="body" numberOfLines={3} raw>
                  {p.body || (p.mediaPaths.length ? (p.mediaKind === 'video' ? tx('A video') : tx('{n} photos', { n: p.mediaPaths.length })) : '')}
                </Text>
                <Text variant="caption" tone="secondary">
                  {tx('{c} comments · {l} likes', { c: p.comments, l: p.likes })}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : null}

        {groups.items.length ? (
          <View style={{ gap: 8 }}>
            <View style={[styles.pad, styles.row]}>
              <Icon name="layers" size={16} color={t.c.text} />
              <Text variant="titleS">Groups for you</Text>
            </View>
            {groups.items.map((g) => (
              <PressableScale key={g.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/c/${g.id}`)} style={[styles.item, styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={g.name}>
                <Text style={{ fontSize: 22 }} raw>
                  {g.emoji ?? '💬'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="label">
                    {g.name}
                  </Text>
                  <Text variant="caption" tone="tertiary" raw>
                    {[g.parentName, g.reason === 'in_your_community' ? tx('in a community you joined') : tx('matches your interests'), tx('{n} members', { n: g.members })].join(' · ')}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>
        ) : null}

        {challenges.items.length ? (
          <View style={{ gap: 8 }}>
            <View style={[styles.pad, styles.row]}>
              <Icon name="trophy" size={16} color={t.c.text} />
              <Text variant="titleS">{tx('This month in {city}, together', { city: city.name })}</Text>
            </View>
            {challenges.items.map((c) => {
              const label =
                c.challenge === 'activities'
                  ? tx('{done} / {goal} activities that happened', { done: c.done, goal: c.goal })
                  : c.challenge === 'places'
                    ? tx('{done} / {goal} places discovered', { done: c.done, goal: c.goal })
                    : tx('{done} / {goal} answers in Help & Questions', { done: c.done, goal: c.goal });
              const pct = Math.min(100, Math.round((c.done / Math.max(1, c.goal)) * 100));
              return (
                <View key={c.challenge} style={[styles.item, { backgroundColor: t.c.surface }]}>
                  <Text variant="label">{label}</Text>
                  <View style={[styles.bar, { backgroundColor: t.c.overlay }]}>
                    <View style={[styles.fill, { width: `${pct}%`, backgroundColor: t.c.text }]} />
                  </View>
                  <Text variant="caption" tone="tertiary">
                    {c.mine ? tx('Your part: {n}', { n: c.mine }) : tx('Join an activity to add yours.')}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { padding: 16, gap: 10, borderRadius: radius.xl },
  item: { marginHorizontal: space.gutter, padding: 14, gap: 4, borderRadius: radius.lg },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 4 },
  fill: { height: 6, borderRadius: 3 },
});
