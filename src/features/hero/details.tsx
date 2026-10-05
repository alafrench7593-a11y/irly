import { memo, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge, Chip, Divider } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { JoinButton } from '@/components/ui/JoinButton';
import { RsvpControl } from '@/components/ui/Rsvp';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES, EVENT_CATEGORIES, LEVELS, PLACE_KINDS, SERVICE_CATEGORIES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import {
  findCommunity,
  findEvent,
  findPerson,
  findPlace,
  findService,
  findSession,
  getCityContent,
  goingCount,
  peopleByIds,
} from '@/data/repo';
import type { City, Visual } from '@/data/types';
import { MapArt } from '@/features/map/MapArt';
import { formatCount, formatPrice, plural, priceLevel } from '@/lib/format';
import { cityNow, durationLabel, whenLabel } from '@/lib/time';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { motion, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import type { LightId } from '@/theme/lights';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { HeroItem } from './heroStore';

export type Go = (href: string) => void;

/* ───────────────────────── Header model ───────────────────────── */

export type DetailHeader = {
  city: City;
  light: LightId;
  visual: Visual;
  overline: string;
  overlineIcon: IconName;
  title: string;
  meta: string;
  verified?: boolean;
  pick?: boolean;
};

export function getHeader(item: HeroItem): DetailHeader | null {
  switch (item.kind) {
    case 'event': {
      const e = findEvent(item.id);
      if (!e) return null;
      const city = CITIES[e.cityId];
      return {
        city,
        light: city.light,
        visual: e.visual,
        overline: EVENT_CATEGORIES[e.category].label,
        overlineIcon: EVENT_CATEGORIES[e.category].icon,
        title: e.title,
        meta: `${whenLabel(e.when, city)} · ${areaName(city, e.areaId)}`,
        verified: e.hostVerified,
      };
    }
    case 'session': {
      const s = findSession(item.id);
      if (!s) return null;
      const city = CITIES[s.cityId];
      const a = ACTIVITIES[s.kind];
      return {
        city,
        light: city.light,
        visual: s.visual ?? { photo: a.photo },
        overline: a.label,
        overlineIcon: a.icon,
        title: s.title,
        meta: `${whenLabel(s.when, city)} · ${areaName(city, s.areaId)}`,
      };
    }
    case 'place': {
      const p = findPlace(item.id);
      if (!p) return null;
      const city = CITIES[p.cityId];
      return {
        city,
        light: city.light,
        visual: p.visual,
        overline: PLACE_KINDS[p.kind].label,
        overlineIcon: PLACE_KINDS[p.kind].icon,
        title: p.name,
        meta: `${areaName(city, p.areaId)} · ${priceLevel(p.priceLevel)} · ★ ${p.rating.toFixed(1)}`,
        pick: p.irlyPick,
      };
    }
    case 'community': {
      const c = findCommunity(item.id);
      if (!c) return null;
      const city = CITIES[c.cityId];
      return {
        city,
        light: city.light,
        visual: c.visual,
        overline: 'Community',
        overlineIcon: 'users',
        title: c.name,
        meta: `${formatCount(c.members)} members · ${c.rhythm}`,
        verified: c.verified,
      };
    }
    case 'service': {
      const s = findService(item.id);
      if (!s) return null;
      const city = CITIES[s.cityId];
      const cat = SERVICE_CATEGORIES[s.category];
      return {
        city,
        light: city.light,
        visual: s.visual ?? { photo: cat.photo },
        overline: cat.label,
        overlineIcon: cat.icon,
        title: s.name,
        meta: `${s.tagline}`,
        verified: true,
      };
    }
    case 'editorial': {
      const cities = Object.values(CITIES);
      for (const city of cities) {
        const ed = getCityContent(city.id).editorials.find((x) => x.id === item.id);
        if (ed) {
          return {
            city,
            light: city.light,
            visual: ed.visual,
            overline: ed.kicker,
            overlineIcon: 'book',
            title: ed.title,
            meta: city.discoverTitle,
          };
        }
      }
      return null;
    }
  }
}

/* ───────────────────────── Building blocks ───────────────────────── */

function Section({ title, children, index = 0 }: { title?: string; children: ReactNode; index?: number }) {
  return (
    <Animated.View entering={enter.rise(index, 120)} style={styles.section}>
      {title ? (
        <Text variant="overline" tone="tertiary" style={{ marginBottom: space[4] }}>
          {title}
        </Text>
      ) : null}
      {children}
    </Animated.View>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: t.c.overlay }]}>
        <Icon name={icon} size={18} color={t.c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyS" tone="tertiary">
          {label}
        </Text>
        <Text variant="titleS">{value}</Text>
      </View>
    </View>
  );
}

