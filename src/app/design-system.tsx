import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { IrlyLogo, IrlyWordmark } from '@/brand/IrlyLogo';
import { IrlyMark, type MarkState } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { PersonCard } from '@/components/cards/PeopleCards';
import { PlaceCard, ServiceCard, SessionCard } from '@/components/cards/ThingCards';
import { Page } from '@/components/layout/Page';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge, Chip, Field, IconButton, LiveDot, Segmented } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { PHOTO_IDS, type PhotoKey } from '@/data/photos';
import { getCityContent } from '@/data/repo';
import { scoreMatch } from '@/features/matching/match';
import { spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { lights, type LightId } from '@/theme/lights';
import { palettes, radius, space, type as typeScale, type TypeVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const PHOTO_KEYS = Object.keys(PHOTO_IDS) as PhotoKey[];

/** One sample per light: the photo it comes from, its sky and its accent. */
const LIGHT_SAMPLES: { id: LightId; label: string; photo: PhotoKey }[] = [
  ...(['dubai', 'abudhabi', 'sharjah', 'ajman', 'rak', 'fujairah', 'uaq', 'bali'] as const).map((id) => ({
    id: CITIES[id].light,
    label: CITIES[id].name,
    photo: CITIES[id].photo,
  })),
  ...(['thailand', 'singapore', 'london', 'paris'] as const).map((id) => ({
    id: DESTINATIONS[id].light,
    label: DESTINATIONS[id].shortName,
    photo: DESTINATIONS[id].photo,
  })),
];

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text variant="overline" tone="accent">
        {title}
      </Text>
      {note ? (
        <Text variant="bodyS" tone="secondary">
          {note}
        </Text>
      ) : null}
      <View style={{ gap: 12, marginTop: 6 }}>{children}</View>
    </View>
  );
}

