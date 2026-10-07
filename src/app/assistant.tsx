import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx, useLang, a11y } from '@/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventRow } from '@/components/cards/EventCards';
import { SessionCard } from '@/components/cards/ThingCards';
import { PageHeader } from '@/components/navigation/Headers';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { CityId } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { dateFor, INTENT_LABEL, parseCommand, planDay, type Command, type GeoIndex } from '@/features/ai/intent';
import { useVoice } from '@/features/ai/voice';
import { ServerResults } from '@/features/search/ServerResults';
import { createServerActivity, useRecommendations } from '@/features/server/activities';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const GEO: GeoIndex = {
  cities: Object.values(CITIES).map((c) => ({ id: c.id, name: c.name })),
  areas: Object.values(CITIES).flatMap((c) => c.areas.map((a) => ({ id: a.id, name: a.name, cityId: c.id }))),
};

const EXAMPLES = [
  'Find me something to do tonight near the Marina',
  'Create a padel session tomorrow at 7 PM in JLT',
  'Find me a beach club this Saturday',
  'What can I do tonight for 100 dirhams?',
  'Find girls who like padel',
];

const TIMES = ['07:00', '09:00', '12:30', '16:00', '18:00', '19:00', '20:00', '21:00'];

/** Logs the command for its owner (history, quality); never blocks the UI. */
function logCommand(c: Command, source: 'text' | 'voice', status: string, result?: { type: string; id: string }) {
  track(source === 'voice' ? 'VOICE_COMMAND' : 'AI_COMMAND', { intent: c.intent });
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id;
    if (!uid) return;
    supabase
      ?.from('ai_commands')
      .insert({ user_id: uid, source, input: c.input.slice(0, 500), intent: c.intent, entities: c.entities, status, result_type: result?.type ?? null, result_id: result?.id ?? null })
      .then(() => undefined);
  });
}

/**
 * IRLY assistant. Type or speak: "Create a padel session tomorrow at 7 PM in
 * JLT". The command engine extracts intent and details, shows them as an
 * editable card, and acts on real IRLY data. Anything that changes something
 * (create, join, switch city) waits for your confirmation.
 */
