// Live publishing (src/features/live/livePublish.ts) against a model of the
// server's post_live / abandon_live (supabase/migrations/20261020001500_irly_live_activity.sql):
// failure paths (upload, refusal, lost answers, app killed, offline) and
// concurrency (double publish, publish racing abandon). After every scenario:
// no activity exists without its Live, no file without a Live or a pending
// journal entry, and a Live is never published twice.
import { LivePublishError, outcomeOf, runPublish, settlePending, isAnswer, isMissingFunction, type PendingLive, type AbandonAnswer } from '../src/features/live/livePublish.ts';
import { feedRatio, FEED_MAX_RATIO, FEED_MIN_RATIO, mediaKey, mediaRatio } from '../src/features/live/liveRatio.ts';

let failed = 0;
let passed = 0;
function check(ok: boolean, label: string) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`FAIL ${label}`);
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** The server, as the migration defines it: one lock per Live, both-or-neither, tombstones. */
class Server {
  posts = new Map<string, { activityId: string | null }>();
  activities = new Map<string, { postRef: string; cancelled: boolean; others: number }>();
  tombstones = new Set<string>();
  files = new Set<string>();
  postsPerHour = 0;
  offline = false;
  private locks = new Map<string, Promise<unknown>>();
  private n = 0;

  private async locked<T>(id: string, fn: () => T): Promise<T> {
    const prev = this.locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    this.locks.set(id, prev.then(() => mine));
    await prev;
    try {
      await tick();
      return fn();
    } finally {
      release();
    }
  }

  postLive(id: string, withActivity: boolean): Promise<{ id: string; activity_id: string | null; replayed: boolean }> {
    return this.locked(id, () => {
      const had = this.posts.get(id);
      if (had) return { id, activity_id: had.activityId, replayed: true };
      if (this.tombstones.has(id)) throw Object.assign(new Error('this Live was abandoned'), { code: '22023' });
      if (this.postsPerHour >= 12) throw Object.assign(new Error('slow down: too many in a short time'), { code: '54000' });
      // One transaction: the activity only exists if the Live does.
      let activityId: string | null = null;
      if (withActivity) {
        const existing = [...this.activities.entries()].find(([, a]) => a.postRef === id && !a.cancelled);
        activityId = existing ? existing[0] : `act-${++this.n}`;
        if (!existing) this.activities.set(activityId, { postRef: id, cancelled: false, others: 0 });
      }
      this.posts.set(id, { activityId });
      this.postsPerHour++;
      return { id, activity_id: activityId, replayed: false };
    });
  }

  abandonLive(id: string): Promise<AbandonAnswer> {
    if (this.offline) return Promise.reject(new Error('Network request failed'));
    return this.locked(id, () => {
      if (this.posts.has(id)) return 'published' as const;
      this.tombstones.add(id);
      const entry = [...this.activities.entries()].find(([, a]) => a.postRef === id);
      if (!entry) return 'abandoned' as const;
      const [aid, a] = entry;
      if (a.cancelled) return 'cancelled' as const;
      if (a.others > 0) {
        a.cancelled = true;
        return 'cancelled' as const;
      }
      this.activities.delete(aid);
      return 'deleted' as const;
    });
  }

  invariants(label: string, journal: Map<string, PendingLive>) {
    for (const [aid, a] of this.activities) {
      if (a.cancelled) continue;
      check(this.posts.get(a.postRef)?.activityId === aid, `${label}: activity ${aid} is shown only with its Live`);
    }
    for (const f of this.files) {
      const id = f.split('/')[1].replace(/(-poster)?\.\w+$/, '');
      check(this.posts.has(id) || journal.has(id), `${label}: file ${f} belongs to a Live or a pending publish`);
    }
  }
}

function journal() {
  const m = new Map<string, PendingLive>();
  return { m, api: { put: (p: PendingLive) => void m.set(p.postId, p), drop: (id: string) => void m.delete(id) } };
}

const pending = (id: string, extra: Partial<PendingLive> = {}): PendingLive => ({
  postId: id,
  uid: 'u1',
  files: [`u1/${id}.jpg`],
  body: 'Coffee, join?',
  activity: true,
  at: Date.now(),
  ...extra,
});

type Net = { uploadFails?: boolean; lostBeforeServer?: boolean; lostAfterServer?: boolean };

