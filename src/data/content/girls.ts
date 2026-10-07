import type { PhotoKey } from '@/data/photos';
import type { CityId, Person } from '@/data/types';
import type { MatchProfile } from '@/features/girl/compat';

/**
 * Development seed for IRLY Girl Match: members used when the app runs
 * without a backend (no Supabase keys). In production these rows come from
 * `irly_match_discover`, never from the bundle.
 */
export type GirlSeed = {
  person: Person;
  match: Omit<MatchProfile, 'userId' | 'firstName' | 'age' | 'cityId'>;
  /** Cover photo (dev only; real members upload theirs). */
  cover: PhotoKey;
  activeNow?: boolean;
  newHere?: boolean;
};

type Raw = {
  id: string;
  name: string;
  age: number;
  cityId: CityId;
  areaId: string;
  origin: string;
  headline: string;
  bio: string;
  hue: number;
  cover: PhotoKey;
  langs: string[];
  interests: string[];
  sports: string[];
  activities: string[];
  goals: string[];
  areas: string[];
  availability: string[];
  travel: string[];
  lifestyle: MatchProfile['lifestyle'];
  activeNow?: boolean;
  newHere?: boolean;
  hide?: string[];
};

const LANG_NAMES: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic', es: 'Spanish', ru: 'Russian', it: 'Italian', de: 'German', hi: 'Hindi', id: 'Indonesian' };

