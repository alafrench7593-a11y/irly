import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId, IrlEvent } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { displayCommunityName } from '@/features/community/name';
import { openCreate } from '@/features/create/createStore';
import { closeHero } from '@/features/hero/heroStore';
import { joinServerActivity } from '@/features/server/activities';
import { t as tx } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { presetFromEvent, useEventActivities, type EventActivity } from './goTogether';

/**
 * « Ils y vont ensemble » on an event's page: the plans members made to go
 * to it together (what the server lets this member see), each with its
 * count and a Join, and « Y aller ensemble » to make one, the form filled
 * from the event.
 */
export function GoTogether({ event, go }: { event: IrlEvent; go: (href: string) => void }) {
  const signedIn = Boolean(useAccount());
  const { items, loading, error, refresh } = useEventActivities(event.id);
  const start = () => {
    haptic('select');
    // The event card closes first: the activity page opens where the form sends it.
    closeHero();
    openCreate(null, presetFromEvent(event));
  };
  return (
    <View style={{ gap: space[4] }}>
      <Text variant="bodyS" tone="secondary">
        {items.length
          ? tx(items.length === 1 ? '{n} plan by members to go together' : '{n} plans by members to go together', { n: items.length })
          : signedIn
            ? loading
              ? tx('Looking for plans…')
              : error
                ? tx('Can’t reach IRLY right now')
                : tx('No plan yet. Start one and go with other members.')
            : tx('Sign in to see who is going together.')}
      </Text>
      {items.map((a) => (
        <PlanCard key={a.id} a={a} go={go} onChanged={refresh} />
      ))}
      <Button label="Go together" icon="users" variant="secondary" full onPress={start} accessibilityHint={tx('Creates an activity for this event')} />
    </View>
  );
}

function PlanCard({ a, go, onChanged }: { a: EventActivity; go: (href: string) => void; onChanged: () => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const city = CITIES[a.cityId as CityId] ?? CITIES.dubai;
  const going = a.myStatus === 'going';
  const full = a.capacity != null && a.going >= a.capacity && !going;
  const category = (a.categoryId in CATEGORY_BY_ID ? a.categoryId : 'entertainment') as CategoryKey;
  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await joinServerActivity(a.id);
      if (res === 'full') toast('Just filled up', 'x', 'live');
      else {
        haptic('success');
        toast("You're in. It's in your calendar and the chat is open", 'check', 'positive');
      }
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  const meta = [cityWhen(a.startsAt, a.cityId), a.placeName ?? areaName(city, a.areaId)].filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      <GlassLayer radius={radius.lg} />
      <PressableScale onPress={() => go(`/a/${a.id}`)} style={styles.main} accessibilityLabel={`${a.title}, ${meta}`}>
        <Photo visual={{ photo: ideaPhoto(category, a.title, a.placeName ?? undefined), uri: a.coverUrl }} light={city.light} width={200} style={styles.thumb} recyclingKey={a.id} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="titleS" raw numberOfLines={1}>
            {a.title}
          </Text>
          <Text variant="bodyS" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
          <View style={styles.row}>
            <Icon name="users" size={13} color={t.c.textSecondary} />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {a.capacity != null ? tx('{n}/{max} going', { n: a.going, max: a.capacity }) : tx('{n} going', { n: a.going })}
              {a.creatorName ? ` · ${tx('by {name}', { name: a.creatorName })}` : ''}
            </Text>
          </View>
          {a.girlOnly || a.communityName ? (
            <View style={styles.row}>
              {a.girlOnly ? <Badge kind="accent" label="Women only" /> : null}
              {a.communityName ? <Badge kind="neutral" label={tx('In {name}', { name: tx(displayCommunityName({ name: a.communityName })) })} /> : null}
            </View>
          ) : null}
        </View>
      </PressableScale>
      {going ? (
        <Button label="You're in" variant="done" size="sm" icon="check" onPress={() => go(`/a/${a.id}`)} />
      ) : (
        <Button label={full ? 'Full' : 'Join'} size="sm" disabled={full} loading={busy} onPress={join} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.lg, overflow: 'hidden' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