export default function Assistant() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const account = useAccount();
  const params = useLocalSearchParams<{ q?: string }>();
  const cityId = useCityId();
  const setCity = useStore((s) => s.setCity);
  const postPlan = useStore((s) => s.postPlan);
  const [text, setText] = useState('');
  const [cmd, setCmd] = useState<Command | null>(null);
  const [source, setSource] = useState<'text' | 'voice'>('text');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const started = useRef(false);

  const run = (input: string, from: 'text' | 'voice') => {
    if (!input.trim()) return;
    const c = parseCommand(input, GEO);
    setCmd(c);
    setSource(from);
    setText('');
    haptic('select');
    logCommand(c, from, 'parsed');
    // Navigation-only intents act at once; nothing to confirm.
    if (c.intent === 'OPEN_CALENDAR') router.push('/calendar');
    else if (c.intent === 'OPEN_VISA') router.push('/bali/guide/visa');
    else if (c.intent === 'WHERE_TO_LIVE') router.push('/bali/quiz');
    else if (c.intent === 'OPEN_SAVED') router.push('/saved');
  };

  // Opened with a question (deep link, Home search): answer it straight away.
  useEffect(() => {
    if (started.current || !params.q) return;
    started.current = true;
    const timer = setTimeout(() => run(params.q as string, 'text'), 0);
    return () => clearTimeout(timer);
  }, [params.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const voice = useVoice(lang, (heard) => run(heard, 'voice'));

  const mic = () => {
    if (voice.listening) return voice.stop();
    if (!voice.start()) {
      inputRef.current?.focus();
      toast('Tap the microphone on your keyboard to dictate', 'mic', 'brand');
    }
  };

  const edit = (patch: Partial<Command['entities']>) => setCmd((c) => (c ? { ...c, entities: { ...c.entities, ...patch } } : c));

  const targetCity = (cmd?.entities.cityId ?? cityId) as CityId;
  const city = CITIES[targetCity] ?? CITIES[cityId];

  const create = async () => {
    if (!cmd) return;
    const e = cmd.entities;
    const kind = Object.entries(ACTIVITIES).find(([k]) => k === e.activity)?.[1];
    const label = kind?.label ?? (e.activity ? e.activity[0].toUpperCase() + e.activity.slice(1) : 'Meetup');
    const area = e.areaId ?? city.areas[0].id;
    const areaLabel = city.areas.find((a) => a.id === area)?.name ?? city.name;
    const title = `${label} · ${areaLabel}`.slice(0, 80);
    const plan = {
      cityId: city.id,
      categoryId: (e.category ?? 'sport') as never,
      activityId: e.activity,
      title,
      place: areaLabel,
      privacy: 'public' as const,
      day: planDay(e.day),
      time: e.time ?? '19:00',
      spots: e.spots ?? 0,
      areaId: area,
      format: cmd.intent === 'CREATE_EVENT' ? ('event' as const) : ('session' as const),
      price: 0,
      currency: city.currency,
    };
    setBusy(true);
    try {
      // Server first: a failed create must not leave a plan on this phone.
      const id = account ? await createServerActivity(plan, dateFor(e.day, e.time, new Date(), city.utcOffset)) : null;
      postPlan(plan);
      haptic('success');
      track(cmd.intent === 'CREATE_EVENT' ? 'EVENT_CREATE' : 'ACTIVITY_CREATE', { category: e.category ?? 'other', via: source });
      logCommand(cmd, source, 'executed', id ? { type: 'activity', id } : undefined);
      // Signed out, the plan only exists on this phone: no shared chat was created.
      toast(id ? tx('{title} is live. Chat created', { title }) : tx('{title} saved on this phone. Sign in to share it', { title }), 'send', 'brand');
      setCmd(null);
      if (id) router.push(`/a/${id}`);
    } catch (err) {
      logCommand(cmd, source, 'failed');
      toast(err instanceof Error ? err.message : 'Could not create', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 16, paddingBottom: 32, gap: space[6] }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pad}>
            <Text variant="overline" tone="accent">
              IRLY assistant
            </Text>
            <Text variant="displayM" raw={Boolean(cmd)}>
              {cmd ? cmd.input : tx('What do you feel like doing?')}
            </Text>
          </View>

          {!cmd ? (
            <View style={[styles.pad, { gap: 10 }]}>
              {EXAMPLES.map((ex) => (
                <PressableScale key={ex} onPress={() => run(tx(ex), 'text')} haptic="select" scaleTo={0.98} style={[styles.example, { backgroundColor: t.c.surface }]} accessibilityLabel={ex}>
                  <Icon name="sparkles" size={16} color={t.c.textSecondary} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {ex}
                  </Text>
                </PressableScale>
              ))}
            </View>
          ) : (
            <Animated.View entering={FadeInDown.springify(420).dampingRatio(0.85)} style={{ gap: space[6] }}>
              <Understood cmd={cmd} cityName={city.name} areas={city.areas} onEdit={edit} />
              <Act cmd={cmd} cityId={city.id} busy={busy} onCreate={create} onSwitch={() => {
                setCity(targetCity);
                logCommand(cmd, source, 'executed');
                toast(tx('Now exploring {city}', { city: city.name }), 'globe', 'brand');
                router.replace('/');
              }} />
            </Animated.View>
          )}
        </ScrollView>

        <Glass style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]} intensity={60}>
          {voice.listening ? (
            <Text variant="bodyS" tone="secondary" numberOfLines={2} style={{ paddingHorizontal: 4 }}>
              {voice.partial || tx('Listening…')}
            </Text>
          ) : voice.error ? (
            <Text variant="caption" tone="secondary" style={{ paddingHorizontal: 4 }}>
              {voice.error}
            </Text>
          ) : null}
          <View style={styles.composerRow}>
            <View style={[styles.inputWrap, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={tx('Ask IRLY: padel tomorrow in JLT…')}
                placeholderTextColor={t.c.textTertiary}
                style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }}
                onSubmitEditing={() => run(text, 'text')}
                returnKeyType="go"
                maxLength={500}
                accessibilityLabel={a11y('Ask IRLY')}
              />
            </View>
            <PressableScale
              haptic="press"
              onPress={text.trim() ? () => run(text, 'text') : mic}
              scaleTo={0.85}
              style={[styles.send, { backgroundColor: voice.listening ? t.c.live : t.c.brand }]}
              accessibilityLabel={text.trim() ? 'Send' : voice.listening ? 'Stop listening' : 'Speak'}
            >
              <Icon name={text.trim() ? 'send' : voice.listening ? 'x' : 'mic'} size={20} color={t.c.onBrand} strokeWidth={2.2} />
            </PressableScale>
          </View>
        </Glass>
      </KeyboardAvoidingView>
      <PageHeader title="Assistant" />
    </View>
  );
}

