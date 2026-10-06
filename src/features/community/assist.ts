/**
 * IRLY community assistant. Free: it runs on the phone, with no AI
 * service to pay for, and deterministic (tested in
 * scripts/check-community.mts). It understands four kinds of requests,
 * in English and French:
 *
 *   plan      "organise padel saturday 9am"      → an activity draft for the community
 *   poll      "poll: saturday or sunday?"         → a poll ready to post
 *   digest    "what's new this week?"             → the week summarised from real data
 *   ideas     "post ideas"                        → conversation starters for this community
 *
 * Posts that invite people ("padel saturday, who's in?") get a "Make it an
 * activity" suggestion, so plans become real activities with a chat and a
 * calendar entry.
 */
import { parseCommand, planDay, type GeoIndex, type Day } from '@/features/ai/intent';

export type PlanDraft = { title: string; activity?: string; category: string; day?: Day; time: string; areaId?: string };
export type Assist =
  | { kind: 'plan'; draft: PlanDraft }
  | { kind: 'poll'; question: string; options: string[] }
  | { kind: 'digest' }
  | { kind: 'ideas'; ideas: string[] }
  | { kind: 'help' };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

const IDEAS: Record<string, string[]> = {
  sport: ['Who wants to play this weekend? Drop your level 👇', 'Best court or field you found this month?', 'Looking for a regular partner: who trains in the morning?'],
  food: ['Best brunch you had this month?', 'New place to try together this week: suggestions?', 'Cheap and great: share your favourite spot 👇'],
  family: ['Playdate this weekend: which park or beach?', 'Best kid-friendly café nearby?', 'Swap: what did your kids love doing this month?'],
  wellness: ['Morning yoga or evening walk this week?', 'Favourite place to slow down around here?', 'Who wants to try a new class together?'],
  networking: ['What are you working on this month? Introduce yourself 👇', 'Coworking day this week: who\'s in?', 'Ask for help: what do you need right now?'],
  girl: ['Who is new here? Say hi 👋', 'Girls brunch this weekend: where?', 'Share a place you love going alone 💛'],
  default: ['Who is new here? Introduce yourself 👋', 'What should we do together this weekend?', 'Share a place you love around here'],
};

export function ideasFor(categoryId: string | null | undefined): string[] {
  return IDEAS[categoryId ?? ''] ?? IDEAS.default;
}

function title(activity: string | undefined, label: string | undefined, communityName: string): string {
  const what = label ?? (activity ? activity[0].toUpperCase() + activity.slice(1) : 'Meetup');
  return `${what} · ${communityName}`.slice(0, 80);
}

const flat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Parse a request typed in the community assistant. */
export function communityAssist(input: string, ctx: { communityName: string; categoryId?: string | null; geo: GeoIndex; activityLabel?: (id: string) => string | undefined }): Assist {
  const text = norm(input);
  if (!text) return { kind: 'help' };

  if (/^(poll|sondage|vote)\b|\b(poll|sondage)\s*:/.test(text)) {
    const raw = input.replace(/^\s*(poll|sondage|vote)\s*:?\s*/i, '').trim();
    const question = raw.endsWith('?') ? raw : `${raw}?`;
    const options = raw
      .replace(/\?$/, '')
      .split(/\s*(?:,|\bor\b|\bou\b|\/)\s*/i)
      .map((o) => o.trim())
      .filter(Boolean)
      .map((o) => o[0].toUpperCase() + o.slice(1))
      .slice(0, 6);
    return { kind: 'poll', question: question[0].toUpperCase() + question.slice(1), options: options.length >= 2 ? options : ['Yes', 'No'] };
  }

  // Accent-free on both sides (JS \b does not see "é" as a word letter).
  const t = flat(text);
  const has = (re: RegExp) => new RegExp(flat(re.source), re.flags).test(t);
  const cmd = parseCommand(input, ctx.geo);
  const e = cmd.entities;
  const wantsPlan = has(/\b(organi[sz]e|organiser|plan|create|crée|cree|créer|host|let s|on fait|faisons|propose)\b/) || cmd.intent === 'CREATE_ACTIVITY' || cmd.intent === 'CREATE_EVENT';

  // A plan wins over the digest: "Organise padel this week" is a plan.
  if (!wantsPlan && has(/\b(summary|summarise|summarize|digest|what s new|whats new|recap|résumé|quoi de neuf|cette semaine|this week)\b/)) return { kind: 'digest' };

  if (!wantsPlan && has(/\b(idea|ideas|idée|idées|what (should|can) i post|suggest|inspire|quoi poster|post about)\b/)) return { kind: 'ideas', ideas: ideasFor(ctx.categoryId) };

  if (wantsPlan || e.activity) {
    return {
      kind: 'plan',
      draft: { title: title(e.activity, e.activity ? ctx.activityLabel?.(e.activity) : undefined, ctx.communityName), activity: e.activity, category: e.category ?? ctx.categoryId ?? 'sport', day: e.day, time: e.time ?? '19:00', areaId: e.areaId },
    };
  }
  return { kind: 'help' };
}

/** "Padel saturday 9am, who's in?" → worth turning into an activity. */
export function postLooksLikeAPlan(body: string, geo: GeoIndex): PlanDraft | null {
  const text = norm(body);
  const inviting = /\b(who s in|whos in|who is in|anyone|qui vient|qui est chaud|qui est dispo|partant|partante|join me|let s|on fait|who wants)\b|\?$/.test(flat(text));
  if (!inviting) return null;
  const cmd = parseCommand(body, geo);
  const e = cmd.entities;
  if (!e.activity && !e.day && !e.time) return null;
  return { title: (e.activity ? e.activity[0].toUpperCase() + e.activity.slice(1) : 'Meetup').slice(0, 80), activity: e.activity, category: e.category ?? 'sport', day: e.day, time: e.time ?? '19:00', areaId: e.areaId };
}

export type DigestInput = { postsWeek: number; newMembersWeek: number; members: number; upcoming: number; nextTitle: string | null; nextStartsAt: number | null; topPostBody: string | null; topPostLikes: number };

/** The week in plain words, from real numbers only. */
export function digestLines(d: DigestInput, when: (ms: number) => string): string[] {
  const lines: string[] = [];
  lines.push(d.postsWeek ? `${d.postsWeek} post${d.postsWeek > 1 ? 's' : ''} this week.` : 'No posts this week yet: start the conversation.');
  if (d.newMembersWeek) lines.push(`${d.newMembersWeek} new member${d.newMembersWeek > 1 ? 's' : ''} (${d.members} in total). Say hi!`);
  else lines.push(`${d.members} member${d.members === 1 ? '' : 's'}.`);
  if (d.nextTitle && d.nextStartsAt) lines.push(`Next: ${d.nextTitle}, ${when(d.nextStartsAt)}${d.upcoming > 1 ? ` (+${d.upcoming - 1} more planned)` : ''}.`);
  else lines.push('Nothing planned yet: propose something and it gets its own chat.');
  if (d.topPostBody && d.topPostLikes > 0) lines.push(`Most liked: “${d.topPostBody.slice(0, 80)}” (${d.topPostLikes} ♥).`);
  return lines;
}

export { planDay };
