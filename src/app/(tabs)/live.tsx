import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { InboxButtons } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { LiveRing } from '@/features/live/LiveStrip';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, LiveDot } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { areaName, CITIES } from '@/data/destinations';
import { findPerson } from '@/data/repo';
import { LIVE_TTL_MIN, useLives, useLiveStore, type Live } from '@/features/live/liveStore';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * IRL: what people around you are doing right now. Photo or text, tied to
 * a venue or a neighbourhood (never an address), gone after 4 hours. Every
 * post is an invitation: message the person or go there.
 */
export default function LiveScreen() {
  const cityId = useCityId();
  const city = CITIES[cityId];
  const lives = useLives();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const router = useRouter();
  const [manual, setManual] = useState(false);
  // Opened from Create → Live / Post: the composer is already up.
  const composer = manual || Boolean(compose);
  const setComposer = (on: boolean) => {
    setManual(on);
    if (!on && compose) router.setParams({ compose: undefined });
  };
  const bottom = useTabBarSpace();
  const connections = useStore((s) => s.connections);
  // Friends first: people you are connected with, then everyone around you.
  const sorted = [...lives].sort((a, b) => Number(connections[b.authorId] === 'connected') - Number(connections[a.authorId] === 'connected'));
  return (
    <Page
      back={false}
      overline={`${city.name} · right now`}
      title="IRL"
      subtitle={`What people around you are doing. Posts disappear after ${LIVE_TTL_MIN / 60} hours.`}
      right={<InboxButtons />}
      bottomInset={bottom + 70}
      overlay={
        <>
          <View style={[styles.fab, { bottom: bottom + 6 }]} pointerEvents="box-none">
            <Button label="Go live" icon="plus" haptic="press" onPress={() => setComposer(true)} />
          </View>
          <Composer visible={composer} onClose={() => setComposer(false)} />
        </>
      }
    >
      <View style={{ marginBottom: space[6] }}>
        <FriendsLiveNow />
      </View>
      <View style={styles.list}>
        {sorted.map((l, i) => (
          <Animated.View key={l.id} entering={enter.rise(i)} layout={LinearTransition.springify(spring.medium.duration)}>
            <LiveCard live={l} />
          </Animated.View>
        ))}
      </View>
    </Page>
  );
}

