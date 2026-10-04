import type { IconName } from '@/components/ui/Icon';
import type { PhotoKey } from './photos';
import type {
  ActivityKind,
  Availability,
  BusinessTopicId,
  EventCategory,
  Intent,
  Interest,
  PlaceKind,
  ServiceCategoryId,
  UserType,
} from './types';

type Def = { label: string; icon: IconName };

export const ACTIVITIES: Record<ActivityKind, Def & { photo: PhotoKey; verb: string }> = {
  padel: { label: 'Padel', icon: 'target', photo: 'padel', verb: 'playing padel' },
  football: { label: 'Football', icon: 'trophy', photo: 'football', verb: 'playing football' },
  basketball: { label: 'Basketball', icon: 'orbit', photo: 'basketball', verb: 'playing basketball' },
  tennis: { label: 'Tennis', icon: 'target', photo: 'tennis', verb: 'playing tennis' },
  running: { label: 'Running', icon: 'footprints', photo: 'running', verb: 'going for a run' },
  yoga: { label: 'Yoga', icon: 'flower', photo: 'yoga', verb: 'doing yoga' },
  gym: { label: 'Gym', icon: 'dumbbell', photo: 'gym', verb: 'training together' },
  hiking: { label: 'Hiking', icon: 'mountain', photo: 'hikeDesert', verb: 'going hiking' },
  surf: { label: 'Surf', icon: 'waves', photo: 'surf', verb: 'going surfing' },
  cycling: { label: 'Cycling', icon: 'bike', photo: 'cycling', verb: 'going for a ride' },
  swimming: { label: 'Swimming', icon: 'waves', photo: 'swimming', verb: 'going for a swim' },
  boxing: { label: 'Boxing', icon: 'swords', photo: 'boxing', verb: 'boxing' },
  volleyball: { label: 'Beach volley', icon: 'volleyball', photo: 'volleyball', verb: 'playing beach volley' },
  kayak: { label: 'Kayak', icon: 'sailboat', photo: 'kayak', verb: 'kayaking' },
  wellness: { label: 'Wellness', icon: 'leaf', photo: 'yoga', verb: 'joining a wellness circle' },
  beach: { label: 'Beach', icon: 'palm', photo: 'beachClub', verb: 'heading to the beach' },
  networking: { label: 'Networking', icon: 'handshake', photo: 'dinner', verb: 'meeting for coffee' },
};

export const USER_TYPES: Record<UserType, Def & { blurb: string }> = {
  expat: { label: 'Expat', icon: 'plane', blurb: 'New in town, building a life' },
  local: { label: 'Local', icon: 'home', blurb: 'This city is home' },
  tourist: { label: 'Tourist', icon: 'camera', blurb: 'Here for a while, here for real' },
  entrepreneur: { label: 'Entrepreneur', icon: 'rocket', blurb: 'Building something' },
  professional: { label: 'Professional', icon: 'briefcase', blurb: 'Career and life, balanced' },
  student: { label: 'Student', icon: 'graduation', blurb: 'Learning, exploring' },
  nomad: { label: 'Digital nomad', icon: 'laptop', blurb: 'Work from anywhere' },
};

export const INTERESTS: Record<Interest, Def> = {
  sports: { label: 'Sports', icon: 'trophy' },
  wellness: { label: 'Wellness', icon: 'leaf' },
  food: { label: 'Food', icon: 'utensils' },
  nightlife: { label: 'Nightlife', icon: 'martini' },
  business: { label: 'Business', icon: 'briefcase' },
  startups: { label: 'Startups', icon: 'rocket' },
  art: { label: 'Art', icon: 'palette' },
  music: { label: 'Music', icon: 'music' },
  outdoors: { label: 'Outdoors', icon: 'mountain' },
  fashion: { label: 'Fashion', icon: 'gem' },
  tech: { label: 'Tech', icon: 'laptop' },
  languages: { label: 'Languages', icon: 'languages' },
  family: { label: 'Family', icon: 'heart' },
  travel: { label: 'Travel', icon: 'plane' },
};

export const INTENTS: Record<Intent, Def & { blurb: string }> = {
  similar: { label: 'People like me', icon: 'users', blurb: 'Same stage of life, same rhythm' },
  friends: { label: 'New friends', icon: 'heartHandshake', blurb: 'Coffee, dinners, weekends' },
  sports: { label: 'Sports', icon: 'trophy', blurb: 'Partners for your next game' },
  business: { label: 'Business', icon: 'briefcase', blurb: 'Founders, clients, mentors' },
  activities: { label: 'Activities', icon: 'compass', blurb: 'Someone to do things with' },
  explore: { label: 'Explore', icon: 'sparkles', blurb: 'Locals who know the city' },
};

