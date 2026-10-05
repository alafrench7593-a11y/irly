import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { Trait } from '@/features/bali/fit';
import { useAreaProfiles, useDestAreas, usePlaces } from '@/features/bali/data';
import { useServerActivities } from '@/features/server/activities';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TRAITS: { id: Trait; label: string; invert?: boolean }[] = [
  { id: 'beach', label: 'Beach' },
  { id: 'surf', label: 'Surf' },
  { id: 'restaurants', label: 'Restaurants & coffee' },
  { id: 'coworking', label: 'Coworking' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'family', label: 'Families & schools' },
  { id: 'nature', label: 'Nature' },
  { id: 'social', label: 'Social scene' },
  { id: 'quiet', label: 'Calm' },
  { id: 'traffic', label: 'Traffic', invert: true },
  { id: 'airport', label: 'Airport access' },
];

const SECTIONS: { label: string; icon: 'utensils' | 'coffee' | 'laptop' | 'leaf' | 'baby' | 'shield' | 'waves' | 'home'; href: (area: string) => string }[] = [
  { label: 'Restaurants', icon: 'utensils', href: (a) => `/eat?area=${a}` },
  { label: 'With kids', icon: 'baby', href: (a) => `/eat?area=${a}&kids=1` },
  { label: 'Coworking', icon: 'laptop', href: () => '/search?q=coworking' },
  { label: 'Wellness', icon: 'leaf', href: () => '/search?q=yoga' },
  { label: 'Surf', icon: 'waves', href: () => '/search?q=surf' },
  { label: 'Healthcare', icon: 'shield', href: () => '/bali/guide/healthcare' },
  { label: 'Places to live', icon: 'home', href: () => '/bali/guide/housing' },
];

/**
 * One Bali area as a small IRLY of its own: the IRLY Guide profile
 * (editorial, labelled as such), then live content from members:
 * activities, places, and the way into its communities and IRLY Girl.
 */
