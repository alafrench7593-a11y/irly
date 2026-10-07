import type { IconName } from '@/components/ui/Icon';

/**
 * IRLY Match vocabulary. Ids are stored server-side (irly_match_profiles),
 * labels are what members read. One list, used by the profile builder, the
 * filters and the "why you match" explanations.
 */
export type Option = { id: string; label: string; icon?: IconName };

export const INTERESTS: Option[] = [
  { id: 'brunch', label: 'Brunch', icon: 'utensils' },
  { id: 'coffee', label: 'Coffee', icon: 'coffee' },
  { id: 'restaurants', label: 'Restaurants', icon: 'utensils' },
  { id: 'travel', label: 'Travel', icon: 'plane' },
  { id: 'wellness', label: 'Wellness', icon: 'leaf' },
  { id: 'beauty', label: 'Beauty', icon: 'sparkles' },
  { id: 'fashion', label: 'Fashion', icon: 'shoppingBag' },
  { id: 'nightlife', label: 'Nightlife', icon: 'martini' },
  { id: 'culture', label: 'Culture & art', icon: 'palette' },
  { id: 'music', label: 'Music', icon: 'music' },
  { id: 'entertainment', label: 'Cinema & shows', icon: 'popcorn' },
  { id: 'learning', label: 'Learning', icon: 'book' },
  { id: 'creative', label: 'Creative', icon: 'brush' },
  { id: 'pets', label: 'Pets', icon: 'pawPrint' },
  { id: 'career', label: 'Career', icon: 'briefcase' },
  { id: 'entrepreneurship', label: 'Entrepreneurship', icon: 'rocket' },
];

export const SPORTS: Option[] = [
  { id: 'padel', label: 'Padel' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'running', label: 'Running' },
  { id: 'gym', label: 'Gym' },
  { id: 'pilates', label: 'Pilates' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'boxing', label: 'Boxing' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'surf', label: 'Surf & paddle' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'dance', label: 'Dance' },
];

export const ACTIVITIES: Option[] = [
  { id: 'coffee', label: 'Coffee' },
  { id: 'brunch', label: 'Brunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'beach', label: 'Beach' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'spa', label: 'Spa day' },
  { id: 'girls_night', label: 'Girls night' },
  { id: 'photo_walk', label: 'Photo walk' },
  { id: 'museums', label: 'Museums' },
  { id: 'desert', label: 'Desert trip' },
  { id: 'yacht', label: 'Yacht day' },
  { id: 'networking', label: 'Networking' },
];

export const GOALS: Option[] = [
  { id: 'new_friends', label: 'New friends', icon: 'heartHandshake' },
  { id: 'sports_friends', label: 'Sports friends', icon: 'trophy' },
  { id: 'travel_friends', label: 'Travel buddies', icon: 'plane' },
  { id: 'brunch_friends', label: 'Brunch friends', icon: 'utensils' },
  { id: 'networking', label: 'Networking', icon: 'briefcase' },
  { id: 'girls_nights', label: 'Girls nights', icon: 'moon' },
  { id: 'fitness_friends', label: 'Fitness friends', icon: 'dumbbell' },
  { id: 'creative_friends', label: 'Creative friends', icon: 'palette' },
  { id: 'activity_partners', label: 'Activity partners', icon: 'activity' },
];

export const TRAVEL: Option[] = [
  { id: 'abudhabi', label: 'Abu Dhabi' },
  { id: 'oman', label: 'Oman' },
  { id: 'hatta', label: 'Hatta' },
  { id: 'rak', label: 'Ras Al Khaimah' },
  { id: 'bali', label: 'Bali' },
  { id: 'europe', label: 'Europe' },
  { id: 'asia', label: 'Asia' },
  { id: 'weekend_trips', label: 'Weekend trips' },
];

export const AVAILABILITY: Option[] = [
  { id: 'weekday_morning', label: 'Weekday mornings' },
  { id: 'weekday_evening', label: 'Weekday evenings' },
  { id: 'weekend_morning', label: 'Weekend mornings' },
  { id: 'weekend_afternoon', label: 'Weekend afternoons' },
  { id: 'weekend_evening', label: 'Weekend evenings' },
];

export const LANGUAGES: Option[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'French' },
  { id: 'ar', label: 'Arabic' },
  { id: 'es', label: 'Spanish' },
  { id: 'ru', label: 'Russian' },
  { id: 'it', label: 'Italian' },
  { id: 'de', label: 'German' },
  { id: 'hi', label: 'Hindi' },
  { id: 'id', label: 'Indonesian' },
];

export type LifestyleKey = 'chronotype' | 'social' | 'planning' | 'energy' | 'setting' | 'travel';

/** Each dimension is answered -1, 0 or 1. */
export const LIFESTYLE: { id: LifestyleKey; left: string; middle: string; right: string }[] = [
  { id: 'chronotype', left: 'Morning person', middle: 'Both', right: 'Night owl' },
  { id: 'social', left: 'Introvert', middle: 'Balanced', right: 'Social butterfly' },
  { id: 'planning', left: 'Planner', middle: 'Either', right: 'Spontaneous' },
  { id: 'energy', left: 'Relaxed', middle: 'In between', right: 'Always active' },
  { id: 'setting', left: 'City', middle: 'Beach', right: 'Nature' },
  { id: 'travel', left: 'Rarely travel', middle: 'A few trips a year', right: 'Always travelling' },
];

/** Fields a member can keep to herself. */
export const HIDEABLE: { id: 'age' | 'languages' | 'areas'; label: string }[] = [
  { id: 'age', label: 'My age' },
  { id: 'languages', label: 'My languages' },
  { id: 'areas', label: 'My neighbourhoods' },
];

const ALL = [...INTERESTS, ...SPORTS, ...ACTIVITIES, ...GOALS, ...TRAVEL, ...AVAILABILITY, ...LANGUAGES];
const LABELS = new Map(ALL.map((o) => [o.id, o.label]));

export const labelOf = (id: string) => LABELS.get(id) ?? id;