/** One publish try against the server, with the network behaving as told. */
function publish(server: Server, j: ReturnType<typeof journal>, p: PendingLive, net: Net = {}) {
  let late: Promise<unknown> | null = null;
  const run = runPublish(p, {
    upload: async () => {
      await tick();
      if (net.uploadFails) {
        server.files.add(p.files[0]); // a part was stored before the failure
        throw new Error('No connection: try again');
      }
      for (const f of p.files) server.files.add(f);
    },
    save: async () => {
      if (net.lostBeforeServer) {
        // The request is still on its way: it reaches the server later.
        late = server.postLive(p.postId, p.activity).catch(() => undefined);
        throw new LivePublishError('IRLY did not answer in time', 'unknown');
      }
      try {
        const row = await server.postLive(p.postId, p.activity);
        if (net.lostAfterServer) throw new LivePublishError('No connection: try again', 'unknown');
        return row;
      } catch (e) {
        if (e instanceof LivePublishError) throw e;
        const err = e as { code?: string; message: string };
        throw new LivePublishError(err.message, isAnswer(err) ? 'refused' : 'unknown');
      }
    },
    removeFiles: async () => {
      if (server.posts.has(p.postId)) return;
      for (const f of p.files) server.files.delete(f);
    },
    journal: j.api,
  });
  return { run, late: () => late };
}

const settleDeps = (server: Server) => ({
  abandon: (id: string) => server.abandonLive(id),
  removeFiles: async (paths: string[]) => {
    if (server.offline) throw new Error('offline');
    for (const f of paths) server.files.delete(f);
  },
});

async function scenarios() {
  // 1. Published: one Live, its activity, nothing pending.
  {
    const s = new Server();
    const j = journal();
    const row = await publish(s, j, pending('p1')).run;
    check(row.activity_id !== null && s.posts.size === 1 && s.activities.size === 1, 'publish: Live and activity');
    check(j.m.size === 0, 'publish: nothing pending');
    s.invariants('publish', j.m);
  }
  // 2. Upload fails: nothing exists, its files go, nothing pending.
  {
    const s = new Server();
    const j = journal();
    const e = await publish(s, j, pending('p2'), { uploadFails: true }).run.catch((x) => x);
    check(outcomeOf(e) === 'refused', 'upload failure: refused');
    check(s.posts.size === 0 && s.activities.size === 0 && s.files.size === 0 && j.m.size === 0, 'upload failure: nothing left');
    s.invariants('upload failure', j.m);
  }
  // 3. Server refusal (rate limit): no activity, files gone.
  {
    const s = new Server();
    s.postsPerHour = 12;
    const j = journal();
    const e = await publish(s, j, pending('p3')).run.catch((x) => x);
    check(outcomeOf(e) === 'refused', 'refusal: refused');
    check(s.activities.size === 0 && s.files.size === 0 && j.m.size === 0, 'refusal: no activity, no files, nothing pending');
    s.invariants('refusal', j.m);
  }
  // 4. Answer lost after the server saved it: unknown; the retry gets it back (one Live, one activity).
  {
    const s = new Server();
    const j = journal();
    const e = await publish(s, j, pending('p4'), { lostAfterServer: true }).run.catch((x) => x);
    check(outcomeOf(e) === 'unknown' && j.m.has('p4'), 'lost answer: unknown, kept pending');
    const row = await publish(s, j, pending('p4', { prior: true })).run;
    check(row.replayed && s.posts.size === 1 && s.activities.size === 1 && j.m.size === 0, 'lost answer: retry replays, one Live, one activity');
    s.invariants('lost answer retry', j.m);
  }
  // 5. Answer lost after saving, then the member closes: it landed, it stays.
  {
    const s = new Server();
    const j = journal();
    await publish(s, j, pending('p5'), { lostAfterServer: true }).run.catch(() => undefined);
    const r = await settlePending(j.m.get('p5')!, settleDeps(s));
    check(r === 'published' && s.posts.has('p5') && s.activities.size === 1 && s.files.size === 1, 'close after lost answer: published, kept');
  }
  // 6. Request still on its way when the member gives up: it can never land afterwards.
  {
    const s = new Server();
    const j = journal();
    const tryP = publish(s, j, pending('p6'), { lostBeforeServer: true });
    await tryP.run.catch(() => undefined);
    const r = await settlePending(j.m.get('p6')!, settleDeps(s));
    j.api.drop('p6');
    await tryP.late();
    // Whichever came first wins; never an activity without its Live, never files left of a dropped Live.
    if (r === 'published') check(s.posts.has('p6'), 'race close/late request: published means saved');
    else check(!s.posts.has('p6') && s.activities.size === 0 && s.files.size === 0, 'race close/late request: dropped means nothing, ever');
    s.invariants('late request', j.m);
  }
  // 7. Double tap from two places at once (same id): one Live, one activity.
  {
    const s = new Server();
    const j = journal();
    const [a, b] = await Promise.all([publish(s, j, pending('p7')).run, publish(s, j, pending('p7')).run]);
    check(s.posts.size === 1 && s.activities.size === 1 && a.activity_id === b.activity_id && a.replayed !== b.replayed, 'double publish: one Live, one activity');
    s.invariants('double publish', j.m);
  }
  // 8. Publish racing an abandon, both orders.
  for (const first of ['publish', 'abandon'] as const) {
    const s = new Server();
    const j = journal();
    const p = pending(`p8-${first}`);
    s.files.add(p.files[0]);
    j.api.put(p);
    const pub = () => s.postLive(p.postId, true).then(
      () => 'saved',
      (e: { code?: string }) => `refused ${e.code}`,
    );
    const ab = () => s.abandonLive(p.postId);
    const [x, y] = first === 'publish' ? await Promise.all([pub(), ab()]) : (await Promise.all([ab(), pub()])).reverse();
    if (first === 'publish') check(x === 'saved' && y === 'published', 'publish then abandon: abandon sees it published');
    else check(x === 'refused 22023' && y === 'abandoned' && s.activities.size === 0, 'abandon then publish: the publish is refused, no activity');
    if (y !== 'published') for (const f of p.files) s.files.delete(f);
    j.api.drop(p.postId);
    s.invariants(`race ${first}`, j.m);
  }
  // 9. App killed mid-upload: the journal survives; the next start settles it.
  {
    const s = new Server();
    const j = journal();
    const p = pending('p9', { files: ['u1/p9.mp4', 'u1/p9-poster.jpg'] });
    j.api.put(p);
    s.files.add('u1/p9-poster.jpg'); // the poster made it before the app died
    const r = await settlePending(j.m.get('p9')!, settleDeps(s));
    j.api.drop('p9');
    check(r === 'dropped' && s.files.size === 0 && s.activities.size === 0, 'killed mid-upload: settled at start, files removed');
    check((await s.postLive('p9', true).catch((e) => e.code)) === '22023', 'killed mid-upload: an old request can no longer publish it');
    s.invariants('killed', j.m);
  }
  // 10. Offline at start: nothing assumed, asked again later.
  {
    const s = new Server();
    const j = journal();
    await publish(s, j, pending('p10'), { lostAfterServer: true }).run.catch(() => undefined);
    s.offline = true;
    check((await settlePending(j.m.get('p10')!, settleDeps(s))) === 'later' && j.m.has('p10'), 'offline settle: later, kept');
    check(s.posts.has('p10') && s.activities.size === 1, 'offline settle: nothing cancelled because the network is slow');
    s.offline = false;
    check((await settlePending(j.m.get('p10')!, settleDeps(s))) === 'published', 'back online: published');
  }
  // 11. Retry after a lost answer whose upload fails: may be saved with these files: kept.
  {
    const s = new Server();
    const j = journal();
    await publish(s, j, pending('p11'), { lostAfterServer: true }).run.catch(() => undefined);
    const e = await publish(s, j, pending('p11', { prior: true }), { uploadFails: true }).run.catch((x) => x);
    check(outcomeOf(e) === 'unknown' && j.m.has('p11') && s.files.has('u1/p11.jpg'), 'retry upload failure after lost answer: kept, unknown');
  }
  // 12. An activity someone joined (made by an older app) is cancelled, never deleted.
  {
    const s = new Server();
    s.activities.set('legacy', { postRef: 'p12', cancelled: false, others: 1 });
    check((await s.abandonLive('p12')) === 'cancelled' && s.activities.get('legacy')?.cancelled === true, 'joined activity: cancelled, kept');
    s.activities.set('legacy2', { postRef: 'p13', cancelled: false, others: 0 });
    check((await s.abandonLive('p13')) === 'deleted' && !s.activities.has('legacy2'), 'nobody joined: deleted');
  }
}

