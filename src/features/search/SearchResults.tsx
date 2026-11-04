import { StyleSheet, View } from 'react-native';
import { Rail } from '@/components/cards/Blocks';
import { EventRow } from '@/components/cards/EventCards';
import { PersonCard } from '@/components/cards/PeopleCards';
import { CommunityCard, PlaceCard, ServiceCard, SessionCard } from '@/components/cards/ThingCards';
import { gridCell, gridStyles } from '@/components/layout/grid';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { ActivitySession, CityId, Community, IrlEvent, Person, Place, ServiceProvider } from '@/data/types';
import { CITIES } from '@/data/destinations';
import { scoreMatch } from '@/features/matching/match';
import { ServerResults, type SearchHit } from '@/features/search/ServerResults';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type CityResults = {
  events: IrlEvent[];
  sessions: ActivitySession[];
  places: Place[];
  communities: Community[];
  services: ServiceProvider[];
  people: Person[];
};

/** What the side column of a wide search narrows the results to. */
export type ResultKind = 'all' | keyof CityResults;

export const RESULT_KINDS: { id: ResultKind; label: string; icon: IconName }[] = [
  { id: 'all', label: 'Everything', icon: 'search' },
  { id: 'events', label: 'Events', icon: 'calendar' },
  { id: 'sessions', label: 'Activities', icon: 'users' },
  { id: 'people', label: 'People', icon: 'user' },
  { id: 'places', label: 'Places', icon: 'pin' },
  { id: 'communities', label: 'Communities', icon: 'layers' },
  { id: 'services', label: 'Services', icon: 'badgeCheck' },
];

// The members' results of the server that belong to each kind (services have none there).
const SERVER_KINDS: Record<ResultKind, SearchHit['kind'][] | undefined> = {
  all: undefined,
  events: ['activity'],
  sessions: ['activity'],
  people: ['person'],
  places: ['place', 'area'],
  communities: ['community'],
  services: [],
};

/** Width of the side column of a wide search. */
export const FILTER_COLUMN = 280;

/** From this width (the space the search has), filters sit beside the results and results form a grid. */
export const SEARCH_WIDE = 760;

/**
 * Results of a search across the city guide, under the members' results
 * from the server. Narrow: sections one under the other, people, places
 * and communities in rails (as always). Wide (`width` given): every
 * section is a grid sized from that width, and `kind` keeps one section.
 */
