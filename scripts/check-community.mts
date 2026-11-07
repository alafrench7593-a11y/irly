// The free community assistant: plans, polls, digest, ideas, post → activity.
import { communityAssist, digestLines, postLooksLikeAPlan } from '../src/features/community/assist.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { networkListed } from '../src/features/network/listed.ts';
import { belongsToSpace, universeOf } from '../src/features/universe/universe.ts';

const geo = { cities: [{ id: 'bali', name: 'Bali' }], areas: [{ id: 'canggu', name: 'Canggu', cityId: 'bali' }, { id: 'ubud', name: 'Ubud', cityId: 'bali' }] };
const ctx = { communityName: 'Girls Padel Bali', categoryId: 'sport', geo };

let failed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, JSON.stringify(got));
  }
};

const a = communityAssist('Organise padel saturday 9am in Canggu', ctx);
expect(a.kind === 'plan' && a.draft.activity === 'padel' && a.draft.day === 'sat' && a.draft.time === '09:00' && a.draft.areaId === 'canggu', 'plan with activity, day, time, area', a);
const f = communityAssist('On fait un brunch dimanche à Ubud ?', ctx);
expect(f.kind === 'plan' && f.draft.activity === 'brunch' && f.draft.day === 'sun' && f.draft.areaId === 'ubud', 'plan in French', f);
const p = communityAssist('Poll: Saturday or Sunday?', ctx);
expect(p.kind === 'poll' && p.options.join('|') === 'Saturday|Sunday', 'poll with two options', p);
const p2 = communityAssist('sondage : matin, midi, soir', ctx);
expect(p2.kind === 'poll' && p2.options.length === 3, 'poll in French with three options', p2);
expect(communityAssist("What's new this week?", ctx).kind === 'digest', 'digest');
expect(communityAssist('quoi de neuf ?', ctx).kind === 'digest', 'digest in French');
const i = communityAssist('give me post ideas', ctx);
expect(i.kind === 'ideas' && i.ideas.length === 3, 'ideas for the category', i);
expect(communityAssist('hello', ctx).kind === 'help', 'unknown → help');
// Regressions: a plan "this week" is a plan; accents; "new" is not "create".
expect(communityAssist('Organise padel this week', ctx).kind === 'plan', 'plan this week is a plan');
expect(communityAssist('Organiser un padel cette semaine', ctx).kind === 'plan', 'French plan this week is a plan');
expect(communityAssist('Plan a dinner to resume our chats', ctx).kind === 'plan', 'resume as a verb is not a digest');
expect(communityAssist('résumé', ctx).kind === 'digest', 'résumé → digest');
expect(communityAssist('des idées ?', ctx).kind === 'ideas', 'idées → ideas');
expect(communityAssist('Anyone tried the new court?', ctx).kind !== 'plan', 'a question about a new court is not a plan');

expect(postLooksLikeAPlan("Padel saturday 9am, who's in?", geo)?.activity === 'padel', 'an inviting post becomes an activity suggestion');
expect(postLooksLikeAPlan('Qui vient courir demain matin ?', geo)?.activity === 'running', 'in French too');
expect(postLooksLikeAPlan('Loved yesterday, thanks all!', geo) === null, 'a thank-you post is not a plan');

const lines = digestLines({ postsWeek: 3, newMembersWeek: 2, members: 40, upcoming: 2, nextTitle: 'Padel', nextStartsAt: Date.UTC(2026, 9, 10, 9), topPostBody: 'Who is in?', topPostLikes: 5 }, () => 'Sat 9:00');
expect(lines.length === 4 && lines[0].startsWith('3 posts') && lines[2].includes('+1 more'), 'digest from real numbers', lines);
const empty = digestLines({ postsWeek: 0, newMembersWeek: 0, members: 1, upcoming: 0, nextTitle: null, nextStartsAt: null, topPostBody: null, topPostLikes: 0 }, () => '');
expect(empty[0].startsWith('No posts') && empty[2].startsWith('Nothing planned'), 'empty week is said honestly', empty);

