import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
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
  const [composer, setComposer] = useState(false);
  return (
    <Page
      overline={`${city.name} · right now`}
      title="IRL"
      subtitle={`What people around you are doing. Posts disappear after ${LIVE_TTL_MIN / 60} hours.`}
      bottomInset={120}
      overlay={
        <>
          <View style={styles.fab} pointerEvents="box-none">
            <Button label="Go live" icon="plus" haptic="press" onPress={() => setComposer(true)} />
          </View>
          <Composer visible={composer} onClose={() => setComposer(false)} />
        </>
      }
    >
      <View style={styles.list}>
        {lives.map((l, i) => (
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
          <Button label="Message" variant="secondary" icon="message" size="sm" onPress={() => router.push('/messages')} />
          <Button label="I'm coming" icon="pin" size="sm" onPress={() => toast(`${person.name.split(' ')[0]} will know you're on your way`, 'pin')} />
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          Your post · visible to people nearby
        </Text>
      )}
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
  actions: { flexDirection: 'row', gap: 8 },
  fab: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' },
  input: { minHeight: 96, borderRadius: radius.lg, padding: 16, fontFamily: font.medium, fontSize: 17, textAlignVertical: 'top' },
  preview: { height: 180, borderRadius: radius.lg },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