function PersonRow({ personId, caption, go }: { personId: string; caption: string; go: Go }) {
  const t = useTheme();
  const p = findPerson(personId);
  if (!p) return null;
  return (
    <PressableScale onPress={() => go(`/person/${p.id}`)} style={[styles.personRow, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Avatar name={p.name} hue={p.hue} size={46} verified={p.verified} online={p.online} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyS" tone="tertiary">
          {caption}
        </Text>
        <Text variant="titleS">{p.name}</Text>
        <Text variant="bodyS" tone="secondary" numberOfLines={1}>
          {p.headline}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
    </PressableScale>
  );
}

function Going({ ids, extra, joined, go }: { ids: string[]; extra: number; joined: boolean; go: Go }) {
  const me = useStore((s) => s.profile.name);
  const people = peopleByIds(ids);
  const total = goingCount({ goingIds: ids, extraGoing: extra }, joined);
  const names = people.slice(0, 2).map((p) => p.name);
  const rest = total - names.length - (joined ? 1 : 0);
  const sentence = joined
    ? `You, ${names.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`
    : `${names.join(', ')}${rest > 0 ? ` and ${plural(rest, 'other')}` : ''}`;
  return (
    <View style={{ gap: space[4] }}>
      <View style={styles.goingRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {joined ? (
            // You join the stack: your avatar springs in at the front.
            <Animated.View entering={ZoomIn.springify(spring.strong.duration).dampingRatio(spring.strong.dampingRatio)} exiting={ZoomOut.duration(160)} style={{ zIndex: 10, marginRight: -11 }}>
              <Avatar name={me || 'You'} hue={0} size={34} ring />
            </Animated.View>
          ) : null}
          <AvatarStack people={people} size={34} max={5} extra={extra} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleS">{total} going</Text>
          <Text variant="bodyS" tone="secondary" numberOfLines={2}>
            {sentence}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {people.slice(0, 4).map((p) => (
          <Chip key={p.id} size="sm" label={p.name} icon="user" onPress={() => go(`/person/${p.id}`)} />
        ))}
      </View>
    </View>
  );
}

function Highlights({ items }: { items: string[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: space[4] }}>
      {items.map((h) => (
        <View key={h} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={[styles.check, { backgroundColor: t.c.brandSoft }]}>
            <Icon name="check" size={13} color={t.c.brand} strokeWidth={2.8} />
          </View>
          <Text variant="body" style={{ flex: 1 }}>
            {h}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function MiniMap({ city, areaId }: { city: City; areaId: string }) {
  const t = useTheme();
  const area = city.areas.find((a) => a.id === areaId) ?? city.areas[0];
  const w = 340;
  const h = 150;
  const vbW = 420;
  const vbH = vbW * (h / w);
  const x = Math.min(1000 - vbW, Math.max(0, area.point.x * 1000 - vbW / 2));
  const y = Math.min(1000 - vbH, Math.max(0, area.point.y * 1000 - vbH / 2));
  const px = ((area.point.x * 1000 - x) / vbW) * 100;
  const py = ((area.point.y * 1000 - y) / vbH) * 100;
  return (
    <View style={[styles.miniMap, { borderColor: t.c.line }]}>
      <View style={StyleSheet.absoluteFill}>
        <MapArt city={city} mode={t.mode} width={w * 2} height={h} viewBox={`${x} ${y} ${vbW} ${vbH}`} showAreas={false} />
      </View>
      <View style={[styles.pinWrap, { left: `${px}%`, top: `${py}%` }]}>
        <View style={[styles.pinHalo, { backgroundColor: t.light.accentSoft }]} />
        <View style={[styles.pin, { backgroundColor: t.c.brand, borderColor: t.c.bg }]} />
      </View>
      <View style={[styles.mapLabel, { backgroundColor: t.c.raised, borderColor: t.c.line }]}>
        <Icon name="pin" size={13} color={t.c.text} />
        <Text variant="label">{area.name}</Text>
      </View>
    </View>
  );
}

/* ───────────────────────── Bodies ───────────────────────── */

const EventBody = memo(function EventBody({ id, go }: { id: string; go: Go }) {
  const e = findEvent(id);
  const joined = useStore((s) => Boolean(s.joined[id]));
  if (!e) return null;
  const city = CITIES[e.cityId];
  return (
    <>
      <Section index={0}>
        <View style={{ gap: space[5] }}>
          <InfoRow icon="calendar" label="When" value={`${whenLabel(e.when, city)} · ${durationLabel(e.when.durationMin)}`} />
          <InfoRow icon="pin" label="Where" value={`${e.venue}`} />
          <InfoRow icon="ticket" label="Entry" value={`${formatPrice(e.price, city.currency)} · ${plural(e.capacity, 'spot')}`} />
        </View>
      </Section>
      <Section title="Who's going" index={1}>
        <Going ids={e.goingIds} extra={e.extraGoing} joined={joined} go={go} />
      </Section>
      <Section title="About" index={2}>
        <Text variant="bodyL" tone="secondary">
          {e.description}
        </Text>
      </Section>
      <Section title="Why it's worth it" index={3}>
        <Highlights items={e.highlights} />
      </Section>
      <Section title="Hosted by" index={4}>
        <HostCard name={e.host} verified={e.hostVerified} />
      </Section>
      <Section title="Location" index={5}>
        <MiniMap city={city} areaId={e.areaId} />
      </Section>
    </>
  );
});

function HostCard({ name, verified }: { name: string; verified: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.personRow, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Avatar name={name} hue={name.length * 37} size={46} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="titleS">{name}</Text>
        {verified ? <Badge kind="verified" label="Verified host" /> : <Badge kind="neutral" label="Community host" />}
      </View>
    </View>
  );
}

const SessionBody = memo(function SessionBody({ id, go }: { id: string; go: Go }) {
  const t = useTheme();
  const s = findSession(id);
  const joined = useStore((st) => Boolean(st.joined[id]));
  if (!s) return null;
  const city = CITIES[s.cityId];
  const going = goingCount(s, joined);
  const left = Math.max(0, s.spots - going);
  return (
    <>
      <Section index={0}>
        <View style={{ gap: space[5] }}>
          <InfoRow icon="calendar" label="When" value={`${whenLabel(s.when, city)} · ${durationLabel(s.when.durationMin)}`} />
          <InfoRow icon="pin" label="Where" value={s.venue} />
          <InfoRow icon="activity" label="Level" value={LEVELS[s.level]} />
        </View>
      </Section>
      <Section title="Spots" index={1}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="titleS">{left === 0 ? 'Full, join the waitlist' : `${plural(left, 'spot')} left`}</Text>
            <Text variant="bodyS" tone="secondary">
              {going}/{s.spots}
            </Text>
          </View>
          <View style={[styles.bar, { backgroundColor: t.c.overlay }]}>
            <View style={[styles.barFill, { width: `${Math.min(100, (going / s.spots) * 100)}%`, backgroundColor: left <= 2 ? t.c.live : t.c.brand }]} />
          </View>
        </View>
      </Section>
      <Section title="Who's playing" index={2}>
        <Going ids={s.goingIds} extra={s.extraGoing} joined={joined} go={go} />
      </Section>
      <Section title="Host" index={3}>
        <PersonRow personId={s.hostId} caption="Organised by" go={go} />
      </Section>
      <Section title="Location" index={4}>
        <MiniMap city={city} areaId={s.areaId} />
      </Section>
    </>
  );
});

const PlaceBody = memo(function PlaceBody({ id, go }: { id: string; go: Go }) {
  const p = findPlace(id);
  if (!p) return null;
  const city = CITIES[p.cityId];
  const content = getCityContent(p.cityId);
  const nearby = content.sessions.filter((s) => s.areaId === p.areaId).slice(0, 2);
  return (
    <>
      <Section index={0}>
        <Text variant="bodyL" tone="secondary">
          {p.blurb}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space[5] }}>
          {p.tags.map((tag) => (
            <Badge key={tag} kind="neutral" label={tag} />
          ))}
        </View>
      </Section>
      <Section index={1}>
        <View style={{ gap: space[5] }}>
          <InfoRow icon="pin" label="Area" value={areaName(city, p.areaId)} />
          <InfoRow icon="star" label="Members rate it" value={`${p.rating.toFixed(1)} / 5`} />
          <InfoRow icon="banknote" label="Price" value={priceLevel(p.priceLevel)} />
        </View>
      </Section>
      {nearby.length ? (
        <Section title="Happening around here" index={2}>
          <View style={{ gap: 10 }}>
            {nearby.map((s) => (
              <PressableScale key={s.id} onPress={() => go(`/hero/session/${s.id}`)}>
                <PlanRow icon={ACTIVITIES[s.kind].icon} title={s.title} meta={whenLabel(s.when, city)} />
              </PressableScale>
            ))}
          </View>
        </Section>
      ) : null}
      <Section title="Location" index={3}>
        <MiniMap city={city} areaId={p.areaId} />
      </Section>
    </>
  );
});

function PlanRow({ icon, title, meta }: { icon: IconName; title: string; meta: string }) {
  const t = useTheme();
  return (
    <View style={[styles.personRow, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <View style={[styles.infoIcon, { backgroundColor: t.light.accentSoft }]}>
        <Icon name={icon} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleS" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodyS" tone="secondary">
          {meta}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
    </View>
  );
}

const CommunityBody = memo(function CommunityBody({ id, go }: { id: string; go: Go }) {
  const c = findCommunity(id);
  const member = useStore((s) => Boolean(s.memberOf[id]));
  if (!c) return null;
  const people = peopleByIds(c.memberIds);
  return (
    <>
      <Section index={0}>
        <Text variant="bodyL" tone="secondary">
          {c.description}
        </Text>
      </Section>
      <Section title="Rhythm" index={1}>
        <InfoRow icon="repeat" label="Meets" value={c.rhythm} />
      </Section>
      <Section title="Members" index={2}>
        <View style={styles.goingRow}>
          <AvatarStack people={people} size={34} max={5} extra={c.members - people.length + (member ? 1 : 0)} />
          <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
            {member ? 'You and ' : ''}
            {people.map((p) => p.name).join(', ')} and {formatCount(c.members - people.length)} more
          </Text>
        </View>
        <View style={{ gap: 10, marginTop: space[5] }}>
          {people.slice(0, 2).map((p) => (
            <PersonRow key={p.id} personId={p.id} caption="Member" go={go} />
          ))}
        </View>
      </Section>
    </>
  );
});

function nextDays(city: City, count: number) {
  const base = cityNow(city);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getTime() + (i + 1) * 86400000);
    return { key: `${d.getUTCMonth()}-${d.getUTCDate()}`, label: i === 0 ? 'Tomorrow' : `${names[d.getUTCDay()]} ${d.getUTCDate()}` };
  });
}

const SLOTS = ['09:00', '10:30', '12:00', '14:30', '16:00', '18:30'];

const ServiceBody = memo(function ServiceBody({ id }: { id: string; go: Go }) {
  const t = useTheme();
  const s = findService(id);
  if (!s) return null;
  const city = CITIES[s.cityId];
  return (
    <>
      <Section index={0}>
        <Text variant="bodyL" tone="secondary">
          {s.description}
        </Text>
      </Section>
      <Section title="What's included" index={1}>
        <Highlights items={s.perks} />
      </Section>
      <Section title="Trust" index={2}>
        <View style={[styles.trustCard, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
          <View style={styles.trustItem}>
            <Text variant="number">{s.rating.toFixed(1)}</Text>
            <Text variant="bodyS" tone="secondary">
              {formatCount(s.reviews)} reviews
            </Text>
          </View>
          <View style={[styles.vr, { backgroundColor: t.c.line }]} />
          <View style={styles.trustItem}>
            <Icon name="shield" size={22} color={t.c.brand} />
            <Text variant="bodyS" tone="secondary">
              Verified by IRLY
            </Text>
          </View>
          <View style={[styles.vr, { backgroundColor: t.c.line }]} />
          <View style={styles.trustItem}>
            <Icon name="clock" size={22} color={t.c.text} />
            <Text variant="bodyS" tone="secondary" align="center">
              {s.responseTime.replace('Replies in ', '')}
            </Text>
          </View>
        </View>
      </Section>
      <Section title="Details" index={3}>
        <View style={{ gap: space[5] }}>
          <InfoRow icon="banknote" label="From" value={`${formatPrice(s.priceFrom, city.currency)} ${s.unit}`} />
          <InfoRow icon="languages" label="Languages" value={s.languages.join(' · ')} />
          <InfoRow icon="pin" label="Based in" value={`${areaName(city, s.areaId)} · serves all of ${city.name}`} />
        </View>
      </Section>
    </>
  );
});

const EditorialBody = memo(function EditorialBody({ id, go }: { id: string; go: Go }) {
  const header = getHeader({ kind: 'editorial', id });
  if (!header) return null;
  const content = getCityContent(header.city.id);
  const ed = content.editorials.find((x) => x.id === id);
  const places = content.places.filter((p) => !ed?.areaId || p.areaId === ed.areaId).slice(0, 3);
  return (
    <>
      <Section index={0}>
        <Text variant="displayM" style={{ marginBottom: space[4] }}>
          {ed?.body.split('.')[0]}.
        </Text>
        <Text variant="bodyL" tone="secondary">
          {ed?.body} Members who live here share what they love, what to skip and when to go. Save the places you like and IRLY will
          suggest plans around them.
        </Text>
      </Section>
      <Section title="Places in this story" index={1}>
        <View style={{ gap: 10 }}>
          {places.map((p) => (
            <PressableScale key={p.id} onPress={() => go(`/hero/place/${p.id}`)}>
              <PlanRow icon={PLACE_KINDS[p.kind].icon} title={p.name} meta={`${areaName(header.city, p.areaId)} · ★ ${p.rating}`} />
            </PressableScale>
          ))}
        </View>
      </Section>
    </>
  );
});

export function DetailBody({ item, go }: { item: HeroItem; go: Go }) {
  switch (item.kind) {
    case 'event':
      return <EventBody id={item.id} go={go} />;
    case 'session':
      return <SessionBody id={item.id} go={go} />;
    case 'place':
      return <PlaceBody id={item.id} go={go} />;
    case 'community':
      return <CommunityBody id={item.id} go={go} />;
    case 'service':
      return <ServiceBody id={item.id} go={go} />;
    case 'editorial':
      return <EditorialBody id={item.id} go={go} />;
  }
}

/* ───────────────────────── Call to action ───────────────────────── */

export function DetailCTA({ item, go }: { item: HeroItem; go: Go }) {
  const joined = useStore((s) => Boolean(s.joined[item.id]));
  const saved = useStore((s) => Boolean(s.saved[item.id]));
  const toggleSave = useStore((s) => s.toggleSave);
  const [booking, setBooking] = useState(false);

  const model = useMemo(() => {
    switch (item.kind) {
      case 'event': {
        const e = findEvent(item.id);
        if (!e) return null;
        const city = CITIES[e.cityId];
        return { price: formatPrice(e.price, city.currency), note: e.price ? 'per person' : 'members', kind: 'join' as const };
      }
      case 'session': {
        const s = findSession(item.id);
        if (!s) return null;
        const city = CITIES[s.cityId];
        return { price: formatPrice(s.price, city.currency), note: s.price ? 'per player' : 'community session', kind: 'join' as const };
      }
      case 'community': {
        const c = findCommunity(item.id);
        return c ? { price: 'Free', note: `${formatCount(c.members)} members`, kind: 'member' as const } : null;
      }
      case 'place':
        return { price: '', note: '', kind: 'save' as const };
      case 'service': {
        const s = findService(item.id);
        if (!s) return null;
        const city = CITIES[s.cityId];
        return { price: formatPrice(s.priceFrom, city.currency), note: s.unit, kind: 'book' as const };
      }
      case 'editorial':
        return { price: '', note: '', kind: 'save' as const };
    }
  }, [item]);

  if (!model) return null;

  const onSave = () => {
    const on = toggleSave(item.id);
    if (on) toast('Saved to your places', 'bookmark', 'brand');
  };

  if (model.kind === 'join') {
    return (
      <View style={{ gap: 12 }}>
        <RsvpControl id={item.id} />
        <View style={styles.ctaRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleS">{model.price}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {model.note}
            </Text>
          </View>
          {joined ? (
            <Animated.View entering={FadeIn.duration(motion.normal)} exiting={FadeOut.duration(motion.fast)}>
              <Button label="Group chat" variant="secondary" icon="message" size="md" onPress={() => go('/messages')} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.ctaRow}>
      {model.price ? (
        <View style={{ flex: 1 }}>
          <Text variant="titleM">{model.price}</Text>
          <Text variant="bodyS" tone="secondary" numberOfLines={1}>
            {model.note}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {model.kind === 'member' ? (
        <JoinButton id={item.id} membership label="JOIN GROUP" size="md" />
      ) : null}
      {model.kind === 'save' ? (
        <>
          <Button label={saved ? 'Saved' : 'Save'} variant={saved ? 'done' : 'secondary'} icon="bookmark" size="md" onPress={onSave} />
          {item.kind === 'place' ? (
            <Button label="Plan a meetup" icon="users" size="md" onPress={() => go('/match')} />
          ) : null}
        </>
      ) : null}
      {model.kind === 'book' ? (
        <>
          <Button label="Message" variant="secondary" icon="message" size="md" onPress={() => go('/messages')} />
          <Button label="Book a call" icon="calendar" size="md" onPress={() => setBooking(true)} />
          <BookingSheet serviceId={item.id} visible={booking} onClose={() => setBooking(false)} />
        </>
      ) : null}
    </View>
  );
}

function BookingSheet({ serviceId, visible, onClose }: { serviceId: string; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const s = findService(serviceId);
  const book = useStore((st) => st.book);
  const days = useMemo(() => (s ? nextDays(CITIES[s.cityId], 7) : []), [s]);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  if (!s) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Book a call" subtitle={`${s.name} · 20 min, free`}>
      <View style={{ gap: space[6], paddingBottom: space[3] }}>
        <View style={{ paddingHorizontal: space.gutter, gap: space[4] }}>
          <Text variant="overline" tone="tertiary">
            Day
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {days.map((d, i) => (
              <Chip key={d.key} label={d.label} selected={day === i} onPress={() => setDay(i)} size="sm" />
            ))}
          </View>
        </View>
        <View style={{ paddingHorizontal: space.gutter, gap: space[4] }}>
          <Text variant="overline" tone="tertiary">
            Time ({CITIES[s.cityId].name} time)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SLOTS.map((x) => (
              <Chip key={x} label={x} selected={slot === x} onPress={() => setSlot(x)} size="sm" />
            ))}
          </View>
        </View>
        <Divider />
        <View style={{ paddingHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
          <Icon name="shield" size={18} color={t.c.brand} />
          <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
            Free cancellation up to 24 h before. Your contact details stay private until you confirm.
          </Text>
        </View>
        <View style={{ paddingHorizontal: space.gutter }}>
          <Button
            label={slot ? `Confirm ${days[day]?.label} · ${slot}` : 'Pick a time'}
            disabled={!slot}
            full
            haptic={false}
            onPress={() => {
              if (!slot) return;
              book({ serviceId: s.id, dateLabel: days[day].label, slot });
              haptic('success');
              toast('Call booked. Check your messages', 'calendar');
              onClose();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: space.gutter, paddingTop: space[7] },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  goingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniMap: { height: 150, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2 },
  pinWrap: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  pinHalo: { position: 'absolute', width: 64, height: 64, borderRadius: 32 },
  pin: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  mapLabel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  trustItem: { flex: 1, alignItems: 'center', gap: 6 },
  vr: { width: StyleSheet.hairlineWidth * 2, height: 40 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
