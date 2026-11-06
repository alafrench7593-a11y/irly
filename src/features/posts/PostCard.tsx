import { useRouter } from 'expo-router';
import { memo, useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { ActionBar } from '@/components/social/ActionBar';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { RichText } from '@/components/ui/RichText';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { LiveDot } from '@/components/ui/Controls';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { AdminBadge } from '@/features/admin/StaffBadge';
import { communityPhoto } from '@/features/community/official';
import { IrlyBadge } from '@/features/community/IrlyTools';
import { usePhotoLink } from '@/features/server/covers';
import type { Engagement, Target } from '@/features/server/engage';
import { t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * One post, the same in every universe (community pages, the Live, IRLY Girl):
 * who wrote it (photo and name, IRLY's badge for a post signed IRLY), where
 * (its community, with the community's photo, when the screen is not that
 * community's own page), when, the words, the photos or video, what it
 * leads to (an activity), then Like · Comment · Share · Save and one « ⋯ »
 * menu for everything else (edit, remove, pin, report, hide, create an
 * activity). Memoized: it renders again only when its own props change, so
 * scrolling a long feed stays smooth.
 */
export type PostOption = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type PostCommunity = { id: string; name: string; coverPath?: string | null; topic?: string | null; categoryId?: string | null };

export type PostLink = { id: string; title: string; when?: string | null; cta?: string };

type Eng = { get: (id: string) => Engagement; like: (id: string) => Promise<void>; save: (id: string) => Promise<void>; signedIn: boolean };

export type PostCardProps = {
  author: { id: string; name: string; mine: boolean; asIrly?: boolean };
  createdAt: number;
  pending?: boolean;
  edited?: boolean;
  /** Shown when the screen is not that community's own page. */
  community?: PostCommunity | null;
  /** More about where or for whom (a Live's place, who sees it). */
  meta?: string | null;
  /** A Live dot before the meta line. */
  live?: boolean;
  /** Pinned, Announcement, Question… above the words. */
  label?: { text: string; icon?: IconName } | null;
  body?: string;
  /** The post's id for its links and mentions (RichText); null while sending. */
  richId?: string | null;
  /** Bigger words when the post is only words (the Live). */
  bigText?: boolean;
  media?: ReactNode;
  /** Between the media and the actions (a poll, a plan suggestion). */
  children?: ReactNode;
  /** What the post leads to: its activity, or the one created from it. */
  link?: PostLink | null;
  /** Like · Comment · Share · Save; none while sending. */
  target?: Target | null;
  eng?: Eng;
  options?: PostOption[];
  /** Under the actions (add a friend…). */
  footer?: ReactNode;
  /** Quick controls beside the menu (a moderator's pin). */
  accessory?: ReactNode;
  /** Animation order in the list (first cards appear one after the other). */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

const LONG = 320;

export const PostCard = memo(function PostCard({
  author,
  createdAt,
  pending,
  edited,
  community,
  meta,
  live,
  label,
  body,
  richId,
  bigText,
  media,
  children,
  link,
  target,
  eng,
  options,
  footer,
  accessory,
  index = 0,
  style,
}: PostCardProps) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const reduced = useReducedMotion();
  const [more, setMore] = useState(false);
  const long = (body?.length ?? 0) > LONG;
  const openAuthor = useCallback(() => {
    if (!author.asIrly) router.push(`/person/${author.id}`);
  }, [author.asIrly, author.id, router]);
  const when = pending ? tx('Sending…') : timeAgo(Math.max(0, Math.round((now - createdAt) / 60000)));
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(260).delay(Math.min(index, 4) * 50)}
      style={[styles.card, { boxShadow: t.shadow.card }, style]}
    >
      <GlassLayer radius={radius.xl} />
      <View style={styles.head}>
        <PressableScale onPress={openAuthor} disabled={author.asIrly} haptic="select" scaleTo={0.94} accessibilityLabel={author.mine ? tx('My profile') : tx('Open {name}’s profile', { name: author.name })}>
          {author.asIrly ? <IrlyBadge size={40} /> : <ProfileAvatar name={author.name} hue={hueOf(author.id)} size={40} userId={author.id} />}
        </PressableScale>
        <View style={styles.who}>
          <View style={styles.nameRow}>
            {author.asIrly ? (
              <>
                <Text variant="titleS">IRLY</Text>
                <Icon name="badgeCheck" size={14} color={t.c.text} />
              </>
            ) : (
              <>
                <Text variant="titleS" raw numberOfLines={1} style={{ flexShrink: 1 }} onPress={openAuthor}>
                  {author.mine ? tx('You') : author.name}
                </Text>
                <AdminBadge userId={author.id} />
              </>
            )}
          </View>
          <View style={styles.metaRow}>
            {live ? <LiveDot size={6} color={t.c.live} /> : null}
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {[meta, when].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        {accessory}
        {options?.length && !pending ? <PostMenu options={options} /> : null}
      </View>

      {community ? <CommunityLine community={community} /> : null}

      {label ? (
        <View style={styles.labelRow}>
          {label.icon ? <Icon name={label.icon} size={13} color={t.c.textSecondary} /> : null}
          <Text variant="overline" tone="secondary">
            {label.text}
          </Text>
        </View>
      ) : null}

      {body ? (
        <View style={{ gap: 4 }}>
          <RichText text={body} variant={bigText && !media ? 'titleM' : 'body'} postId={richId ?? null} numberOfLines={long && !more ? 7 : undefined} />
          {long ? (
            <Text variant="label" tone="secondary" onPress={() => setMore((x) => !x)} accessibilityRole="button">
              {more ? tx('Show less') : tx('See more')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {media ? <Animated.View entering={reduced ? undefined : FadeIn.duration(200)}>{media}</Animated.View> : null}

      {edited ? (
        <Text variant="caption" tone="tertiary">
          {tx('Edited')}
        </Text>
      ) : null}

      {children}

      {link ? (
        <PressableScale onPress={() => router.push(`/a/${link.id}`)} haptic="select" scaleTo={0.98} style={[styles.link, { backgroundColor: t.c.overlay }]} accessibilityLabel={tx('Open {title}', { title: link.title })}>
          <View style={[styles.linkIcon, { backgroundColor: t.c.bg }]}>
            <Icon name="calendar" size={16} color={t.c.text} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleS" numberOfLines={1} raw>
              {link.title}
            </Text>
            {link.when ? (
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {link.when}
              </Text>
            ) : null}
          </View>
          <Text variant="label">{link.cta ?? tx('Join')}</Text>
        </PressableScale>
      ) : null}

      {target && eng && !pending ? (
        <View style={[styles.actions, { borderTopColor: t.c.line }]}>
          <ActionBar target={target} eng={eng} />
        </View>
      ) : null}
      {footer}
    </Animated.View>
  );
});

/** The community a post belongs to, with its photo: opens the community. */
const CommunityLine = memo(function CommunityLine({ community }: { community: PostCommunity }) {
  const router = useRouter();
  const cityId = useCityId();
  const uri = usePhotoLink(community.coverPath ?? null);
  const photo = communityPhoto(community.topic ?? null, community.categoryId ?? null, community.name);
  return (
    <PressableScale onPress={() => router.push(`/c/${community.id}`)} haptic="select" scaleTo={0.97} style={styles.community} accessibilityLabel={tx('Open {name}', { name: tx(community.name) })}>
      <Photo visual={{ photo, uri: uri ?? undefined }} light={CITIES[cityId].light} style={styles.communityPhoto} width={80} recyclingKey={`community-${community.id}`} />
      <Text variant="label" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {tx(community.name)}
      </Text>
      <Icon name="chevronRight" size={14} color="rgba(127,127,127,0.8)" />
    </PressableScale>
  );
});

/** « ⋯ »: every other action on the post, in a sheet (mounted only once opened). */
function PostMenu({ options }: { options: PostOption[] }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <PressableScale
        onPress={() => {
          setMounted(true);
          setOpen(true);
        }}
        haptic="select"
        hitSlop={10}
        scaleTo={0.88}
        style={styles.more}
        accessibilityRole="button"
        accessibilityLabel={tx('More options')}
      >
        <Icon name="more" size={18} color={t.c.textSecondary} />
      </PressableScale>
      {mounted ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title="Post">
          <View style={styles.menu}>
            {options.map((o) => (
              <PressableScale
                key={o.key}
                haptic="select"
                scaleTo={0.98}
                disabled={o.disabled}
                onPress={() => {
                  setOpen(false);
                  o.onPress();
                }}
                style={[styles.menuRow, { backgroundColor: t.c.overlay, opacity: o.disabled ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={tx(o.label)}
              >
                <Icon name={o.icon} size={18} color={o.destructive ? t.c.live : t.c.text} />
                <Text variant="titleS" color={o.destructive ? t.c.live : undefined}>
                  {o.label}
                </Text>
              </PressableScale>
            ))}
          </View>
        </Sheet>
      ) : null}
    </>
  );
}

/** A post-shaped placeholder while a feed loads (same paddings and frame). */
export function PostCardSkeleton({ media = true, style }: { media?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.head}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="42%" height={13} />
          <Skeleton width="26%" height={10} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Skeleton height={14} />
        <Skeleton height={14} width="78%" />
      </View>
      {media ? <Skeleton height={220} radius={radius.lg} /> : null}
      <View style={{ flexDirection: 'row', gap: 18 }}>
        <Skeleton width={44} height={20} />
        <Skeleton width={44} height={20} />
        <Skeleton width={24} height={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 16, gap: 12, overflow: 'hidden', backgroundColor: 'transparent' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  community: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', marginTop: -2 },
  communityPhoto: { width: 22, height: 22, borderRadius: 7, overflow: 'hidden' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  linkIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingTop: 10, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth },
  more: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  menu: { paddingHorizontal: space.gutter, gap: 8, paddingBottom: space[2] },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 52, borderRadius: radius.lg },
});