function pure() {
  check(outcomeOf(new LivePublishError('x', 'refused')) === 'refused', 'outcome: refusal');
  check(outcomeOf(new Error('network')) === 'unknown', 'outcome: any other error may have landed');
  check(isAnswer({ code: '54000' }) && !isAnswer({ code: '' }) && !isAnswer(null), 'answer: only a coded error');
  check(isMissingFunction({ code: 'PGRST202' }) && isMissingFunction({ message: 'Could not find the function public.post_live' }) && !isMissingFunction({ code: '54000' }), 'missing function detected');
  // Framing: the feed card clamps the media's shape; the composer preview uses the same.
  check(feedRatio(9 / 16) === FEED_MIN_RATIO && feedRatio(3) === FEED_MAX_RATIO && feedRatio(1.2) === 1.2 && feedRatio(undefined) === 1 && feedRatio(NaN) === 1, 'feedRatio clamps 4:5 … 1.91:1');
  check(mediaRatio(1080, 1920) === 0.5625 && mediaRatio(0, 10) === null && mediaRatio(undefined, 5) === null, 'mediaRatio');
  check(mediaKey('https://x.supabase.co/storage/v1/object/sign/irl-media/u1/a.jpg?token=1') === 'irl-media/u1/a.jpg' && mediaKey('file:///tmp/a.jpg') === 'file:///tmp/a.jpg', 'mediaKey: a signed link and a local file');
}

pure();
await scenarios();
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
