import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SessionCard, ActivityTile } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { BREAKPOINTS } from '@/components/layout/responsive';
import { PaneEmpty, SplitView } from '@/components/layout/SplitView';
import { Button } from '@/components/ui/Button';
import { Chip, SectionHeader } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { ACTIVITIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { ActivityKind } from '@/data/types';
import { useSessionSplit } from '@/features/activity/useSessionSplit';
import { DetailPane } from '@/features/hero/DetailPane';
import { openHero } from '@/features/hero/heroStore';
import { t as tx } from '@/i18n';
import { enter } from '@/motion/enter';
import { useCityId } from '@/state/store';
import { layout, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Space between tiles, and the narrowest a tile gets before the row takes one fewer. */
const GAP = 12;
const TILE_MIN = 104;

/** Height of the filter strip pinned under the header (wide screens). */
const STRIP = 56;

/**
 * Activities of the city: its kinds of activity, then the sessions coming up.
 *
 * Phones: the kinds as tiles (each opens its page), a session opens full
 * screen. Wide screens: list and detail side by side. The kinds become
 * filters pinned at the top of the list, always in view; the session picked
 * (the first one until you pick) shows on the right with Going / Maybe
 * pinned at the bottom of its pane.
 */
export default function Activities() {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [kind, setKind] = useState<ActivityKind | null>(null);
  const upcoming = [...content.sessions].sort((a, b) => a.when.dayOffset - b.when.dayOffset || a.when.time.localeCompare(b.when.time));
  const shown = kind ? upcoming.filter((s) => s.kind === kind) : upcoming;
  const { split, selected, select } = useSessionSplit(shown.map((s) => s.id));
  // Tiles a row from the width this page has: two on a narrow outer screen (three would break « Networking »
  // inside the word), three on phones, four or more on wide screens.
  const cols = frame.width < BREAKPOINTS.regular ? 2 : Math.max(3, Math.floor((frame.width - space.gutter * 2 + GAP) / (TILE_MIN + GAP)));
  const tile = (frame.width - space.gutter * 2 - GAP * (cols - 1)) / cols;

  const filters = (
    <View style={[styles.strip, { top: insets.top + layout.headerHeight + 8 }]}>
      <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
        <Chip size="sm" label="All activities" selected={kind === null} onPress={() => setKind(null)} />
        {city.activityKinds.map((k) => (
          <Chip key={k} size="sm" icon={ACTIVITIES[k].icon} label={ACTIVITIES[k].label} selected={kind === k} onPress={() => setKind(kind === k ? null : k)} />
        ))}
      </ScrollView>
      <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
    </View>
  );

  const detail = selected ? (
    // A link to another session of this list stays in the pane; anything else opens as usual.
    <DetailPane item={{ kind: 'session', id: selected }} onOpen={(item) => (item.kind === 'session' && shown.some((s) => s.id === item.id) ? select(item.id) : openHero(item))} />
  ) : (
    <PaneEmpty icon="calendar" title="Nothing planned yet" body={kind ? tx('Be the first to start a {what} plan in {city}.', { what: tx(ACTIVITIES[kind].label).toLowerCase(), city: city.name }) : undefined} />
  );

  return (
    <SplitView split={split} detail={detail}>
      <Page
        overline={city.name}
        title="Activities"
        subtitle={city.id === 'bali' ? 'Surf at dawn, yoga in the rice fields, padel at night.' : 'Find your people through the things you love doing.'}
        contentStyle={split ? { paddingTop: insets.top + layout.headerHeight + 12 + STRIP + space[4] } : undefined}
        overlay={split ? filters : null}
      >
        {split ? null : (
          <View style={styles.grid}>
            {city.activityKinds.map((k, i) => (
              <Animated.View key={k} entering={enter.pop(i, 40)}>
                <ActivityTile
                  kind={k}
                  city={city}
                  size={tile}
                  count={content.sessions.filter((s) => s.kind === k).length}
                  onPress={() => router.push(`/activities/${k}`)}
                />
              </Animated.View>
            ))}
          </View>
        )}
        <SectionHeader overline="Join a session" title="Coming up" style={split ? undefined : { marginTop: space[8] }} />
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          {split && kind ? (
            // The kind's own page (players to match with, its communities, start a plan) stays one tap away.
            <Button label={tx('All about {what}', { what: tx(ACTIVITIES[kind].label).toLowerCase() })} icon="arrowRight" size="sm" variant="secondary" onPress={() => router.push(`/activities/${kind}`)} />
          ) : null}
          {shown.map((s, i) => (
            <Animated.View key={s.id} entering={enter.rise(i, 120)}>
              <SessionCard session={s} onSelect={split ? select : undefined} selected={s.id === selected} />
            </Animated.View>
          ))}
        </View>
      </Page>
    </SplitView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: space.gutter },
  strip: { position: 'absolute', left: 0, right: 0, height: STRIP, zIndex: 9, justifyContent: 'center' },
  stripRow: { gap: 8, paddingHorizontal: space.gutter, alignItems: 'center' },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});