const RAW: Raw[] = [
  { id: 'g-ines', name: 'Inès', age: 28, cityId: 'dubai', areaId: 'marina', origin: 'France', headline: 'Brand manager · New in Dubai', bio: 'Moved from Paris three months ago. Padel three times a week, brunch every Saturday, always planning the next trip.', hue: 330, cover: 'padel', langs: ['fr', 'en'], interests: ['brunch', 'travel', 'wellness', 'fashion'], sports: ['padel', 'pilates'], activities: ['brunch', 'beach', 'coffee'], goals: ['new_friends', 'sports_friends', 'brunch_friends'], areas: ['marina', 'jlt'], availability: ['weekend_morning', 'weekday_evening'], travel: ['oman', 'europe', 'weekend_trips'], lifestyle: { chronotype: -1, social: 1, planning: -1, energy: 1, setting: 0, travel: 1 }, activeNow: true, newHere: true },
  { id: 'g-maya', name: 'Maya', age: 31, cityId: 'dubai', areaId: 'jlt', origin: 'Lebanon', headline: 'Architect', bio: 'Sunrise runs, gallery openings and long dinners. Looking for girls to explore Al Quoz and Alserkal with.', hue: 20, cover: 'gallery', langs: ['ar', 'en', 'fr'], interests: ['culture', 'restaurants', 'creative', 'coffee'], sports: ['running', 'yoga'], activities: ['museums', 'dinner', 'photo_walk'], goals: ['new_friends', 'creative_friends'], areas: ['jlt', 'alquoz'], availability: ['weekday_morning', 'weekend_afternoon'], travel: ['europe'], lifestyle: { chronotype: -1, social: 0, planning: -1, energy: 1, setting: 0, travel: 0 } },
  { id: 'g-sofia', name: 'Sofia', age: 27, cityId: 'dubai', areaId: 'downtown', origin: 'Italy', headline: 'Pastry chef', bio: 'I bake for a living and eat for fun. Show me your favourite brunch and I will show you mine.', hue: 45, cover: 'brunch', langs: ['it', 'en'], interests: ['brunch', 'restaurants', 'coffee', 'travel'], sports: ['pilates'], activities: ['brunch', 'dinner', 'shopping'], goals: ['brunch_friends', 'new_friends', 'girls_nights'], areas: ['downtown', 'businessbay'], availability: ['weekend_morning', 'weekend_evening'], travel: ['europe', 'oman'], lifestyle: { chronotype: 1, social: 1, planning: 1, energy: 0, setting: -1, travel: 0 }, newHere: true },
  { id: 'g-amira', name: 'Amira', age: 30, cityId: 'dubai', areaId: 'difc', origin: 'Egypt', headline: 'Founder · Skincare brand', bio: 'Building my brand by day, boxing by night. Always up for founder coffees and girls who build things.', hue: 280, cover: 'founders', langs: ['ar', 'en'], interests: ['entrepreneurship', 'career', 'beauty', 'wellness'], sports: ['boxing', 'gym'], activities: ['networking', 'coffee', 'spa'], goals: ['networking', 'fitness_friends', 'new_friends'], areas: ['difc', 'downtown'], availability: ['weekday_evening', 'weekend_morning'], travel: ['abudhabi'], lifestyle: { chronotype: 0, social: 1, planning: -1, energy: 1, setting: -1, travel: 0 }, activeNow: true },
  { id: 'g-lea', name: 'Léa', age: 26, cityId: 'dubai', areaId: 'kitebeach', origin: 'Belgium', headline: 'Yoga teacher', bio: 'Beach yoga at 7, paddle at sunset. Looking for active girls who love the sea as much as I do.', hue: 190, cover: 'yoga', langs: ['fr', 'en'], interests: ['wellness', 'travel', 'coffee'], sports: ['yoga', 'surf', 'swimming'], activities: ['beach', 'coffee', 'yacht'], goals: ['fitness_friends', 'new_friends', 'travel_friends'], areas: ['kitebeach', 'jumeirah'], availability: ['weekday_morning', 'weekend_morning'], travel: ['bali', 'oman', 'hatta'], lifestyle: { chronotype: -1, social: 0, planning: 1, energy: 1, setting: 0, travel: 1 } },
  { id: 'g-hana', name: 'Hana', age: 33, cityId: 'dubai', areaId: 'palm', origin: 'Japan', headline: 'UX lead · Fintech', bio: 'Quiet weekends, good matcha, the occasional desert sunrise. Small groups over big parties.', hue: 140, cover: 'dunes', langs: ['en'], interests: ['coffee', 'culture', 'learning', 'travel'], sports: ['hiking', 'yoga'], activities: ['desert', 'coffee', 'museums'], goals: ['new_friends', 'travel_friends'], areas: ['palm', 'marina'], availability: ['weekend_morning'], travel: ['hatta', 'oman', 'asia'], lifestyle: { chronotype: -1, social: -1, planning: -1, energy: 0, setting: 1, travel: 1 } },
  { id: 'g-chloe', name: 'Chloé', age: 29, cityId: 'dubai', areaId: 'marina', origin: 'Canada', headline: 'Event producer', bio: 'I know every rooftop in Dubai. Girls nights, live music, and padel when I wake up in time.', hue: 350, cover: 'rooftop', langs: ['fr', 'en'], interests: ['nightlife', 'music', 'fashion', 'brunch'], sports: ['padel', 'dance'], activities: ['girls_night', 'dinner', 'brunch'], goals: ['girls_nights', 'new_friends', 'sports_friends'], areas: ['marina', 'palm'], availability: ['weekend_evening', 'weekday_evening'], travel: ['europe', 'weekend_trips'], lifestyle: { chronotype: 1, social: 1, planning: 1, energy: 1, setting: -1, travel: 1 }, activeNow: true },
  { id: 'g-nour', name: 'Nour', age: 25, cityId: 'dubai', areaId: 'hills', origin: 'UAE', headline: 'Med student', bio: 'Born in Dubai, happy to show you the real city: karak spots, old Dubai, the best shawarma.', hue: 25, cover: 'dubaiCreek', langs: ['ar', 'en'], interests: ['coffee', 'culture', 'restaurants', 'learning'], sports: ['tennis', 'running'], activities: ['coffee', 'museums', 'photo_walk'], goals: ['new_friends', 'activity_partners'], areas: ['hills', 'alquoz'], availability: ['weekend_afternoon', 'weekday_evening'], travel: ['abudhabi', 'rak'], lifestyle: { chronotype: 0, social: 0, planning: -1, energy: 0, setting: -1, travel: -1 } },
  { id: 'g-elena', name: 'Elena', age: 34, cityId: 'dubai', areaId: 'businessbay', origin: 'Spain', headline: 'Lawyer · DIFC', bio: 'Pilates, tapas nights and planning weekend trips with zero notice. Women in law, finance, anything: let\'s talk.', hue: 10, cover: 'dinnerGroup', langs: ['es', 'en', 'fr'], interests: ['career', 'restaurants', 'travel', 'wellness'], sports: ['pilates', 'tennis'], activities: ['dinner', 'networking', 'spa'], goals: ['networking', 'new_friends', 'travel_friends'], areas: ['businessbay', 'difc'], availability: ['weekday_evening', 'weekend_afternoon'], travel: ['oman', 'europe', 'weekend_trips'], lifestyle: { chronotype: 0, social: 1, planning: 1, energy: 1, setting: -1, travel: 1 } },
  { id: 'g-priya', name: 'Priya', age: 28, cityId: 'dubai', areaId: 'jlt', origin: 'India', headline: 'Data scientist', bio: 'Gym at 6, Bollywood dance on Thursdays, chai in between. New here and keen to build my circle.', hue: 300, cover: 'gym', langs: ['hi', 'en'], interests: ['wellness', 'music', 'learning', 'coffee'], sports: ['gym', 'dance', 'running'], activities: ['coffee', 'girls_night'], goals: ['fitness_friends', 'new_friends'], areas: ['jlt', 'marina'], availability: ['weekday_morning', 'weekday_evening'], travel: ['asia'], lifestyle: { chronotype: -1, social: 0, planning: -1, energy: 1, setting: -1, travel: 0 }, newHere: true, hide: ['age'] },
  { id: 'g-olga', name: 'Olga', age: 32, cityId: 'dubai', areaId: 'jumeirah', origin: 'Ukraine', headline: 'Photographer', bio: 'I shoot sunsets and people. Looking for girls for photo walks, desert trips and slow mornings.', hue: 220, cover: 'dubaiMarina', langs: ['ru', 'en'], interests: ['creative', 'travel', 'culture'], sports: ['hiking', 'swimming'], activities: ['photo_walk', 'desert', 'beach'], goals: ['creative_friends', 'travel_friends'], areas: ['jumeirah', 'kitebeach'], availability: ['weekend_morning', 'weekend_afternoon'], travel: ['oman', 'hatta', 'rak'], lifestyle: { chronotype: -1, social: -1, planning: 1, energy: 0, setting: 1, travel: 1 } },
  { id: 'g-zara', name: 'Zara', age: 24, cityId: 'dubai', areaId: 'downtown', origin: 'UK', headline: 'Content creator', bio: 'Fashion, beauty and the best shopping spots. Brunch is my cardio. New in town, say hi!', hue: 320, cover: 'dubaiNight', langs: ['en'], interests: ['fashion', 'beauty', 'brunch', 'nightlife'], sports: ['pilates'], activities: ['shopping', 'brunch', 'spa'], goals: ['girls_nights', 'brunch_friends', 'new_friends'], areas: ['downtown', 'marina'], availability: ['weekend_afternoon', 'weekend_evening'], travel: ['europe'], lifestyle: { chronotype: 1, social: 1, planning: 1, energy: 0, setting: -1, travel: 0 }, newHere: true },
  { id: 'g-ayu', name: 'Ayu', age: 27, cityId: 'bali', areaId: 'canggu', origin: 'Indonesia', headline: 'Surf instructor', bio: 'Born in Bali, surfing since I was 8. I will show you the right breaks and the best warung.', hue: 160, cover: 'surf', langs: ['id', 'en'], interests: ['wellness', 'travel', 'coffee'], sports: ['surf', 'yoga'], activities: ['beach', 'coffee'], goals: ['sports_friends', 'new_friends'], areas: ['canggu'], availability: ['weekday_morning', 'weekend_morning'], travel: ['asia'], lifestyle: { chronotype: -1, social: 1, planning: 1, energy: 1, setting: 0, travel: 0 }, activeNow: true },
  { id: 'g-camille', name: 'Camille', age: 30, cityId: 'bali', areaId: 'ubud', origin: 'France', headline: 'Remote designer', bio: 'Digital nomad in Ubud. Yoga, rice terraces, coworking and long dinners with new friends.', hue: 100, cover: 'baliTemple', langs: ['fr', 'en'], interests: ['wellness', 'creative', 'travel', 'coffee'], sports: ['yoga', 'hiking'], activities: ['coffee', 'dinner', 'networking'], goals: ['new_friends', 'creative_friends', 'travel_friends'], areas: ['ubud'], availability: ['weekday_evening', 'weekend_morning'], travel: ['asia', 'europe'], lifestyle: { chronotype: -1, social: 0, planning: 1, energy: 0, setting: 1, travel: 1 }, newHere: true },
];

export const GIRLS: GirlSeed[] = RAW.map((r) => ({
  person: {
    id: r.id,
    name: r.name,
    age: r.age,
    types: r.newHere ? ['expat'] : ['local'],
    headline: r.headline,
    bio: r.bio,
    cityId: r.cityId,
    areaId: r.areaId,
    interests: [],
    activities: [],
    intents: ['friends'],
    availability: ['weekends'],
    languages: r.langs.map((l) => LANG_NAMES[l] ?? l),
    origin: r.origin,
    since: r.newHere ? 'New here' : 'A while',
    verified: true,
    hue: r.hue,
    online: r.activeNow,
  },
  match: {
    bio: r.bio,
    interests: r.interests,
    sports: r.sports,
    activities: r.activities,
    goals: r.goals,
    languages: r.langs,
    areas: r.areas,
    availability: r.availability,
    travel: r.travel,
    lifestyle: r.lifestyle,
    ageMin: 21,
    ageMax: 40,
    communities: [],
    hiddenFields: r.hide ?? [],
    visible: true,
  },
  cover: r.cover,
  activeNow: r.activeNow,
  newHere: r.newHere,
}));

export const GIRL_PEOPLE = new Map(GIRLS.map((g) => [g.person.id, g.person]));
