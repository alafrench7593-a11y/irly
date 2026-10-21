import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';
import { useAccount } from '@/features/auth/account';
import { openCreate } from '@/features/create/createStore';
import { t as tx } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/state/store';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CommunityDetail } from './data';
import { introDraft, WELCOME_CHARTER } from './official';

/**
 * A community's welcome: the member's introduction (an editable draft for
 * the community chat, themed by the community, sent only by the member),
 * the charter of IRLY's official communities, and what an empty community
 * says. Nothing is posted for anyone, nothing is invented.
 */

/** Opens the community chat with the member's introduction ready to edit (null: no chat yet). */
export function useIntroduce(c: CommunityDetail, cityName: string): (() => void) | null {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  if (!c.isMember || !c.conversationId) return null;
  const conversationId = c.conversationId;
  return () => {
    const interests = profile.interests.map((i) => tx(INTERESTS[i]?.label ?? i));
    const activities = profile.activities.map((a) => {
      const label = ACTIVITIES[a as keyof typeof ACTIVITIES]?.label;
      return label ? tx(label) : null;
    }).filter((x): x is string => Boolean(x));
    const draft = introDraft(profile, cityName, interests, c.topic, activities);
    router.push({ pathname: '/messages/[id]', params: { id: conversationId, draft } });
  };
}

/**
 * Whether the member has already said something here (a message in the
 * community chat or a post): then the introduction is not asked again.
 * Unknown (loading, offline) counts as not yet, so the card simply shows.
 */
function useAlreadyIntroduced(communityId: string, conversationId: string | null): boolean {
  const uid = useAccount()?.userId;
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    const sb = supabase;
    Promise.all([
      conversationId ? sb.from('messages').select('id').eq('conversation_id', conversationId).eq('sender_id', uid).limit(1) : null,
      sb.from('community_posts').select('id').eq('community_id', communityId).eq('author_id', uid).is('deleted_at', null).limit(1),
    ]).then(
      ([m, p]) => {
        if (alive) setDone(Boolean(m?.data?.length || p.data?.length));
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [uid, communityId, conversationId]);
  return done;
}

/** The invitation to introduce oneself, once, for a member who has not said anything here yet. */
export function IntroCard({ c, cityName }: { c: CommunityDetail; cityName: string }) {
  const t = useTheme();
  const introduce = useIntroduce(c, cityName);
  const done = useAlreadyIntroduced(c.id, c.conversationId);
  if (!introduce || done) return null;
  const strong = c.introFirst;
  return (
    <Animated.View entering={FadeInDown.springify(480).dampingRatio(0.85)} style={{ padding: 16, borderRadius: radius.xl, gap: 12, backgroundColor: strong ? t.c.text : 'transparent', overflow: 'hidden' }}>
      {strong ? null : <GlassLayer radius={radius.xl} />}
      <Text variant="titleS" color={strong ? t.c.bg : undefined}>
        Introduce yourself
      </Text>
      <Text variant="bodyS" color={strong ? t.c.bg : undefined} tone={strong ? undefined : 'secondary'}>
        {strong ? 'Say hello and tell people what you’re looking for: it’s the fastest way to meet someone here.' : 'Tell the community a little about yourself.'}
      </Text>
      <Text variant="caption" color={strong ? t.c.bg : undefined} tone={strong ? undefined : 'tertiary'}>
        Optional: a few questions to start, edit or delete anything before sending. Never share your address or details about your children.
      </Text>
      <Button label="Introduce myself" icon="message" variant={strong ? 'inverse' : 'secondary'} onPress={introduce} />
    </Animated.View>
  );
}

/** Who an official community is for (its description), then how it works. */
export function WelcomeCharter({ c }: { c: CommunityDetail }) {
  const t = useTheme();
  return (
    <View style={{ padding: 16, borderRadius: radius.xl, gap: 8, backgroundColor: 'transparent', overflow: 'hidden' }}>
      <GlassLayer radius={radius.xl} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="users" size={16} color={t.c.text} />
        <Text variant="label" style={{ flex: 1 }}>
          Welcome
        </Text>
      </View>
      {c.description ? (
        <Text variant="bodyS" tone="secondary">
          {c.description}
        </Text>
      ) : null}
      {WELCOME_CHARTER.map((line) => (
        <Text key={line} variant="bodyS" tone="secondary">
          {`· ${tx(line)}`}
        </Text>
      ))}
    </View>
  );
}

/** A community with nothing posted yet: an invitation to start, with the two ways to. */
export function CommunityEmpty({ c, cityName }: { c: CommunityDetail; cityName: string }) {
  const t = useTheme();
  const introduce = useIntroduce(c, cityName);
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Icon name="message" size={22} color={t.c.textSecondary} />
      <Text variant="body" tone="secondary" align="center">
        {c.isMember
          ? 'Want to meet new people? Introduce yourself or suggest an activity. A coffee, a workout or an outing can be the start of a great encounter.'
          : 'No posts yet. Join to start the conversation.'}
      </Text>
      {c.isMember ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {introduce ? <Button label="Introduce myself" icon="message" variant="secondary" onPress={introduce} /> : null}
          <Button label="Suggest an activity" icon="plus" variant="secondary" onPress={() => openCreate(null, { communityId: c.id, cityId: c.cityId, communityName: c.official ? tx(c.name) : c.name, girlOnly: c.girlOnly || undefined })} />
        </View>
      ) : null}
    </View>
  );
}
