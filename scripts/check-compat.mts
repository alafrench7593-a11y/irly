// Parity check: the on-device score must equal the SQL score for the same
// profiles (supabase/tests/irly_test.sql expects Bea=80, Dina=8 for Alice).
import { matchScore, type MatchProfile } from '../src/features/girl/compat.ts';

const base = { cityId: 'dubai', bio: '', communities: [], hiddenFields: [], visible: true, ageMin: 18, ageMax: 99, activities: [], availability: [], travel: [], areas: [], sports: [], interests: [], languages: [], lifestyle: {} };
const alice: MatchProfile = { ...base, userId: 'a', firstName: 'Alice', age: 30, goals: ['new_friends', 'sports_friends'], interests: ['brunch', 'travel', 'wellness'], sports: ['padel', 'running'], activities: ['coffee', 'beach'], languages: ['fr', 'en'], areas: ['marina', 'jlt'], availability: ['weekend_morning'], travel: ['oman'], lifestyle: { chronotype: -1, social: 1, energy: 1 } };
const bea: MatchProfile = { ...base, userId: 'b', firstName: 'Bea', age: 31, goals: ['new_friends'], interests: ['brunch', 'travel'], sports: ['padel'], activities: ['coffee'], languages: ['fr'], areas: ['marina'], availability: ['weekend_morning'], travel: ['oman', 'bali'], lifestyle: { chronotype: -1, social: 1, energy: 0 } };
const dina: MatchProfile = { ...base, userId: 'd', firstName: 'Dina', age: 41, goals: ['networking'], interests: ['career'], sports: ['gym'], languages: ['ar'], areas: ['downtown'], lifestyle: { chronotype: 1, social: -1 } };

const b = matchScore(alice, bea).score;
const d = matchScore(alice, dina).score;
console.log({ bea: b, dina: d });
if (b !== 80 || d !== 8) {
  console.error('MISMATCH with SQL (expected 80 / 8)');
  process.exit(1);
}
console.log('compat parity ok');