export function SearchResults({ q, cityId, results, total, width, kind = 'all' }: { q: string; cityId: CityId; results: CityResults; total: number; width?: number; kind?: ResultKind }) {
  const profile = useStore((s) => s.profile);
  const city = CITIES[cityId];
  const wide = width !== undefined;
  const show = (k: keyof CityResults) => results[k].length > 0 && (kind === 'all' || kind === k);
  const match = (p: Person) => scoreMatch(profile, p, 'friends', (id) => city.areas.find((a) => a.id === id)?.name ?? city.name);
  // Wide: a grid of the width the results have, inside the page gutters.
  const inner = wide ? width - space.gutter * 2 : 0;
  const cell = (min: number, max = 3) => gridCell(inner, min, max, 12);

  return (
    <View style={{ gap: space[7] }}>
      <ServerResults q={q} cityId={cityId} only={SERVER_KINDS[kind]} cell={wide ? cell(300) : undefined} />
      <Text variant="bodyS" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
        {total ? tx('{n} results for “{q}” in the city guide', { n: total, q: q.trim() }) : tx('Nothing in the city guide for “{q}”. Try “run”, “dinner” or “visa”.', { q: q.trim() })}
      </Text>
      {show('events') ? (
        <Section title="Events">
          {wide ? (
            <Grid>
              {results.events.map((e) => (
                <View key={e.id} style={{ width: cell(300) }}>
                  <EventRow event={e} />
                </View>
              ))}
            </Grid>
          ) : (
            results.events.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </Section>
      ) : null}
      {show('sessions') ? (
        <Section title="Activities">
          {wide ? (
            <Grid>
              {results.sessions.map((s) => (
                <SessionCard key={s.id} session={s} width={cell(280)} />
              ))}
            </Grid>
          ) : (
            results.sessions.map((s) => <SessionCard key={s.id} session={s} />)
          )}
        </Section>
      ) : null}
      {show('people') ? (
        wide ? (
          <Section title="People">
            <Grid>
              {results.people.map((p) => (
                <PersonCard key={p.id} width={cell(280)} match={match(p)} />
              ))}
            </Grid>
          </Section>
        ) : (
          <Section title="People" rail>
            <Rail itemWidth={290}>
              {results.people.map((p) => (
                <PersonCard key={p.id} width={290} match={match(p)} />
              ))}
            </Rail>
          </Section>
        )
      ) : null}
      {show('places') ? (
        wide ? (
          <Section title="Places">
            <Grid>
              {results.places.map((p) => (
                <PlaceCard key={p.id} place={p} width={cell(200, 4)} />
              ))}
            </Grid>
          </Section>
        ) : (
          <Section title="Places" rail>
            <Rail itemWidth={200}>
              {results.places.map((p) => (
                <PlaceCard key={p.id} place={p} width={200} />
              ))}
            </Rail>
          </Section>
        )
      ) : null}
      {show('communities') ? (
        wide ? (
          <Section title="Communities">
            <Grid>
              {results.communities.map((c) => (
                <CommunityCard key={c.id} community={c} width={cell(240)} />
              ))}
            </Grid>
          </Section>
        ) : (
          <Section title="Communities" rail>
            <Rail itemWidth={250}>
              {results.communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          </Section>
        )
      ) : null}
      {show('services') ? (
        <Section title="Services">
          {wide ? (
            <Grid>
              {results.services.map((s) => (
                <View key={s.id} style={{ width: cell(320) }}>
                  <ServiceCard service={s} />
                </View>
              ))}
            </Grid>
          ) : (
            results.services.map((s) => <ServiceCard key={s.id} service={s} />)
          )}
        </Section>
      ) : null}
    </View>
  );
}

/** A section of results: its title, then its cards (a rail runs to the screen edges, so only its title is inset). */
function Section({ title, rail, children }: { title: string; rail?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10, paddingHorizontal: rail ? 0 : space.gutter }}>
      <Text variant="overline" tone="tertiary" style={rail ? { paddingHorizontal: space.gutter } : undefined}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <View style={[gridStyles.row, { gap: 12 }]}>{children}</View>;
}

/**
 * Side column of a wide search: what to show (with how many of each were
 * found in the city guide) and a few searches to try.
 */
export function SearchFilters({ results, total, kind, onKind, onTry }: { results: CityResults; total: number; kind: ResultKind; onKind: (k: ResultKind) => void; onTry: (q: string) => void }) {
  const t = useTheme();
  const count = (k: ResultKind) => (k === 'all' ? total : results[k].length);
  return (
    <View style={{ gap: space[5] }}>
      <View style={styles.panel}>
        <Glass level="regular" style={StyleSheet.absoluteFill} />
        <Text variant="overline" tone="tertiary" style={styles.panelTitle}>
          Show
        </Text>
        {RESULT_KINDS.map((k) => {
          const on = kind === k.id;
          const n = count(k.id);
          return (
            <PressableScale
              key={k.id}
              onPress={() => onKind(k.id)}
              haptic="select"
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${tx(k.label)}, ${n}`}
              style={[styles.kind, on ? { backgroundColor: t.c.brandSoft } : null]}
            >
              <Icon name={k.icon} size={16} color={on ? t.c.text : t.c.textSecondary} />
              <Text variant="label" tone={on ? 'primary' : 'secondary'} style={{ flex: 1 }} numberOfLines={1}>
                {k.label}
              </Text>
              <Text variant="caption" tone={n ? 'secondary' : 'tertiary'}>
                {n}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Text variant="overline" tone="tertiary">
          Try
        </Text>
        <View style={[gridStyles.row, { gap: 8 }]}>
          {TRY.map((w) => (
            <PressableScale key={w} onPress={() => onTry(tx(w))} haptic="select" style={[styles.try, { borderColor: t.c.line }]} accessibilityLabel={tx(w)}>
              <Text variant="caption" tone="secondary">
                {w}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>
    </View>
  );
}

const TRY = ['padel', 'rooftop', 'brunch', 'run', 'visa', 'coworking'];

const styles = StyleSheet.create({
  panel: { borderRadius: radius.xl, overflow: 'hidden', padding: 8, gap: 2 },
  panelTitle: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingHorizontal: 12, borderRadius: radius.md },
  try: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center' },
});