export default function BaliArea() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const setCity = useStore((s) => s.setCity);
  const areas = useDestAreas('bali');
  const profiles = useAreaProfiles('bali');
  const area = areas.data.find((a) => a.id === id);
  const parent = area?.parentId ? areas.data.find((a) => a.id === area.parentId) : null;
  const profile = profiles.data.find((p) => p.areaId === id) ?? (parent ? profiles.data.find((p) => p.areaId === parent.id) : undefined);
  const hoods = areas.data.filter((a) => a.parentId === id);
  const { activities } = useServerActivities('bali');
  const here = activities.filter((a) => a.areaId === id || hoods.some((h) => h.id === a.areaId));
  const places = usePlaces('bali', { area: id });
  const name = area?.name ?? id;

  return (
    <Page
      overline={[area?.adminName ? tx('{name} regency', { name: area.adminName }) : null, parent ? tx('in {area}', { area: parent.name }) : null].filter(Boolean).join(' · ') || 'Bali'}
      title={name}
      subtitle={profile?.tagline}
    >
      <View style={{ gap: space[6] }}>
        <View style={styles.pad}>
          <Photo visual={{ photo: id === 'ubud' ? 'baliTemple' : id === 'uluwatu' || id === 'bingin' ? 'surf' : 'bali' }} light="bali" scrim="soft" style={[styles.hero, { borderRadius: radius.xl }]} width={900} />
        </View>

        {profile ? (
          <View style={[styles.pad, { gap: 14 }]}>
            {parent ? (
              <Text variant="caption" tone="tertiary">
                {tx('{name} is part of {area}: the guide below is for {area}.', { name, area: parent.name })}
              </Text>
            ) : null}
            <Text variant="body">{profile.vibe}</Text>
            <View style={styles.wrap}>
              {profile.bestFor.map((b) => (
                <Chip key={b} size="sm" icon="check" label={tx(b)} selected />
              ))}
              {profile.notIdealFor.map((b) => (
                <Chip key={b} size="sm" icon="x" label={tx(b)} />
              ))}
            </View>
            <View style={[styles.card, { backgroundColor: t.c.surface }]}>
              {TRAITS.map((tr) => {
                const v = profile.traits[tr.id];
                if (v == null) return null;
                return (
                  <View key={tr.id} style={styles.trait}>
                    <Text variant="bodyS" style={{ width: 150 }}>
                      {tx(tr.label)}
                    </Text>
                    <View style={[styles.bar, { backgroundColor: t.c.overlay }]}>
                      <View style={{ width: `${(v / 5) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: tr.invert && v >= 4 ? t.c.live : t.c.text }} />
                    </View>
                  </View>
                );
              })}
              <Text variant="caption" tone="tertiary">
                IRLY Guide: our editorial comparison, not official data. Reviewed regularly.
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              {profile.pros.map((p) => (
                <View key={p} style={styles.line}>
                  <Icon name="check" size={16} color={t.c.positive} />
                  <Text variant="bodyS" style={{ flex: 1 }}>
                    {tx(p)}
                  </Text>
                </View>
              ))}
              {profile.cons.map((p) => (
                <View key={p} style={styles.line}>
                  <Icon name="minus" size={16} color={t.c.live} />
                  <Text variant="bodyS" style={{ flex: 1 }}>
                    {tx(p)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {hoods.length ? (
          <View style={{ gap: 8 }}>
            <Text variant="label" tone="secondary" style={styles.pad}>
              Neighbourhoods
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
              {hoods.map((h) => (
                <Chip key={h.id} size="sm" label={h.name} icon="pin" onPress={() => router.push(`/bali/area/${h.id}`)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
          {SECTIONS.map((s) => (
            <Chip key={s.label} size="sm" icon={s.icon} label={tx(s.label)} onPress={() => router.push(s.href(id) as never)} />
          ))}
        </ScrollView>

        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM">{tx('Happening in {area}', { area: name })}</Text>
          {here.length ? (
            here.slice(0, 6).map((a) => (
              <PressableScale key={a.id} onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={a.title}>
                <Icon name="calendar" size={18} color={t.c.text} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleS" numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {new Date(a.startsAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {a.going} {tx('going')}
                  </Text>
                </View>
              </PressableScale>
            ))
          ) : (
            <Text variant="bodyS" tone="secondary">
              Nothing planned here yet. Be the first: people nearby will see it.
            </Text>
          )}
        </View>

        {places.data.length ? (
          <View style={{ gap: 10 }}>
            <Text variant="titleM" style={styles.pad}>
              {tx('Where to eat in {area}', { area: name })}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
              {places.data.slice(0, 10).map((p) => (
                <PressableScale key={p.id} onPress={() => router.push(`/place/${p.slug}`)} haptic="select" scaleTo={0.97} style={[styles.place, { backgroundColor: t.c.surface }]} accessibilityLabel={p.name}>
                  {p.photo ? <Image source={{ uri: p.photo }} style={styles.placePhoto} contentFit="cover" /> : <Photo visual={{ photo: 'dinner' }} light="bali" style={styles.placePhoto} width={400} />}
                  <View style={{ padding: 10, gap: 2 }}>
                    <Text variant="titleS" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {p.rating != null ? `★ ${p.rating.toFixed(1)} (${(p.reviewCount ?? 0).toLocaleString('en-US')})` : p.kind}
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.pad, { gap: 10 }]}>
          <Button
            label={tx('Explore {area} on IRLY', { area: name })}
            icon="compass"
            full
            onPress={() => {
              setCity('bali');
              router.push(`/search?q=${encodeURIComponent(name)}`);
            }}
          />
          <Button label="Communities" icon="users" variant="secondary" full onPress={() => router.push('/communities')} />
          <Button label="IRLY Girl in Bali" icon="heartHandshake" variant="secondary" full onPress={() => router.push('/girl')} />
          {area?.lat != null && area.lng != null ? (
            <Button label="Open in maps" icon="map" variant="ghost" full onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${area.lat},${area.lng}`)} />
          ) : null}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  hero: { height: 200, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { padding: 16, borderRadius: radius.xl, gap: 10 },
  trait: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  place: { width: 180, borderRadius: radius.lg, overflow: 'hidden' },
  placePhoto: { width: 180, height: 110 },
});