function LiveCard({ live }: { live: Live }) {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[live.cityId];
  const me = useStore((s) => s.profile.name) || 'You';
  const person = live.authorId === 'me' ? undefined : findPerson(live.authorId);
  const name = person?.name ?? me;
  const now = useNow();
  const minutes = Math.max(1, Math.round((now - live.postedAt) / 60_000));
  const hasPhoto = Boolean(live.photo || live.photoUri);
  return (
    <View style={[styles.card, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
      <View style={styles.head}>
        <Avatar name={name} hue={person?.hue ?? 0} size={40} online={person?.online} />
        <View style={{ flex: 1 }}>
          <Text variant="titleS">{name}</Text>
          <View style={styles.meta}>
            <LiveDot size={6} color={t.c.live} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {live.place} · {areaName(city, live.areaId)} · {timeAgo(minutes)}
            </Text>
          </View>
        </View>
      </View>
      {hasPhoto ? (
        live.photoUri ? (
          <Image source={{ uri: live.photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <Photo visual={{ photo: live.photo! }} light={city.light} style={styles.photo} width={800} recyclingKey={live.id} />
        )
      ) : null}
      <Text variant={hasPhoto ? 'body' : 'titleM'}>{live.text}</Text>
      {person ? (
        <View style={styles.actions}>
          <ReactButton id={live.id} />
          <Button label="Message" variant="secondary" icon="message" size="sm" onPress={() => router.push('/messages')} />
          <Button label="Join" icon="pin" size="sm" onPress={() => toast(`${person.name.split(' ')[0]} will know you're on your way`, 'pin')} />
          <PressableScale haptic="select" scaleTo={0.9} onPress={() => router.push(`/person/${person.id}`)} accessibilityLabel={`View ${person.name}'s profile`} style={[styles.round, { backgroundColor: t.c.overlay }]}>
            <Icon name="user" size={16} color={t.c.text} />
          </PressableScale>
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          Your post · visible to people nearby
        </Text>
      )}
    </View>
  );
}

/** One tap to react: the heart pops on `spring.strong`. */
function ReactButton({ id }: { id: string }) {
  const t = useTheme();
  const [on, setOn] = useState(false);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <PressableScale
      haptic={false}
      scaleTo={0.9}
      onPress={() => {
        setOn(!on);
        haptic(on ? 'tap' : 'success');
        pop.set(withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, spring.strong)));
      }}
      accessibilityLabel={on ? 'Remove reaction' : 'React'}
      accessibilityState={{ selected: on }}
      style={[styles.round, { backgroundColor: on ? `${t.c.live}1A` : t.c.overlay }]}
      testID={`react-${id}`}
    >
      <Animated.View style={style}>
        <Icon name="heart" size={16} color={on ? t.c.live : t.c.text} fill={on ? t.c.live : 'none'} />
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Friends live now: who you know is out, what they're doing and where
 * (a neighbourhood, never an address). Falls back to people around you
 * until you have connections.
 */
function FriendsLiveNow() {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const lives = useLives();
  const connections = useStore((s) => s.connections);
  const others = lives.filter((l) => l.authorId !== 'me');
  const friends = others.filter((l) => connections[l.authorId] === 'connected');
  const list = (friends.length ? friends : others).slice(0, 8);
  if (!list.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text variant="overline" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
        {friends.length ? 'Friends live now' : 'Live around you'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
        {list.map((l, i) => {
          const p = findPerson(l.authorId);
          if (!p) return null;
          return (
            <Animated.View key={l.id} entering={enter.pop(i, 60)}>
              <PressableScale
                haptic="select"
                scaleTo={0.96}
                onPress={() => router.push(`/person/${p.id}`)}
                style={[styles.friend, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}
                accessibilityLabel={`${p.name}, live: ${l.text}, ${areaName(city, l.areaId)}`}
              >
                <LiveRing size={48}>
                  <Avatar name={p.name} hue={p.hue} size={38} />
                </LiveRing>
                <View style={{ gap: 1, maxWidth: 120 }}>
                  <Text variant="label" numberOfLines={1}>
                    {p.name.split(' ')[0]}
                  </Text>
                  <View style={styles.meta}>
                    <LiveDot size={6} color={t.c.positive} />
                    <Text variant="caption" numberOfLines={1}>
                      {l.text.split(/[,.?!]/)[0]}
                    </Text>
                  </View>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {areaName(city, l.areaId)}
                  </Text>
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Composer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const post = useLiveStore((s) => s.post);
  const [text, setText] = useState('');
  const [area, setArea] = useState(city.areas[0].id);
  const [uri, setUri] = useState<string | undefined>();

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    if (!res.canceled && res.assets[0]) setUri(res.assets[0].uri);
  };

  const submit = () => {
    if (!text.trim()) return;
    post({ cityId, kind: uri ? 'photo' : 'text', text: text.trim(), photoUri: uri, place: areaName(city, area), areaId: area });
    haptic('success');
    toast("You're live for 4 hours", 'zap', 'live');
    setText('');
    setUri(undefined);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Go live" subtitle="What are you doing right now? Only your area is shown, never your address.">
      <View style={{ paddingHorizontal: space.gutter, gap: space[5] }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Coffee in the Marina, anyone?"
          placeholderTextColor={t.c.textTertiary}
          multiline
          maxLength={160}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel="What are you doing right now?"
        />
        {uri ? (
          <Animated.View entering={FadeIn}>
            <Image source={{ uri }} style={styles.preview} contentFit="cover" />
          </Animated.View>
        ) : null}
        <PressableScale haptic="select" onPress={pick} style={[styles.addPhoto, { borderColor: t.c.lineStrong }]} accessibilityLabel="Add a photo">
          <Icon name="camera" size={18} color={t.c.text} />
          <Text variant="label">{uri ? 'Change photo' : 'Add a photo'}</Text>
        </PressableScale>
        <View style={{ gap: 8 }}>
          <Text variant="overline" tone="tertiary">
            Where
          </Text>
          <View style={styles.wrap}>
            {city.areas.slice(0, 8).map((a) => (
              <Chip key={a.id} size="sm" label={a.name} icon="pin" selected={area === a.id} onPress={() => setArea(a.id)} />
            ))}
          </View>
        </View>
        <Button label="Post live" icon="zap" full haptic={false} disabled={!text.trim()} onPress={submit} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 14 },
  card: { borderRadius: radius.xl, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photo: { height: 220, borderRadius: radius.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fab: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderRadius: radius.xl },
  input: { minHeight: 96, borderRadius: radius.lg, padding: 16, fontFamily: font.medium, fontSize: 17, textAlignVertical: 'top' },
  preview: { height: 180, borderRadius: radius.lg },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