/** What the engine understood, as chips you can change before acting. */
function Understood({ cmd, cityName, areas, onEdit }: { cmd: Command; cityName: string; areas: { id: string; name: string }[]; onEdit: (p: Partial<Command['entities']>) => void }) {
  const t = useTheme();
  const e = cmd.entities;
  const editable = cmd.intent === 'CREATE_ACTIVITY' || cmd.intent === 'CREATE_EVENT';
  return (
    <View style={[styles.card, { backgroundColor: t.c.surface }]}>
      <View style={styles.cardHead}>
        <Icon name="wand" size={18} color={t.c.text} />
        <Text variant="titleS">{INTENT_LABEL[cmd.intent]}</Text>
      </View>
      <View style={styles.wrap}>
        {e.activity ? <Chip size="sm" label={ACTIVITIES[e.activity as keyof typeof ACTIVITIES]?.label ?? e.activity} icon="activity" selected /> : null}
        <Chip size="sm" label={planDay(e.day)} icon="calendar" selected={Boolean(e.day)} />
        {e.time ? <Chip size="sm" label={e.time} icon="clock" selected /> : null}
        <Chip size="sm" label={areas.find((a) => a.id === e.areaId)?.name ?? cityName} icon="pin" selected={Boolean(e.areaId)} />
        {e.budget ? <Chip size="sm" label={`≤ ${e.budget}`} icon="banknote" selected /> : null}
        {e.spots ? <Chip size="sm" label={tx('{n} people', { n: e.spots })} icon="users" selected /> : null}
      </View>
      {editable ? (
        <View style={{ gap: 10 }}>
          <Text variant="caption" tone="tertiary">
            Change anything before confirming
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(['today', 'tomorrow', 'weekend', 'next_week'] as const).map((d) => (
              <Chip key={d} size="sm" label={planDay(d)} selected={(e.day ?? 'today') === d} onPress={() => onEdit({ day: d })} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIMES.map((h) => (
              <Chip key={h} size="sm" label={h} selected={(e.time ?? '19:00') === h} onPress={() => onEdit({ time: h })} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {areas.map((a) => (
              <Chip key={a.id} size="sm" label={a.name} selected={e.areaId === a.id} onPress={() => onEdit({ areaId: a.id })} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** The action for the intent, on real data. */
function Act({ cmd, cityId, busy, onCreate, onSwitch }: { cmd: Command; cityId: CityId; busy: boolean; onCreate: () => void; onSwitch: () => void }) {
  const router = useRouter();
  const e = cmd.entities;
  const content = getCityContent(cityId);
  const recs = useRecommendations(cityId);

  const local = useMemo(() => {
    const term = (e.activity ?? e.query ?? '').toLowerCase();
    const dayOk = (offset: number) => !e.day || (e.day === 'today' ? offset === 0 : e.day === 'tomorrow' ? offset === 1 : true);
    const areaOk = (areaId: string) => !e.areaId || areaId === e.areaId;
    const priceOk = (p: number) => !e.budget || p <= e.budget;
    const sessions = content.sessions.filter(
      (s) => dayOk(s.when.dayOffset) && areaOk(s.areaId) && priceOk(s.price) && (!term || s.kind === term || s.title.toLowerCase().includes(term) || cmd.intent === 'FIND_SOMETHING_TO_DO'),
    );
    const events = content.events.filter(
      (ev) => dayOk(ev.when.dayOffset) && priceOk(ev.price) && (!term || ev.title.toLowerCase().includes(term) || cmd.intent === 'FIND_SOMETHING_TO_DO'),
    );
    // Nearby first; if nothing is in that area, say so and show the rest.
    const near = events.filter((ev) => areaOk(ev.areaId));
    return { sessions: sessions.slice(0, 6), events: (near.length ? near : events).slice(0, 6), elsewhere: !near.length && Boolean(e.areaId) };
  }, [cmd, content, e]);

  if (cmd.intent === 'CREATE_ACTIVITY' || cmd.intent === 'CREATE_EVENT') {
    return (
      <View style={[styles.pad, { gap: 10 }]}>
        <Button label={cmd.intent === 'CREATE_EVENT' ? 'Create event' : 'Create activity'} icon="plus" full loading={busy} onPress={onCreate} />
        <Text variant="caption" tone="tertiary" align="center">
          It gets its own chat and appears in Home, Discover, the map and your calendar.
        </Text>
      </View>
    );
  }
  if (cmd.intent === 'CREATE_COMMUNITY') {
    return (
      <View style={styles.pad}>
        <Button label="Set up the community" icon="users" full onPress={() => router.push('/community/new')} />
      </View>
    );
  }
  if (cmd.intent === 'CHANGE_DESTINATION') {
    return (
      <View style={styles.pad}>
        <Button label={tx('Switch to {city}', { city: CITIES[(e.cityId ?? cityId) as CityId]?.name ?? '' })} icon="globe" full onPress={onSwitch} />
      </View>
    );
  }
  if (cmd.intent === 'FIND_MATCH') {
    return (
      <View style={styles.pad}>
        <Button label="Open IRLY Girl" icon="heartHandshake" full onPress={() => router.push('/girl')} />
      </View>
    );
  }
  if (cmd.intent === 'OPEN_MOMS') {
    return (
      <View style={styles.pad}>
        <Button label="Open IRLY Moms" icon="baby" full onPress={() => router.push('/girl')} />
        <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
          IRLY Moms is inside IRLY Girl: tap Moms at the top.
        </Text>
      </View>
    );
  }
  if (cmd.intent === 'FIND_RESTAURANT') {
    return (
      <View style={styles.pad}>
        <Button label="See ranked restaurants" icon="utensils" full onPress={() => router.push(`/eat?city=${e.cityId ?? cityId}${e.areaId ? `&area=${e.areaId}` : ''}`)} />
      </View>
    );
  }
  if (cmd.intent === 'FIND_PEOPLE') {
    return (
      <View style={styles.pad}>
        <Button label="Find people" icon="users" full onPress={() => router.push(`/match?intent=friends`)} />
      </View>
    );
  }

  const nothing = !recs.length && !local.sessions.length && !local.events.length;
  return (
    <View style={{ gap: space[6] }}>
      <ServerResults q={e.activity ?? e.placeKind?.replace('_', ' ') ?? e.query} cityId={cityId} />
      {cmd.intent === 'FIND_SOMETHING_TO_DO' && recs.length ? (
        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="overline" tone="tertiary">
            Recommended for you
          </Text>
          {recs.slice(0, 5).map((r) => (
            <Button key={r.id} label={r.title} variant="secondary" icon="calendar" full onPress={() => router.push(`/a/${r.id}`)} />
          ))}
        </View>
      ) : null}
      {local.sessions.length ? (
        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="overline" tone="tertiary">
            Sessions
          </Text>
          {local.sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </View>
      ) : null}
      {local.events.length ? (
        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="overline" tone="tertiary">
            {local.elsewhere ? 'Events elsewhere in the city' : 'Events'}
          </Text>
          {local.events.map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
        </View>
      ) : null}
      {nothing ? (
        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="body" tone="secondary">
            Nothing matches yet. Start it yourself: people nearby will see it.
          </Text>
          <Button label="Search everything" variant="secondary" icon="search" onPress={() => router.push(`/search?q=${encodeURIComponent(e.query)}`)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: space.gutter },
  example: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg },
  card: { marginHorizontal: space.gutter, padding: 16, borderRadius: radius.xl, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { paddingHorizontal: space.gutter, paddingTop: 10, gap: 8 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputWrap: { flex: 1, height: 50, borderRadius: 25, borderWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  send: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
