import { useState, type ReactNode } from 'react';
import { t as tx } from '@/i18n';
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
import { JoinButton } from '@/components/ui/JoinButton';
import { HappeningRowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { PHOTO_IDS, type PhotoKey } from '@/data/photos';
import { getCityContent } from '@/data/repo';
import { scoreMatch } from '@/features/matching/match';
import { blur, motion, scale, spring, staggerStep } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { category, palettes, radius, space, status, type as typeScale, type TypeVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const PHOTO_KEYS = Object.keys(PHOTO_IDS) as PhotoKey[];

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text variant="overline" tone="secondary">
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
    <Page overline="IRLY 3.0" title="Design System" subtitle="Black and white. Colour only for categories, statuses and actions. Motion that links two states, never decoration.">
      <Block title="Brand · Common Ground" note="Two rings, two lives; the lens is where they meet. The mark has four motion states.">
        <View style={[styles.brandCard, { backgroundColor: '#0A0A0A' }]}>
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

      <Block title="Core colour" note="Black, white and four greys carry the whole interface. Depth comes from grey steps, hairlines and glass, not shadows.">
        <View style={styles.swatches}>
          {(['bg', 'surface', 'raised', 'overlay', 'textTertiary', 'textSecondary', 'text', 'glass'] as const).map((k) => (
            <View key={k} style={{ alignItems: 'center', gap: 4, width: '25%', marginBottom: 10 }}>
              <View style={[styles.swatch, { backgroundColor: palettes.night[k], borderColor: t.c.lineStrong }]} />
              <Text variant="caption" tone="tertiary">
                {k}
              </Text>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Categories & statuses" note="On an icon, a dot, a ring or a halo. Never as a background fill.">
        <View style={styles.swatches}>
          {(Object.keys(category) as (keyof typeof category)[]).map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '33%', marginBottom: 10 }}>
              <View style={[styles.dot, { width: 12, height: 12, borderRadius: 6, backgroundColor: category[k] }]} />
              <Text variant="caption">{k}</Text>
            </View>
          ))}
          {(Object.keys(status) as (keyof typeof status)[]).map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '33%', marginBottom: 10 }}>
              <View style={[styles.dot, { width: 12, height: 12, borderRadius: 6, backgroundColor: status[k] }]} />
              <Text variant="caption">{k}</Text>
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

      <Block title="Typography" note="One family, Manrope. Display for the one question of a screen, capitals for titles on photos.">
        {typeVariants.map((v) => (
          <View key={v} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            <Text variant="caption" tone="tertiary" style={{ width: 74 }}>
              {v}
            </Text>
            <Text variant={v} style={{ flex: 1 }} numberOfLines={1}>
              {v.startsWith('display') ? "What's happening today?" : v === 'cardTitle' ? 'Padel tonight' : v === 'number' ? '148' : 'Connect. Relocate. Belong.'}
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

      <Block title="Surfaces" note="White cards on off-white with soft shadows. Glass (white at 72 %, blur, bright hairline) is reserved for chrome floating over content: tab bar, headers, sheets, map controls.">
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
          <Chip label="Surf" dot={category.beach} />
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
        <Field icon="search" placeholder={tx('Search field')} />
      </Block>

      <Block title="Avatars" note="Initials on grey until members add a photo. Availability and verified states.">
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

      <Block title="Join" note="Pressed, spring, confirmation: the button settles into « You're going » with a check, a success haptic and a toast. Tap again to leave.">
        <JoinButton id="design-system-demo" full />
      </Block>

      <Block title="Loading" note="Skeletons with the geometry of the final component and a very soft sweep. Never a lone spinner.">
        <Skeleton height={180} radius={radius.xxl} />
        <HappeningRowSkeleton />
      </Block>

      <Block title="Motion · springs" note="Tap a track. Three springs cover the app: soft for surfaces that change shape, medium for things that travel, strong for feedback that should be felt.">
        {(['soft', 'medium', 'strong'] as const).map((k) => (
          <SpringDemo key={k} name={k} />
        ))}
      </Block>

      <Block title="Motion · tokens" note="Every animation reads from these. Transform and opacity only; blur never animates.">
        {[
          ['motion.fast / normal / slow', `${motion.fast} / ${motion.normal} / ${motion.slow} ms`],
          ['ease.standard / enter / exit', 'bezier(.2,0,0,1) / (.05,.7,.1,1) / (.3,0,.8,.15)'],
          ['ease.camera', 'bezier(.65,0,.15,1), 2D ↔ 3D'],
          ['scale.press / hover / selected', `${scale.press} / ${scale.hover} / ${scale.selected}`],
          ['blur.light / medium / strong', `${blur.light} / ${blur.medium} / ${blur.strong}`],
          ['stagger', `${staggerStep} ms per item, 6 at most`],
        ].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text variant="label">{k}</Text>
            <Text variant="caption" tone="secondary" style={{ flexShrink: 1 }} align="right">
              {v}
            </Text>
          </View>
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

function SpringDemo({ name }: { name: 'soft' | 'medium' | 'strong' }) {
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
          <Icon name="zap" size={12} color={t.c.onBrand} />
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
