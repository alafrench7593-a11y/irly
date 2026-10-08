import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStatus } from '@/features/auth/account';
import { t as tx, a11y } from '@/i18n';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/navigation/Headers';
import { ActionBar } from '@/components/social/ActionBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, Segmented } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES , INTERESTS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import type { LightId } from '@/theme/lights';
import { dateFor, planDay, type Day, type GeoIndex } from '@/features/ai/intent';
import { communityAssist, digestLines, postLooksLikeAPlan, type Assist, type PlanDraft } from '@/features/community/assist';
import { confirm } from '@/lib/confirm';
import { deleteCommunity, fetchDigest, joinCommunity, leaveCommunity, setCommunityMuted, useCommunity, type CommunityDetail, useCommunityActivities, useCommunityFeed, type CommunityPost } from '@/features/community/data';
import { createServerActivity } from '@/features/server/activities';
import { pickPhoto, setCommunityCover, usePhotoLink } from '@/features/server/covers';
import { communityPhoto, GUIDELINES, introDraft } from '@/features/community/official';
import { useStore } from '@/state/store';
import { Photo } from '@/components/visual/Photo';
import { openReport } from '@/features/moderation/reportStore';
import { useEngagement } from '@/features/server/engage';
import { track } from '@/lib/analytics';
import { hueOf } from '@/lib/format';
import { cityWhen, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'posts' | 'activities' | 'about';
const when = (ms: number, cityId: string) => cityWhen(ms, cityId);

/**
 * A community: posts (text, polls, plans) with likes and comments, its chat,
 * its activities, and a free assistant that plans an activity for the
 * group, drafts a poll, summarises the week or suggests what to post.
 * Join = you are in the chat too.
 */
export default function CommunityScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail: c, loading, error, refresh, signedIn } = useCommunity(id);
  const auth = useAuthStatus();
  const feed = useCommunityFeed(id);
  const acts = useCommunityActivities(id);
  const eng = useEngagement('community_post', feed.posts.filter((p) => !p.pending).map((p) => p.id));
  const [tab, setTab] = useState<Tab>('posts');
  const [busy, setBusy] = useState(false);
  // An assistant idea tapped goes into the post composer (n remounts it).
  const [idea, setIdea] = useState({ text: '', n: 0 });

  const city = c ? (CITIES[c.cityId as CityId] ?? CITIES.dubai) : CITIES.dubai;
  const geo: GeoIndex = useMemo(() => ({ cities: [{ id: city.id, name: city.name }], areas: city.areas.map((a) => ({ id: a.id, name: a.name, cityId: city.id })) }), [city]);

  if (auth === 'unknown') {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }
  if (!signedIn) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          Sign in to see this community
        </Text>
        <Button label="Sign in" onPress={() => router.push('/account')} />
      </Centered>
    );
  }
  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color={t.c.text} />
      </Centered>
    );
  }
  if (!c) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          {error ? 'Can’t reach IRLY right now' : 'This community is not available'}
        </Text>
        {error ? <Button label="Try again" onPress={refresh} /> : <Button label="Back" variant="secondary" onPress={() => router.back()} />}
      </Centered>
    );
  }

  const join = async () => {
    setBusy(true);
    try {
      await joinCommunity(c.id);
      haptic('success');
      toast(c.official ? tx('Welcome to {name} 👋', { name: c.name }) : tx('You joined {name}', { name: c.name }), 'users', 'brand');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  /** A plan from the assistant or a post: a real activity of this community, announced in the feed. */
  /** True once the activity exists; the announcement post is best effort. */
  const createPlan = async (d: PlanDraft): Promise<boolean> => {
    if (!c.isMember) {
      toast('Join the community first', 'users', 'brand');
      return false;
    }
    const area = d.areaId ?? city.areas[0].id;
    const areaLabel = city.areas.find((a) => a.id === area)?.name ?? city.name;
    try {
      const actId = await createServerActivity(
        { cityId: city.id, categoryId: (d.category ?? c.categoryId ?? undefined) as never, activityId: d.activity, title: d.title, place: areaLabel, privacy: 'community', day: planDay(d.day), time: d.time, spots: 0, areaId: area, format: 'meetup', price: 0, currency: city.currency },
        dateFor(d.day, d.time, new Date(), city.utcOffset),
        { communityId: c.id, girlOnly: c.girlOnly },
      );
      haptic('success');
      track('ACTIVITY_CREATE', { via: 'community' });
      acts.refresh();
      const announced = actId
        ? await feed
            .post({ body: tx('New plan: {title}, {when}. Join below 👇', { title: d.title, when: `${tx(planDay(d.day))} ${d.time}` }), activityId: actId })
            .then(() => true)
            .catch(() => false)
        : true;
      toast(announced ? tx('{title} is live. Chat created', { title: d.title }) : tx('Plan created, but it could not be posted in the community'), announced ? 'send' : 'x', announced ? 'brand' : 'live');
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create', 'x', 'live');
      return false;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 12, paddingBottom: insets.bottom + 40, gap: space[5] }} showsVerticalScrollIndicator={false}>
          <CommunityCover id={c.id} topic={c.topic ?? null} categoryId={c.categoryId} coverPath={c.coverPath} light={city.light} canEdit={c.myRole === 'owner' || c.myRole === 'moderator'} onChanged={refresh} />
          <View style={[styles.pad, { gap: 6 }]}>
            <Text variant="overline" tone="accent">
              {[c.official ? tx('IRLY Community') : null, city.name, c.girlOnly ? 'IRLY Girl' : null].filter(Boolean).join(' · ')}
            </Text>
            <Text variant="displayM">{c.name}</Text>
            {c.tagline ? (
              <Text variant="body" tone="secondary">
                {c.tagline}
              </Text>
            ) : null}
            <Text variant="caption" tone="tertiary">
              {tx('{n} members', { n: c.members })}
            </Text>
          </View>

          <View style={[styles.pad, styles.row]}>
            {c.isMember ? (
              <>
                <View style={{ flex: 1 }}>
                  <Button label="Open chat" icon="message" full onPress={() => (c.conversationId ? router.push(`/messages/${c.conversationId}`) : join())} />
                </View>
                {c.myRole === 'owner' ? (
                  c.official ? null : (
                    <Button
                      label="Delete"
                      variant="danger"
                      onPress={() =>
                        confirm('Delete this community? It disappears for everyone, and its chat leaves every inbox.', () =>
                          deleteCommunity(c.id)
                            .then(() => {
                              toast('Community deleted', 'check', 'brand');
                              if (router.canGoBack()) router.back();
                              else router.replace('/communities');
                            })
                            .catch((e) => toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live')),
                        )
                      }
                    />
                  )
                ) : (
                  <Button
                    label="Leave"
                    variant="secondary"
                    onPress={() =>
                      leaveCommunity(c.id)
                        .then(() => {
                          toast('You left the community', 'check', 'brand');
                          refresh();
                        })
                        .catch(() => toast('Could not leave', 'x', 'live'))
                    }
                  />
                )}
              </>
            ) : (
              <Button label="Join the community" icon="users" full loading={busy} onPress={join} />
            )}
          </View>

          {c.official ? <OfficialBlock c={c} cityName={city.name} onMuted={refresh} /> : null}

          <View style={styles.pad}>
            <Segmented
              options={[
                { value: 'posts', label: tx('Posts') },
                { value: 'activities', label: tx('Activities') },
                { value: 'about', label: tx('About') },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>

          {tab === 'posts' ? (
            <>
              <Assistant communityId={c.id} name={c.name} categoryId={c.categoryId} geo={geo} isMember={c.isMember} onPlan={createPlan} onPoll={(question, options) => feed.post({ body: question, poll: options })} onIdea={(text) => setIdea((x) => ({ text, n: x.n + 1 }))} />
              {c.isMember ? <Composer key={idea.n} initial={idea.text} onPost={(body, poll) => feed.post({ body, poll })} /> : null}
              {feed.error && !feed.posts.length ? (
                <Text variant="body" tone="secondary" style={styles.pad}>
                  Can’t reach IRLY right now. Check your connection.
                </Text>
              ) : !feed.loading && !feed.posts.length ? (
                <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
                  <Icon name="message" size={22} color={t.c.textSecondary} />
                  <Text variant="body" tone="secondary" align="center">
                    {c.isMember ? 'No posts yet. Say hi or ask the assistant for ideas.' : 'No posts yet. Join to start the conversation.'}
                  </Text>
                </View>
              ) : (
                feed.posts.map((p) => (
                  <PostCard
                    cityId={city.id}
                    key={p.id}
                    p={p}
                    eng={eng}
                    canModerate={c.myRole === 'owner' || c.myRole === 'moderator'}
                    isMember={c.isMember}
                    plan={!p.activityId && c.isMember ? postLooksLikeAPlan(p.body, geo) : null}
                    onVote={(o) => feed.vote(p, o).catch((e) => toast(e instanceof Error ? e.message : 'Could not vote', 'x', 'live'))}
                    onRemove={() => feed.remove(p).then(() => toast('Post removed', 'check', 'brand')).catch(() => toast('Could not remove', 'x', 'live'))}
                    onPlan={(d) => createPlan({ ...d, title: `${d.title} · ${c.name}`.slice(0, 80) })}
                  />
                ))
              )}
            </>
          ) : null}

          {tab === 'activities' ? (
            <View style={[styles.pad, { gap: 10 }]}>
              {acts.activities.length ? (
                acts.activities.map((a) => (
                  <PressableScale key={a.id} onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={a.title}>
                    <Icon name="calendar" size={18} color={t.c.text} />
                    <View style={{ flex: 1 }}>
                      <Text variant="titleS" numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {when(a.startsAt, city.id)} · {a.going} {tx('going')}
                      </Text>
                    </View>
                  </PressableScale>
                ))
              ) : (
                <Text variant="body" tone="secondary">
                  Nothing planned yet. Ask the assistant: “organise padel Saturday 9am”.
                </Text>
              )}
            </View>
          ) : null}

          {tab === 'about' ? (
            <View style={[styles.pad, { gap: 10 }]}>
              <Text variant="body">{c.description ?? c.tagline ?? tx('A community on IRLY.')}</Text>
              <Text variant="caption" tone="tertiary">
                Members post, plan activities and talk in the community chat. Be kind: posts can be reported and removed by the community’s hosts.
              </Text>
              <Button
                label="Report this community"
                icon="flag"
                variant="ghost"
                onPress={() => openReport({ kind: 'community', id: c.id })}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <PageHeader title={c.name} />
    </View>
  );
}

/* ───────── Assistant ───────── */

function Assistant({
  communityId,
  name,
  categoryId,
  geo,
  isMember,
  onPlan,
  onPoll,
  onIdea,
}: {
  communityId: string;
  name: string;
  categoryId: string | null;
  geo: GeoIndex;
  isMember: boolean;
  onPlan: (d: PlanDraft) => Promise<boolean>;
  onPoll: (question: string, options: string[]) => Promise<void>;
  onIdea: (text: string) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Assist | null>(null);
  const [posting, setPosting] = useState(false);
  const [digest, setDigest] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = (input: string) => {
    const r = communityAssist(input, { communityName: name, categoryId, geo, activityLabel: (id) => ACTIVITIES[id as keyof typeof ACTIVITIES]?.label });
    setResult(r);
    setDigest(null);
    setDraft(r.kind === 'plan' ? r.draft : null);
    track('AI_COMMAND', { scope: 'community', kind: r.kind });
    if (r.kind === 'digest') {
      fetchDigest(communityId)
        .then((d) => setDigest(digestLines(d, (ms) => when(ms, geo.cities[0]?.id ?? 'dubai'), tx)))
        .catch(() => setDigest(['Can’t reach IRLY right now.']));
    }
  };

  const chips = ['Organise padel Saturday 9am', 'Poll: Saturday or Sunday?', "What's new this week?", 'Post ideas'];

  return (
    <View style={[styles.assist, { backgroundColor: t.c.surface }]}>
      <View style={styles.row}>
        <Icon name="sparkles" size={18} color={t.c.text} />
        <Text variant="titleS" style={{ flex: 1 }}>
          Community assistant
        </Text>
        <Text variant="caption" tone="tertiary">
          Free
        </Text>
      </View>
      <View style={[styles.inputWrap, { borderColor: t.c.line, backgroundColor: t.c.bg }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={tx('Ask: organise brunch Sunday 11am…')}
          placeholderTextColor={t.c.textTertiary}
          style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 }}
          onSubmitEditing={() => text.trim() && ask(text)}
          returnKeyType="go"
          accessibilityLabel={a11y('Ask the community assistant')}
        />
        <PressableScale onPress={() => text.trim() && ask(text)} haptic="select" hitSlop={8} accessibilityLabel="Ask">
          <Icon name="send" size={18} color={t.c.text} />
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {chips.map((q) => (
          <Chip key={q} size="sm" label={tx(q)} onPress={() => ask(tx(q))} />
        ))}
      </ScrollView>

      {result?.kind === 'plan' && draft ? (
        <Animated.View entering={FadeInDown.springify(380)} style={{ gap: 10 }}>
          <Text variant="titleS">{draft.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(['today', 'tomorrow', 'sat', 'sun', 'next_week'] as Day[]).map((d) => (
              <Chip key={d} size="sm" label={d === 'sat' ? tx('Saturday') : d === 'sun' ? tx('Sunday') : tx(planDay(d))} selected={(draft.day ?? 'today') === d} onPress={() => setDraft({ ...draft, day: d })} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['08:00', '09:00', '11:00', '16:00', '18:00', '19:30'].map((h) => (
              <Chip key={h} size="sm" label={h} selected={draft.time === h} onPress={() => setDraft({ ...draft, time: h })} />
            ))}
          </ScrollView>
          <Button
            label={isMember ? 'Create it for the community' : 'Join to create it'}
            icon="plus"
            full
            loading={busy}
            disabled={!isMember || busy}
            onPress={async () => {
              if (busy) return;
              setBusy(true);
              const asked = result;
              const typed = text;
              const ok = await onPlan(draft);
              setBusy(false);
              if (!ok) return;
              // Clear only this plan: a question asked meanwhile keeps its answer.
              setResult((r) => (r === asked ? null : r));
              setText((x) => (x === typed ? '' : x));
            }}
          />
        </Animated.View>
      ) : null}

      {result?.kind === 'poll' ? (
        <View style={{ gap: 8 }}>
          <Text variant="titleS">{result.question}</Text>
          <Text variant="bodyS" tone="secondary">
            {result.options.join(' · ')}
          </Text>
          <Button
            label={isMember ? 'Post this poll' : 'Join to post'}
            icon="send"
            full
            loading={posting}
            disabled={!isMember || posting}
            onPress={() => {
              if (posting) return;
              setPosting(true);
              const asked = result;
              const typed = text;
              onPoll(result.question, result.options)
                .then(() => {
                  setResult((r) => (r === asked ? null : r));
                  setText((x) => (x === typed ? '' : x));
                })
                .catch((e) => toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live'))
                .finally(() => setPosting(false));
            }}
          />
        </View>
      ) : null}

      {result?.kind === 'digest' ? (
        <View style={{ gap: 4 }}>
          {(digest ?? ['…']).map((l) => (
            <Text key={l} variant="bodyS">
              {l}
            </Text>
          ))}
        </View>
      ) : null}

      {result?.kind === 'ideas' ? (
        <View style={{ gap: 8 }}>
          {result.ideas.map((i) => (
            <PressableScale key={i} onPress={() => onIdea(tx(i))} haptic="select" style={[styles.idea, { borderColor: t.c.line }]} accessibilityLabel={i}>
              <Text variant="bodyS">{tx(i)}</Text>
            </PressableScale>
          ))}
          <Text variant="caption" tone="tertiary">
            Tap one, then post it below.
          </Text>
        </View>
      ) : null}

      {result?.kind === 'help' ? (
        <Text variant="bodyS" tone="secondary">
          Try: “organise padel Saturday 9am”, “poll: Saturday or Sunday?”, “what’s new this week?” or “post ideas”.
        </Text>
      ) : null}
    </View>
  );
}

/* ───────── Composer ───────── */

function Composer({ initial = '', onPost }: { initial?: string; onPost: (body: string, poll: string[] | null) => Promise<void> }) {
  const t = useTheme();
  const [body, setBody] = useState(initial);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await onPost(body, poll);
      haptic('success');
      setBody('');
      setPoll(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.pad, { gap: 8 }]}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={tx('Write to the community…')}
        placeholderTextColor={t.c.textTertiary}
        multiline
        maxLength={2000}
        style={[styles.composer, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
        accessibilityLabel={a11y('Write a post')}
      />
      {poll ? (
        <View style={{ gap: 6 }}>
          {poll.map((o, i) => (
            <TextInput
              key={i}
              value={o}
              onChangeText={(v) => setPoll(poll.map((x, j) => (j === i ? v.slice(0, 60) : x)))}
              placeholder={tx('Option {n}', { n: i + 1 })}
              placeholderTextColor={t.c.textTertiary}
              style={[styles.option, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
              accessibilityLabel={tx('Poll option {n}', { n: i + 1 })}
            />
          ))}
          {poll.length < 6 ? <Chip size="sm" icon="plus" label={tx('Add option')} onPress={() => setPoll([...poll, ''])} /> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <Chip size="sm" icon="layers" label={poll ? tx('Remove poll') : tx('Add a poll')} selected={Boolean(poll)} onPress={() => setPoll(poll ? null : ['', ''])} />
        <View style={{ flex: 1 }} />
        <Button label="Post" icon="send" size="sm" loading={busy} disabled={!body.trim()} onPress={send} />
      </View>
    </View>
  );
}

/* ───────── Post ───────── */

function PostCard({
  p,
  eng,
  canModerate,
  isMember,
  plan,
  onVote,
  onRemove,
  onPlan,
  cityId,
}: {
  p: CommunityPost;
  eng: ReturnType<typeof useEngagement>;
  canModerate: boolean;
  isMember: boolean;
  plan: PlanDraft | null;
  onVote: (o: number) => void;
  onRemove: () => void;
  onPlan: (d: PlanDraft) => void;
  cityId: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const total = p.pollCounts.reduce((n, x) => n + x, 0);
  return (
    <Animated.View entering={FadeInDown.springify(360).dampingRatio(0.85)} style={[styles.card, { backgroundColor: t.c.surface, marginHorizontal: space.gutter }]}>
      <View style={styles.row}>
        <Avatar name={p.firstName} hue={hueOf(p.authorId)} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="titleS">{p.mine ? tx('You') : p.firstName}</Text>
          <Text variant="caption" tone="tertiary">
            {p.pending ? tx('Sending…') : timeAgo(Math.max(0, Math.round((now - p.createdAt) / 60000)))}
          </Text>
        </View>
        {p.mine || canModerate ? (
          <PressableScale onPress={onRemove} haptic="select" hitSlop={8} accessibilityLabel="Remove post">
            <Icon name="x" size={18} color={t.c.textTertiary} />
          </PressableScale>
        ) : (
          <PressableScale
            onPress={() => openReport({ kind: 'community_post', id: p.id, userId: p.authorId }, p.firstName)}
            haptic="select"
            hitSlop={8}
            accessibilityLabel="Report post"
          >
            <Icon name="flag" size={16} color={t.c.textTertiary} />
          </PressableScale>
        )}
      </View>
      <Text variant="body" raw>
        {p.body}
      </Text>

      {p.poll ? (
        <View style={{ gap: 6 }}>
          {p.poll.options.map((o, i) => {
            const n = p.pollCounts[i] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            const mine = p.myVote === i;
            return (
              <PressableScale key={o + i} onPress={() => isMember && onVote(i)} haptic="select" scaleTo={0.98} style={[styles.pollRow, { borderColor: mine ? t.c.text : t.c.line }]} accessibilityLabel={tx('Vote: {option}', { option: o })}>
                <View style={[StyleSheet.absoluteFill, { width: `${pct}%`, backgroundColor: t.c.overlay, borderRadius: radius.md }]} />
                <Text variant="label" style={{ flex: 1 }}>
                  {o}
                </Text>
                <Text variant="caption" tone="secondary">
                  {pct}%
                </Text>
              </PressableScale>
            );
          })}
          <Text variant="caption" tone="tertiary">
            {tx('{n} votes', { n: total })}
          </Text>
        </View>
      ) : null}

      {p.activityId ? (
        <PressableScale onPress={() => router.push(`/a/${p.activityId}`)} haptic="select" scaleTo={0.98} style={[styles.linked, { backgroundColor: t.c.bg }]} accessibilityLabel={p.activityTitle ? tx('Open {title}', { title: p.activityTitle }) : tx('Open the activity')}>
          <Icon name="calendar" size={18} color={t.c.text} />
          <View style={{ flex: 1 }}>
            <Text variant="titleS" numberOfLines={1}>
              {p.activityTitle ?? tx('Activity')}
            </Text>
            {p.activityStartsAt ? (
              <Text variant="caption" tone="tertiary">
                {when(p.activityStartsAt, cityId)}
              </Text>
            ) : null}
          </View>
          <Text variant="label">{tx('Join')}</Text>
        </PressableScale>
      ) : plan ? (
        <Button label={tx('Make it an activity: {title}', { title: plan.title })} icon="calendar" size="sm" variant="secondary" onPress={() => onPlan(plan)} />
      ) : null}

      {!p.pending ? <ActionBar target={{ type: 'community_post', id: p.id, title: p.body.slice(0, 60) }} eng={eng} /> : null}
    </Animated.View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.centered, { backgroundColor: t.c.bg }]}>{children}</View>;
}

/**
 * IRLY's own communities: say hello first (strongly suggested for
 * newcomers), the house rules, and the member's controls (mute, report).
 */
function OfficialBlock({ c, cityName, onMuted }: { c: CommunityDetail; cityName: string; onMuted: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const [rules, setRules] = useState(!c.isMember);
  const introduce = () => {
    if (!c.conversationId) return;
    const draft = introDraft(profile, cityName, profile.interests.map((i) => tx(INTERESTS[i]?.label ?? i)));
    router.push({ pathname: '/messages/[id]', params: { id: c.conversationId, draft } });
  };
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      {c.isMember ? (
        <Animated.View entering={FadeInDown.springify(480).dampingRatio(0.85)} style={[styles.card, { backgroundColor: c.introFirst ? t.c.text : t.c.surface }]}>
          <Text variant="titleS" color={c.introFirst ? t.c.bg : undefined}>
            Introduce yourself
          </Text>
          <Text variant="bodyS" color={c.introFirst ? t.c.bg : undefined} tone={c.introFirst ? undefined : 'secondary'}>
            {c.introFirst ? 'Say hello and tell people what you’re looking for: it’s the fastest way to meet someone here.' : 'Tell the community a little about yourself.'}
          </Text>
          <Button label="Introduce myself" icon="message" variant={c.introFirst ? 'inverse' : 'secondary'} onPress={introduce} />
        </Animated.View>
      ) : null}
      <PressableScale haptic="select" onPress={() => setRules((x) => !x)} style={[styles.card, { backgroundColor: t.c.surface }]} accessibilityRole="button" accessibilityState={{ expanded: rules }} accessibilityLabel="Community guidelines">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="shield" size={16} color={t.c.text} />
          <Text variant="label" style={{ flex: 1 }}>
            Keep IRLY welcoming
          </Text>
          <Icon name={rules ? 'chevronUp' : 'chevronDown'} size={16} color={t.c.textTertiary} />
        </View>
        {rules
          ? GUIDELINES.map((g) => (
              <Text key={g} variant="bodyS" tone="secondary">
                {`· ${tx(g)}`}
              </Text>
            ))
          : null}
      </PressableScale>
      {c.isMember && c.conversationId ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={c.muted ? 'Unmute chat' : 'Mute chat'}
            icon={c.muted ? 'bell' : 'bellOff'}
            variant="ghost"
            onPress={() =>
              setCommunityMuted(c.conversationId!, !c.muted)
                .then(() => {
                  toast(c.muted ? 'Chat notifications on' : 'Chat muted', 'check', 'brand');
                  onMuted();
                })
                .catch(() => toast('Could not change it', 'x', 'live'))
            }
          />
          <Button label="Report" icon="flag" variant="ghost" onPress={() => openReport({ kind: 'community', id: c.id })} />
        </View>
      ) : null}
    </View>
  );
}

/** The community's photo: its own, or the app's photo for its category. The owner and moderators can change it. */
function CommunityCover({ id, topic, categoryId, coverPath, light, canEdit, onChanged }: { id: string; topic: string | null; categoryId: string | null; coverPath: string | null; light: LightId; canEdit: boolean; onChanged: () => void }) {
  const uri = usePhotoLink(coverPath);
  const [saving, setSaving] = useState(false);
  const fallback = communityPhoto(topic, categoryId) ?? 'meeting';
  const change = async (next: 'pick' | 'reset') => {
    if (saving) return;
    try {
      const picked = next === 'pick' ? await pickPhoto() : null;
      if (next === 'pick' && !picked) return;
      setSaving(true);
      await setCommunityCover(id, picked);
      haptic('success');
      toast(next === 'pick' ? 'Photo updated' : 'Back to the IRLY photo', 'check', 'brand');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the photo', 'x', 'live');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.pad}>
      <Photo visual={{ photo: fallback, uri: uri ?? undefined }} light={light} scrim="soft" style={styles.coverPhoto} width={1000} recyclingKey={`community-${id}-${coverPath ?? 'app'}`}>
        {canEdit ? (
          <View style={styles.coverActions}>
            <PressableScale haptic="select" onPress={() => change('pick')} style={styles.coverPill} accessibilityLabel="Change the photo">
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon name="camera" size={16} color="#FFFFFF" />}
              <Text variant="label" style={{ color: '#FFFFFF' }}>
                Change the photo
              </Text>
            </PressableScale>
            {coverPath ? (
              <PressableScale haptic="select" onPress={() => change('reset')} style={styles.coverPill} accessibilityLabel="Use the IRLY photo">
                <Icon name="x" size={16} color="#FFFFFF" />
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </Photo>
    </View>
  );
}

const styles = StyleSheet.create({
  coverPhoto: { height: 190, borderRadius: radius.xl, overflow: 'hidden' },
  coverActions: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  coverPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)' },
  root: { flex: 1 },
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: space.gutter },
  assist: { marginHorizontal: space.gutter, padding: 16, borderRadius: radius.xl, gap: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16 },
  idea: { padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  composer: { minHeight: 90, borderRadius: radius.lg, borderWidth: 1, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
  option: { height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 15 },
  card: { padding: 16, borderRadius: radius.xl, gap: 12 },
  pollRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  empty: { marginHorizontal: space.gutter, alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
});
