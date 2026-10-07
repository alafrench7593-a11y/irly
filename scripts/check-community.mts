// The free community assistant: plans, polls, digest, ideas, post → activity.
import { communityAssist, digestLines, postLooksLikeAPlan } from '../src/features/community/assist.ts';

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

if (failed) {
  console.error(`${failed} community check(s) failed`);
  process.exit(1);
}
console.log('community assistant ok');