// IRLY Network's communities, per space: each space lists the ones its members can join.
const mixed = { categoryId: null, topic: 'network', girlOnly: false };
const girlNetworking = { categoryId: null, topic: 'girl_network', girlOnly: true };
const womenClub = { categoryId: 'networking', topic: null, girlOnly: true };
const club = { categoryId: 'networking', topic: null, girlOnly: false };
expect(networkListed(mixed, false) && networkListed(club, false), 'Network (Mixte): IRLY Network and a networking community');
expect(!networkListed(womenClub, false) && !networkListed(girlNetworking, false), 'Network (Mixte): no women-only community');
expect(networkListed(girlNetworking, true), 'Network (Girl): Girl CEO (girl_network) is listed');
expect(networkListed(womenClub, true) && !networkListed(mixed, true) && !networkListed(club, true), 'Network (Girl): women-only networking communities only');
expect(!networkListed({ categoryId: null, topic: 'girls', girlOnly: true }, true) && !networkListed({ categoryId: 'sport', topic: null, girlOnly: true }, true), 'Network (Girl): not a community about something else');

// Lists by universe (universe.ts): a woman's Mixte communities never show in IRLY Girl, her Girl and Mom ones never in Mixte.
const mixteClub = { categoryId: 'sport', topic: null, girlOnly: false };
const girlClub = { categoryId: 'food', topic: null, girlOnly: true };
const momClub = { categoryId: 'family', topic: 'mom_sport', girlOnly: true };
expect(belongsToSpace(mixteClub, 'mixte') && !belongsToSpace(mixteClub, 'girl'), 'lists: a Mixte community only in Mixte');
expect(belongsToSpace(girlClub, 'girl') && !belongsToSpace(girlClub, 'mixte'), 'lists: an IRLY Girl community only in IRLY Girl');
expect(belongsToSpace(momClub, 'girl') && !belongsToSpace(momClub, 'mixte') && universeOf(momClub) === 'mom', 'lists: a Mom community only in IRLY Girl (its Mom universe)');
expect(belongsToSpace(womenClub, 'girl') && !belongsToSpace(womenClub, 'mixte') && belongsToSpace(club, 'mixte') && !belongsToSpace(club, 'girl'), 'lists: Network split by women-only');

// Every community list the app reads returns each community's own photo (cover_path): the latest
// definition of each list RPC called in src/ (migrations in order) has it in its result.
const COMMUNITY_LISTS = ['community_list', 'community_directory', 'community_recommend', 'member_communities', 'girl_official_communities', 'mom_official_communities'];
const root = new URL('..', import.meta.url).pathname;
const sources: string[] = [];
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(e.name)) sources.push(readFileSync(full, 'utf8'));
  }
};
walk(join(root, 'src'));
const called = new Set(sources.flatMap((src) => [...src.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1])));
// A new list of communities (…_communities, community_list…) must be added to COMMUNITY_LISTS, so it is checked too.
const unlisted = [...called].filter((n) => /(^|_)communities$|^community_(list|directory|recommend)$/.test(n) && !COMMUNITY_LISTS.includes(n) && !/^(join|staff_girl)_communities$/.test(n));
expect(unlisted.length === 0, 'every community list RPC the app calls is checked for its photo', unlisted);
const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
for (const name of COMMUNITY_LISTS.filter((n) => called.has(n) || n === 'mom_official_communities')) {
  const def = new RegExp(`create (?:or replace )?function public\\.${name}\\([^)]*\\)\\s*returns table \\(([^;]*?)\\)\\s*language`, 'gi');
  const last = migrations.flatMap((m) => [...m.matchAll(def)].map((x) => x[1])).pop();
  expect(Boolean(last && /\bcover_path text\b/.test(last)), `${name} returns cover_path`, last?.slice(0, 200));
}

if (failed) {
  console.error(`${failed} community check(s) failed`);
  process.exit(1);
}
console.log('community assistant ok');