export default function DesignSystem() {
  const t = useTheme();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const [mark, setMark] = useState<MarkState>('idle');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [chip, setChip] = useState(true);
  const [sheet, setSheet] = useState(false);
  const typeVariants = Object.keys(typeScale) as TypeVariant[];

  return (
    <Page overline="IRLY 2.0" title="Design System" subtitle="Minimal, premium, human, international. One system, a different light in every city.">
      <Block title="Brand · Common Ground" note="Two rings, two lives; the lens is where they meet. The mark has four motion states.">
        <View style={[styles.brandCard, { backgroundColor: '#000000' }]}>
          <IrlyMark size={96} state={mark} lensColor={palettes.night.brand} />
          <IrlyWordmark size={26} color="#FFFFFF" />
        </View>
        <View style={styles.wrap}>
          {(['idle', 'loading', 'success', 'static'] as MarkState[]).map((s) => (
            <Chip key={s} size="sm" label={s} selected={mark === s} onPress={() => setMark(s)} />
          ))}
        </View>
        <IrlyLogo size={18} />
      </Block>

      <Block title="Core colour" note={`Night and day palettes. The app switches with local time in ${city.name}.`}>
        {(['night', 'day'] as const).map((mode) => (
          <View key={mode} style={styles.swatches}>
            {(['bg', 'surface', 'raised', 'text', 'brand', 'live', 'positive', 'caution'] as const).map((k) => (
              <View key={k} style={{ alignItems: 'center', gap: 4, width: '25%', marginBottom: 10 }}>
                <View style={[styles.swatch, { backgroundColor: palettes[mode][k], borderColor: t.c.line }]} />
                <Text variant="caption" tone="tertiary">
                  {mode} · {k}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Block>

      <Block
        title="Destination lights"
        note="Each destination brings a real photograph and an accent taken from it. Core colours never change, so IRLY stays recognisable."
      >
        <View style={styles.lights}>
          {LIGHT_SAMPLES.map(({ id, label, photo }) => (
            <View key={id} style={{ width: '31%', gap: 6 }}>
              <Photo visual={{ photo }} light={id} width={300} style={styles.light} />
              <View style={styles.skyRow}>
                {lights[id].sky.map((c, i) => (
                  <View key={i} style={[styles.sky, { backgroundColor: c }]} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.dot, { backgroundColor: lights[id].accent }]} />
                <Text variant="caption" numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Block>

      <Block
        title="Photography"
        note={`All ${PHOTO_KEYS.length} photos used in the app, by key. Real photographs only (Unsplash licence), never illustrations. Swap any of them in data/photos.ts.`}
      >
        <View style={styles.lights}>
          {PHOTO_KEYS.map((key) => (
            <View key={key} style={{ width: '31%', gap: 4 }}>
              <Photo visual={{ photo: key }} light={city.light} width={300} style={styles.light} />
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {key}
              </Text>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Typography" note="Instrument Serif for human, editorial moments. Manrope for the interface.">
        {typeVariants.map((v) => (
          <View key={v} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            <Text variant="caption" tone="tertiary" style={{ width: 74 }}>
              {v}
            </Text>
            <Text variant={v} style={{ flex: 1 }} numberOfLines={1}>
              {v.startsWith('display') ? `Good evening, ${city.name}.` : v === 'number' ? '148' : 'Connect. Relocate. Belong.'}
            </Text>
          </View>
        ))}
      </Block>

      <Block title="Spacing & radius" note="4-pt grid, 20-pt gutters. Radius grows with surface size.">
        <View style={{ gap: 6 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text variant="caption" tone="tertiary" style={{ width: 30 }}>
                {space[k as keyof typeof space]}
              </Text>
              <View style={{ height: 8, width: (space[k as keyof typeof space] as number) * 3, borderRadius: 4, backgroundColor: t.c.brand }} />
            </View>
          ))}
        </View>
        <View style={styles.wrap}>
          {(Object.keys(radius) as (keyof typeof radius)[]).filter((k) => k !== 'pill').map((k) => (
            <View key={k} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 52, height: 52, borderRadius: radius[k], backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.lineStrong }} />
              <Text variant="caption" tone="tertiary">
                {k} {radius[k]}
              </Text>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Surfaces" note="Elevation is soft and directional; glass is reserved for chrome floating over content.">
        <View style={styles.wrap}>
          <View style={[styles.surface, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <Text variant="label">Surface</Text>
          </View>
          <View style={[styles.surface, { backgroundColor: t.c.raised, boxShadow: t.shadow.card }]}>
            <Text variant="label">Raised · card</Text>
          </View>
          <View style={[styles.surface, { backgroundColor: t.c.raised, boxShadow: t.shadow.float }]}>
            <Text variant="label">Float</Text>
          </View>
        </View>
        <Photo
          visual={{ photo: city.photo }}
          light={city.light}
          width={800}
          style={{ height: 120, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}
        >
          <Glass dark style={{ paddingHorizontal: 20, height: 52, borderRadius: radius.pill, justifyContent: 'center' }}>
            <Text variant="label" tone="onDark">
              Glass over a photo
            </Text>
          </Glass>
        </Photo>
      </Block>

      <Block title="Buttons">
        <Button label="Join" icon="plus" />
        <View style={styles.wrap}>
          <Button label="Secondary" variant="secondary" size="md" />
          <Button label="You're in" variant="done" icon="check" size="md" />
          <Button label="Ghost" variant="ghost" size="md" />
          <Button label="Small" size="sm" />
        </View>
        <View style={styles.wrap}>
          <IconButton icon="bookmark" label="Save" />
          <IconButton icon="message" label="Messages" badge={3} />
          <IconButton icon="share" label="Share" variant="brand" />
          <Button label="Loading" loading size="md" />
        </View>
      </Block>

      <Block title="Chips, badges, controls">
        <View style={styles.wrap}>
          <Chip label="Padel" icon="target" selected={chip} onPress={() => setChip(!chip)} />
          <Chip label="Surf" icon="waves" tone="accent" selected />
          <Chip label="Small" size="sm" />
        </View>
        <View style={styles.wrap}>
          <Badge kind="verified" />
          <Badge kind="pick" />
          <Badge kind="live" />
          <Badge kind="soon" />
          <Badge kind="positive" label="Joined" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LiveDot />
            <Text variant="caption" tone="live">
              Live
            </Text>
          </View>
        </View>
        <Segmented
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'a', label: 'Today' },
            { value: 'b', label: 'Tomorrow' },
            { value: 'c', label: 'Weekend' },
          ]}
        />
        <Field icon="search" placeholder="Search field" />
      </Block>

      <Block title="Avatars" note="Generated duotones until members add a photo. Online and verified states.">
        <View style={[styles.wrap, { alignItems: 'center' }]}>
          {content.people.slice(0, 4).map((p, i) => (
            <Avatar key={p.id} name={p.name} hue={p.hue} size={[64, 52, 44, 36][i]} online={i === 0} verified={i === 1} />
          ))}
          <AvatarStack people={content.people} size={30} max={4} extra={12} />
        </View>
      </Block>

      <Block title="Cards" note="Every card opens into its page: the photo becomes the header.">
        {content.events[0] ? <EventCard event={content.events[0]} width={290} /> : null}
        {content.sessions[0] ? <SessionCard session={content.sessions[0]} /> : null}
        {content.services[0] ? <ServiceCard service={content.services[0]} /> : null}
        <Rail itemWidth={210}>
          {content.places.slice(0, 3).map((p) => (
            <PlaceCard key={p.id} place={p} width={210} />
          ))}
        </Rail>
        {content.people[0] ? <PersonCard match={scoreMatch(profile, content.people[0], 'friends', () => city.name)} /> : null}
      </Block>

      <Block title="Motion" note="Tap a spring. Transform and opacity only; 60 fps on the UI thread.">
        {(Object.keys(spring) as (keyof typeof spring)[]).map((k) => (
          <SpringDemo key={k} name={k} />
        ))}
      </Block>

      <Block title="Overlays">
        <View style={styles.wrap}>
          <Button label="Bottom sheet" variant="secondary" size="md" onPress={() => setSheet(true)} />
          <Button label="Toast" variant="secondary" size="md" onPress={() => toast('Saved to your places', 'bookmark', 'brand')} />
        </View>
      </Block>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet" subtitle="Drag down, flick, or tap outside.">
        <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
          <Text variant="body" tone="secondary">
            Sheets follow the finger and dim the page in proportion to their position.
          </Text>
          <Button label="Close" onPress={() => setSheet(false)} full />
        </View>
      </Sheet>
    </Page>
  );
}

function SpringDemo({ name }: { name: keyof typeof spring }) {
  const t = useTheme();
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{name}</Text>
        <Text variant="caption" tone="tertiary">
          {spring[name].duration} ms · ζ {spring[name].dampingRatio}
        </Text>
      </View>
      <View
        style={[styles.track, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
        onTouchEnd={() => {
          x.set(withSequence(withTiming(0, { duration: 0 }), withSpring(220, spring[name])));
        }}
      >
        <Animated.View style={[styles.ball, { backgroundColor: t.c.brand }, style]}>
          <Icon name="zap" size={12} color="#FFFFFF" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: space.gutter, marginBottom: space[9], gap: 4 },
  brandCard: { height: 220, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: 22 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { width: 44, height: 44, borderRadius: 14, borderWidth: 1 },
  lights: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  light: { height: 70, borderRadius: radius.md },
  skyRow: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  sky: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  surface: { padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'transparent' },
  track: { height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center', paddingHorizontal: 6 },
  ball: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
