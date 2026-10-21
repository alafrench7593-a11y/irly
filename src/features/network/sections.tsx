import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { cardDay, cardTime } from '@/components/cards/HomeCards';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import type { NewsItem } from '@/features/news/news';
import type { ServerActivity } from '@/features/server/activities';
import { t as tx, useT } from '@/i18n';
import { initials } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { NetCommunity, NetPost } from './hub';
import { LINK_KINDS, linkLabel, safeLink, type ProLinks } from './links';
import type { ProProfile } from './match';
import { blockIn, REVEAL_BATCH, stateIn, useBump, usePressLight } from './motion';
import { AccentFill, layered, NetworkPane, useNetworkTone } from './tone';
import { Shimmer, useGlint } from './ui';

/**
 * The parts of the IRLY Network page: the intro, section heads, rails of
 * meetups, posts, communities and opportunities, with their loading,
 * failure and empty states. Colours come from the theme only, so the same
 * page wears the IRLY Girl look in IRLY Girl.
 */

/**
 * The top of IRLY Network. Without a professional profile: what IRLY
 * Network is, who it is for, and the way in (sign in, or create the
 * profile). With one: a compact strip of your profile (your match is
 * computed from it), which opens it, with Edit.
 */
export function NetworkIntro({
  signedIn,
  pro,
  name,
  loading,
  onProfile,
  onMine,
  onSignIn,
  index = 0,
}: {
  signedIn: boolean;
  pro: ProProfile | null;
  /** Your first name (your IRLY profile), for the initials. */
  name: string;
  loading: boolean;
  onProfile: () => void;
  onMine: () => void;
  onSignIn: () => void;
  index?: number;
}) {
  const t = useTheme();
  const tone = useNetworkTone();
  const { press, onPressIn, onPressOut } = usePressLight();
  if (signedIn && loading) return <StripSkeleton index={index} />;
  if (signedIn && pro)
    return (
      <Animated.View entering={blockIn(index)} style={styles.stripWrap}>
        <PressableScale
          haptic="select"
          scaleTo={0.98}
          onPress={onMine}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityLabel="Your professional profile"
          style={[styles.strip, { boxShadow: tone.surface.shadow }]}
        >
          <NetworkPane radius={radius.xl} press={press} />
          <View style={[styles.mine, layered, { overflow: 'hidden', boxShadow: tone.glow }]}>
            <AccentFill colors={tone.gradient} />
            <Text variant="titleS" color={tone.onAccent} raw>
              {initials(name || pro.firstName)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="overline" tone="tertiary" numberOfLines={1}>
              Your professional profile
            </Text>
            <Text variant="titleS" numberOfLines={1} raw>
              {pro.company ? `${pro.jobTitle} · ${pro.company}` : pro.jobTitle}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              Used for your matches
            </Text>
          </View>
          <PressableScale haptic="select" scaleTo={0.9} onPress={onProfile} hitSlop={6} accessibilityLabel="Edit my profile" style={[styles.editMine, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
            <Icon name="edit" size={16} color={tone.isGirl ? tone.accent : t.c.text} />
          </PressableScale>
        </PressableScale>
      </Animated.View>
    );
  const points: { icon: IconName; text: string }[] = [
    { icon: 'briefcase', text: 'A professional profile next to your IRLY profile' },
    { icon: 'sparkles', text: 'Your match with founders, freelancers and investors' },
    { icon: 'calendar', text: 'Meetups, communities and posts about business' },
  ];
  return (
    <Animated.View entering={blockIn(index)} style={[styles.intro, { boxShadow: tone.surface.shadow }]}>
      <NetworkPane radius={radius.xl} />
      <View style={styles.introHead}>
        <Animated.View entering={enter.pop(0, 260)} style={[styles.introMark, layered, { overflow: 'hidden', boxShadow: tone.glow }]}>
          <AccentFill colors={tone.gradient} />
          <Icon name="network" size={20} color={tone.onAccent} />
        </Animated.View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="overline" tone="tertiary">
            IRLY Network
          </Text>
          <Text variant="titleM">Meet people building something</Text>
        </View>
      </View>
      <Text variant="bodyS" tone="secondary">
        For founders, freelancers, employees and investors who want to meet in real life: find the right people, join business meetups and communities, then connect and talk.
      </Text>
      <View style={{ gap: 10 }}>
        {points.map((p, i) => (
          <Animated.View key={p.text} entering={enter.fade(i + 3)} style={styles.point}>
            <View style={[styles.pointIcon, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
              <Icon name={p.icon} size={13} color={tone.accent} />
            </View>
            <Text variant="caption" style={{ flex: 1, color: t.c.textSecondary }}>
              {p.text}
            </Text>
          </Animated.View>
        ))}
      </View>
      {!signedIn ? (
        <Button label="Sign in to join IRLY Network" icon="user" size="md" full onPress={onSignIn} />
      ) : (
        <Button label="Create my professional profile" icon="briefcase" size="md" full onPress={onProfile} />
      )}
    </Animated.View>
  );
}

function StripSkeleton({ index }: { index: number }) {
  const tone = useNetworkTone();
  const glint = useGlint();
  return (
    <Animated.View entering={blockIn(index)} style={[styles.stripWrap, styles.strip, { boxShadow: tone.surface.shadow }]} accessibilityLabel={tx('Loading')}>
      <NetworkPane radius={radius.xl} />
      <Shimmer glint={glint} width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <Shimmer glint={glint} width="40%" height={9} radius={5} />
        <Shimmer glint={glint} width="70%" height={14} radius={7} />
      </View>
    </Animated.View>
  );
}

/** A section title, with an optional count and "See all". */
export function SectionHead({ title, caption, action, onAction, index = 0, count }: { title: string; caption?: string; action?: string; onAction?: () => void; index?: number; count?: number }) {
  const t = useTheme();
  const tone = useNetworkTone();
  const bump = useBump(count);
  return (
    <Animated.View entering={enter.rise(index)} style={styles.head}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.headRow}>
          <Text variant="titleM" accessibilityRole="header">
            {title}
          </Text>
          {count != null ? (
            <Animated.View style={[styles.count, { backgroundColor: tone.soft, borderColor: tone.softLine }, bump]}>
              <Text variant="caption" color={tone.isGirl ? tone.accent : t.c.text} raw>
                {String(count)}
              </Text>
            </Animated.View>
          ) : null}
        </View>
        {caption ? (
          <Text variant="caption" tone="tertiary">
            {caption}
          </Text>
        ) : null}
      </View>
      {action && onAction ? (
        <PressableScale haptic="select" onPress={onAction} hitSlop={10} accessibilityRole="link" accessibilityLabel={action} style={styles.headAction}>
          <Text variant="label" tone={tone.isGirl ? undefined : 'secondary'} color={tone.isGirl ? tone.accent : undefined}>
            {action}
          </Text>
          <Icon name="chevronRight" size={14} color={tone.isGirl ? tone.accent : t.c.textSecondary} />
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

/** Loading, failed or empty: one compact line where the rail would be. */
export function SectionState({
  kind,
  icon = 'search',
  title,
  body,
  action,
  onAction,
  skeleton = { width: 240, height: 132 },
}: {
  kind: 'loading' | 'error' | 'empty';
  icon?: IconName;
  title?: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  skeleton?: { width: number | `${number}%`; height: number };
}) {
  const t = useTheme();
  const tone = useNetworkTone();
  if (kind === 'loading')
    return (
      <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} accessibilityLabel={tx('Loading')}>
        <RailSkeleton width={skeleton.width} height={skeleton.height} />
      </ScrollView>
    );
  return (
    <Animated.View entering={stateIn} style={[styles.state, { boxShadow: tone.surface.shadow }]}>
      <NetworkPane radius={radius.lg} light={false} />
      <View style={[styles.well, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
        <Icon name={kind === 'error' ? 'satellite' : icon} size={16} color={kind === 'error' ? t.c.textSecondary : tone.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{kind === 'error' ? 'Can’t reach IRLY right now' : (title ?? '')}</Text>
        {body || kind === 'error' ? (
          <Text variant="caption" tone="tertiary">
            {kind === 'error' ? 'Check your connection and try again.' : body}
          </Text>
        ) : null}
      </View>
      {kind === 'error' && onAction ? (
        <Button label="Retry" icon="repeat" variant="secondary" size="sm" onPress={onAction} />
      ) : action && onAction ? (
        <Button label={action} variant="secondary" size="sm" onPress={onAction} />
      ) : null}
    </Animated.View>
  );
}

/** Placeholders of a rail (meetups, communities) in the Network colours. */
function RailSkeleton({ width, height }: { width: number | `${number}%`; height: number }) {
  const glint = useGlint();
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Shimmer key={i} glint={glint} width={width} height={height} radius={radius.lg} />
      ))}
    </>
  );
}

/** Placeholders of a list of rows (posts, news). */
export function RowsSkeleton({ count = 2, height }: { count?: number; height: number }) {
  const glint = useGlint();
  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 10 }} accessibilityLabel={tx('Loading')}>
      {Array.from({ length: count }, (_, i) => (
        <Shimmer key={i} glint={glint} height={height} radius={radius.lg} />
      ))}
    </View>
  );
}

export function Rail({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} decelerationRate="fast">
      {children}
    </ScrollView>
  );
}

/** An upcoming networking activity; opens its page. */
export function MeetupCard({ a, index }: { a: ServerActivity; index: number }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const city = CITIES[a.cityId as CityId];
  const place = a.placeName || (city ? areaName(city, a.areaId) : a.areaId);
  const when = `${cardDay(a.startsAt, a.cityId)} · ${cardTime(a.startsAt, a.cityId)}`;
  const tone = useNetworkTone();
  const { press, onPressIn, onPressOut } = usePressLight();
  return (
    <Animated.View entering={index < REVEAL_BATCH ? enter.slide(index) : undefined}>
      <PressableScale
        haptic="select"
        scaleTo={0.97}
        onPress={() => router.push(`/a/${a.id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={`${a.title}, ${when}, ${place}`}
        style={[styles.meetup, { boxShadow: tone.surface.shadow }]}
      >
        <NetworkPane radius={radius.lg} press={press} />
        <View style={styles.row}>
          <Icon name="calendar" size={13} color={tone.accent} />
          <Text variant="caption" tone="secondary" raw numberOfLines={1} style={{ flex: 1 }}>
            {when}
          </Text>
          {a.joined ? (
            <View style={[styles.badge, { backgroundColor: tone.accent }]}>
              <Text variant="caption" color={tone.onAccent}>
                Going
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="titleS" numberOfLines={2} raw>
          {a.title}
        </Text>
        <View style={[styles.row, { marginTop: 'auto' }]}>
          <Icon name="pin" size={12} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary" numberOfLines={1} raw style={{ flex: 1 }}>
            {place}
          </Text>
          <Icon name="users" size={12} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary" raw>
            {a.capacity ? `${a.going}/${a.capacity}` : String(a.going)}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {a.priceMinor > 0 ? tr('Paid') : tr('Free')}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

/** A post from a networking community; opens the post and its comments. */
export function PostRow({ p, index, now }: { p: NetPost; index: number; now: number }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const tone = useNetworkTone();
  const { press, onPressIn, onPressOut } = usePressLight();
  const ago = timeAgo(Math.max(0, Math.round((now - p.at) / 60000)));
  return (
    <Animated.View entering={enter.rise(index)}>
      <PressableScale
        haptic="select"
        scaleTo={0.98}
        onPress={() => router.push(`/comments?type=community_post&id=${encodeURIComponent(p.id)}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={tr('Post in {name}', { name: p.communityName })}
        style={[styles.post, { boxShadow: tone.surface.shadow }]}
      >
        <NetworkPane radius={radius.lg} press={press} light={false} />
        <PressableScale onPress={() => router.push(`/c/${p.communityId}`)} accessibilityRole="link" accessibilityLabel={p.communityName} hitSlop={6}>
          <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
            {[p.communityName, p.authorName, ago].filter(Boolean).join(' · ')}
          </Text>
        </PressableScale>
        <Text variant="bodyS" numberOfLines={3} raw>
          {p.body}
        </Text>
        <View style={styles.row}>
          {p.hasMedia ? <Icon name="image" size={13} color={t.c.textTertiary} /> : null}
          <Icon name="heart" size={13} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary" raw>
            {String(p.likes)}
          </Text>
          <Icon name="message" size={13} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary" raw>
            {String(p.comments)}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** A networking community; opens it. */
export function CommunityTile({ c, index }: { c: NetCommunity; index: number }) {
  const tr = useT();
  const router = useRouter();
  const tone = useNetworkTone();
  const { press, onPressIn, onPressOut } = usePressLight();
  return (
    <Animated.View entering={index < REVEAL_BATCH ? enter.slide(index) : undefined}>
      <PressableScale
        haptic="select"
        scaleTo={0.97}
        onPress={() => router.push(`/c/${c.id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={c.name}
        style={[styles.community, { boxShadow: tone.surface.shadow }]}
      >
        <NetworkPane radius={radius.lg} press={press} />
        <View style={styles.row}>
          <View style={[styles.emoji, { borderColor: tone.softLine, backgroundColor: tone.soft }]}>
            {c.emoji ? (
              <Text variant="titleS" raw>
                {c.emoji}
              </Text>
            ) : (
              <Icon name="users" size={16} color={tone.accent} />
            )}
          </View>
          {c.isMember ? (
            <View style={[styles.badge, { backgroundColor: tone.accent, marginLeft: 'auto' }]}>
              <Text variant="caption" color={tone.onAccent}>
                Member
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="titleS" numberOfLines={2} raw>
          {c.name}
        </Text>
        {c.tagline ? (
          <Text variant="caption" tone="secondary" numberOfLines={2} raw>
            {c.tagline}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary" style={{ marginTop: 'auto' }} numberOfLines={1}>
          {[tr(c.members === 1 ? '1 member' : '{n} members', { n: c.members }), c.postsWeek ? tr('{n} posts this week', { n: c.postsWeek }) : null].filter(Boolean).join(' · ')}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

/** A business headline from IRLY's news sources; opens the original article. */
export function OpportunityRow({ n, index, now }: { n: NewsItem; index: number; now: number }) {
  const t = useTheme();
  const tone = useNetworkTone();
  const open = () => {
    // Only an https article address is opened.
    if (!/^https:\/\//i.test(n.url)) return toast('Could not open the article', 'x', 'live');
    WebBrowser.openBrowserAsync(n.url).catch(() => toast('Could not open the article', 'x', 'live'));
  };
  const { press, onPressIn, onPressOut } = usePressLight();
  return (
    <Animated.View entering={enter.rise(index)}>
      <PressableScale
        haptic="select"
        scaleTo={0.98}
        onPress={open}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="link"
        accessibilityLabel={n.title}
        style={[styles.post, { boxShadow: tone.surface.shadow }]}
      >
        <NetworkPane radius={radius.lg} press={press} light={false} />
        <View style={styles.row}>
          <Icon name="news" size={13} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary" numberOfLines={1} raw style={{ flex: 1 }}>
            {[n.source, timeAgo(Math.max(0, Math.round((now - n.publishedAt) / 60000)))].join(' · ')}
          </Text>
          {n.sponsored ? (
            <Text variant="caption" tone="tertiary">
              Sponsored
            </Text>
          ) : null}
          <Icon name="arrowUpRight" size={14} color={tone.accent} />
        </View>
        <Text variant="label" numberOfLines={2} raw>
          {n.title}
        </Text>
        {n.summary ? (
          <Text variant="caption" tone="secondary" numberOfLines={2} raw>
            {n.summary}
          </Text>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

/** A professional's own links: only those filled and valid, each opening the platform. */
export function ProLinkButtons({ links, index = 0 }: { links: ProLinks; index?: number }) {
  const t = useTheme();
  const tr = useT();
  const tone = useNetworkTone();
  const shown = LINK_KINDS.map((k) => ({ ...k, url: safeLink(k.id, links[k.id]) })).filter((k): k is (typeof k & { url: string }) => Boolean(k.url));
  if (!shown.length) return null;
  return (
    <Animated.View entering={enter.rise(index)} style={styles.links}>
      <Text variant="overline" tone="tertiary">
        Links
      </Text>
      <View style={styles.linkWrap}>
        {shown.map((k) => (
          <PressableScale
            key={k.id}
            haptic="select"
            scaleTo={0.96}
            onPress={() => Linking.openURL(k.url).catch(() => toast(tr('Could not open the link'), 'x', 'live'))}
            accessibilityRole="link"
            accessibilityLabel={tr('Open {what}', { what: k.label })}
            accessibilityHint={k.url}
            style={[styles.link, { borderColor: t.c.line }]}
          >
            <GlassLayer radius={radius.pill} variant="chip" />
            <Icon name={k.icon} size={14} color={tone.accent} />
            <View style={{ flexShrink: 1 }}>
              <Text variant="caption" tone="tertiary" raw>
                {k.label}
              </Text>
              <Text variant="label" numberOfLines={1} raw>
                {linkLabel(k.id, k.url)}
              </Text>
            </View>
            <Icon name="arrowUpRight" size={14} color={t.c.textSecondary} />
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  intro: { marginHorizontal: space.gutter, padding: 20, gap: 16, borderRadius: radius.xl, overflow: 'hidden' },
  introHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  introMark: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  stripWrap: { marginHorizontal: space.gutter },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 12, borderRadius: radius.xl, overflow: 'hidden' },
  mine: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  editMine: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: space.gutter, marginTop: space[9], marginBottom: space[4] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { minWidth: 26, height: 22, paddingHorizontal: 7, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  headAction: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 },
  rail: { paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 14, gap: 12 },
  state: { marginHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { height: 20, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: 'center' },
  meetup: { width: 248, minHeight: 148, padding: 16, gap: 8, borderRadius: radius.lg, overflow: 'hidden' },
  post: { marginHorizontal: space.gutter, padding: 16, gap: 8, borderRadius: radius.lg, overflow: 'hidden' },
  community: { width: 204, minHeight: 156, padding: 16, gap: 8, borderRadius: radius.lg, overflow: 'hidden' },
  well: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  emoji: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  links: { paddingHorizontal: space.gutter, marginTop: space[6], gap: 10 },
  linkWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden', maxWidth: '100%' },
});
