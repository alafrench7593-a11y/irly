import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Badge, Field } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { a11y, t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useMembersList, type CommunityHeader, type CommunityRole, type Member } from './governance';

/**
 * Parts of a community's page: the facts under its name (faces, members,
 * activities coming up, official), the entry to its chat in Discussion, and
 * its members by role (Members tab, and « Manage the community »).
 */

/** Its faces `[A][B][C] +N`, the real member count, the activities coming up, and the official badge. */
export function CommunityFacts({ header, fallbackMembers, official }: { header: CommunityHeader | null; fallbackMembers: number; official: boolean }) {
  const members = header?.members ?? fallbackMembers;
  const faces = header?.faces;
  const upcoming = header?.upcomingActivities ?? null;
  const people = useMemo(() => (faces ?? []).slice(0, 3).map((f) => ({ id: f.userId, name: f.name, hue: hueOf(f.userId) })), [faces]);
  return (
    <View style={styles.facts}>
      {people.length ? <AvatarStack people={people} size={30} max={3} extra={Math.max(0, members - people.length)} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" numberOfLines={1}>
          {members === 1 ? tx('1 member') : tx('{n} members', { n: members })}
        </Text>
        {upcoming !== null ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {upcoming === 1 ? tx('1 activity coming up') : tx('{n} activities coming up', { n: upcoming })}
          </Text>
        ) : null}
      </View>
      {official ? <Badge kind="verified" label={tx('Official')} /> : null}
    </View>
  );
}

/** Discussion: the community's chat, one tap away. */
export function ChatEntry({ onOpen, isMember }: { onOpen: () => void; isMember: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.pad}>
      <PressableScale haptic="select" scaleTo={0.98} onPress={onOpen} style={styles.entry} accessibilityRole="button" accessibilityLabel="Open chat">
        <GlassLayer radius={radius.xl} />
        <View style={[styles.entryIcon, { backgroundColor: t.c.overlay }]}>
          <Icon name="message" size={20} color={t.c.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleS">Open chat</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {isMember ? tx('Talk with the members in the community chat') : tx('Join to talk in the community chat')}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={t.c.textSecondary} />
      </PressableScale>
    </View>
  );
}

export const ROLE_LABEL: Record<CommunityRole, string> = { owner: 'Creator', co_admin: 'Co-admin', moderator: 'Moderator', member: 'Member' };
const GROUPS: { role: CommunityRole; title: string }[] = [
  { role: 'owner', title: 'Creator' },
  { role: 'co_admin', title: 'Co-admins' },
  { role: 'moderator', title: 'Moderators' },
  { role: 'member', title: 'Members' },
];

/**
 * Members by role (creator, co-admins, moderators, members), with a search.
 * A tap opens her profile, or `onPick` (« Manage this member »).
 */
export function MemberList({ communityId, onPick, filter }: { communityId: string; onPick?: (m: Member) => void; filter?: (m: Member) => boolean }) {
  const t = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [search, setSearch] = useState('');
  const { members, loading, error } = useMembersList(communityId, search);
  const shown = filter ? members.filter(filter) : members;
  const groups = GROUPS.map((g) => ({ ...g, people: shown.filter((m) => m.role === g.role) })).filter((g) => g.people.length);
  return (
    <View style={[styles.pad, { gap: 12 }]}>
      <Field icon="search" value={search} onChangeText={setSearch} placeholder={tx('Search a member')} autoCorrect={false} autoCapitalize="none" accessibilityLabel={a11y('Search a member')} />
      {loading && !shown.length ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={60} radius={radius.lg} />
          ))}
        </View>
      ) : error && !shown.length ? (
        <Text variant="body" tone="secondary">
          {tx(error)}
        </Text>
      ) : !shown.length ? (
        <View style={[styles.empty, { overflow: 'hidden' }]}>
          <GlassLayer radius={radius.xl} />
          <Icon name="users" size={22} color={t.c.textSecondary} />
          <Text variant="body" tone="secondary" align="center">
            {search.trim() ? tx('No member matches this search') : tx('No members to show yet')}
          </Text>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.role} style={{ gap: 8 }}>
            <Text variant="overline" tone="secondary">
              {`${tx(g.title)} · ${g.people.length}`}
            </Text>
            {g.people.map((m, i) => (
              <Animated.View key={m.userId} entering={reduced ? undefined : enter.rise(Math.min(i, 6))}>
                <PressableScale
                  haptic="select"
                  scaleTo={0.98}
                  onPress={() => (onPick ? onPick(m) : router.push(`/person/${m.userId}`))}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={onPick ? tx('Manage {name}', { name: m.name }) : tx('Open {title}', { title: m.name })}
                >
                  <GlassLayer radius={radius.lg} />
                  <Avatar name={m.name} hue={hueOf(m.userId)} size={40} userId={m.userId} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="titleS" raw numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {tx(ROLE_LABEL[m.role])}
                    </Text>
                  </View>
                  <Icon name={onPick ? 'more' : 'chevronRight'} size={18} color={t.c.textSecondary} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, overflow: 'hidden' },
  entryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
});