export const AVAILABILITY: Record<Availability, string> = {
  mornings: 'Mornings',
  evenings: 'Evenings',
  weekends: 'Weekends',
  flexible: 'Flexible',
};

export const EVENT_CATEGORIES: Record<EventCategory, Def> = {
  sports: { label: 'Sports', icon: 'trophy' },
  networking: { label: 'Networking', icon: 'handshake' },
  party: { label: 'Party', icon: 'disc' },
  wellness: { label: 'Wellness', icon: 'leaf' },
  business: { label: 'Business', icon: 'briefcase' },
  culture: { label: 'Culture', icon: 'palette' },
  food: { label: 'Food', icon: 'utensils' },
};

export const PLACE_KINDS: Record<PlaceKind, Def> = {
  restaurant: { label: 'Restaurant', icon: 'utensils' },
  cafe: { label: 'Café', icon: 'coffee' },
  beachclub: { label: 'Beach club', icon: 'palm' },
  rooftop: { label: 'Rooftop', icon: 'martini' },
  coworking: { label: 'Coworking', icon: 'laptop' },
  market: { label: 'Market', icon: 'store' },
  gallery: { label: 'Gallery', icon: 'palette' },
  nature: { label: 'Nature', icon: 'mountain' },
};

export const SERVICE_CATEGORIES: Record<ServiceCategoryId, Def & { blurb: string; photo: PhotoKey }> = {
  housing: { label: 'Housing', icon: 'home', blurb: 'Verified rentals, no fake listings', photo: 'apartment' },
  car: { label: 'Car rental', icon: 'car', blurb: 'Monthly rentals, transparent deposits', photo: 'car' },
  relocation: { label: 'Relocation', icon: 'package', blurb: 'From visa to first week, handled', photo: 'newHome' },
  visa: { label: 'Visa', icon: 'stamp', blurb: 'Golden, freelance, employment, family', photo: 'passport' },
  setup: { label: 'Business setup', icon: 'building', blurb: 'Free zone or mainland, end to end', photo: 'office' },
  realestate: { label: 'Real estate', icon: 'key', blurb: 'Buy with certified agents', photo: 'dubaiMarina' },
  pros: { label: 'Professionals', icon: 'scale', blurb: 'Lawyers, accountants, bankers', photo: 'accountant' },
  moving: { label: 'Moving', icon: 'truck', blurb: 'Packing, shipping, storage', photo: 'boxes' },
  cleaning: { label: 'Cleaning', icon: 'spray', blurb: 'Weekly or one-off, vetted teams', photo: 'cleanHome' },
  maintenance: { label: 'Maintenance', icon: 'wrench', blurb: 'AC, plumbing, handyman', photo: 'tools' },
  villa: { label: 'Villas', icon: 'home', blurb: 'Long-stay villas, checked in person', photo: 'villa' },
  scooter: { label: 'Scooter', icon: 'bike', blurb: 'Monthly scooters with insurance', photo: 'scooter' },
  coworking: { label: 'Coworking', icon: 'laptop', blurb: 'Desks, calls, community', photo: 'coworking' },
  surf: { label: 'Surf', icon: 'waves', blurb: 'Coaches and board rentals', photo: 'surf' },
  wellness: { label: 'Wellness', icon: 'flower', blurb: 'Yoga, massage, healers', photo: 'yoga' },
  transport: { label: 'Transport', icon: 'navigation', blurb: 'Drivers and airport runs', photo: 'baliRoad' },
  tours: { label: 'Tours', icon: 'compass', blurb: 'Local guides, small groups', photo: 'baliTemple' },
  local: { label: 'Local services', icon: 'sparkles', blurb: 'SIM, banking, laundry, more', photo: 'laundry' },
};

export const BUSINESS_TOPICS: Record<BusinessTopicId, Def & { blurb: string }> = {
  setup: { label: 'Business setup', icon: 'building', blurb: 'Licences, free zones, costs' },
  visa: { label: 'Visa & residence', icon: 'stamp', blurb: 'Every route, kept up to date' },
  networking: { label: 'Networking', icon: 'handshake', blurb: 'Curated rooms, real people' },
  professionals: { label: 'Professionals', icon: 'scale', blurb: 'Verified lawyers, accountants, bankers' },
  founders: { label: 'Founders', icon: 'rocket', blurb: 'Builders at your stage' },
  freelancers: { label: 'Freelancers', icon: 'laptop', blurb: 'Talent you can hire this week' },
  companies: { label: 'Companies', icon: 'briefcase', blurb: 'Teams hiring and partnering' },
};

export const LEVELS = {
  all: 'All levels',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const;
