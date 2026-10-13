import type { LookingFor } from '@/state/store';

/**
 * "What are you looking for?": several answers. Each one is a goal the
 * server matches to IRLY communities (goal:<id>), in every emirate.
 */
export const LOOKING_FOR: { id: LookingFor; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'communities', label: 'Communities' },
  { id: 'activities', label: 'Activities' },
  { id: 'sport', label: 'Sport' },
  { id: 'wellness', label: 'Wellness & yoga' },
  { id: 'beach', label: 'Beach & water sports' },
  { id: 'outdoors', label: 'Outdoors & hiking' },
  { id: 'networking', label: 'Networking' },
  { id: 'business', label: 'Business & entrepreneurs' },
  { id: 'tech', label: 'Tech & AI' },
  { id: 'food', label: 'Food' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'events', label: 'Events' },
  { id: 'culture', label: 'Art & culture' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'travel', label: 'Travel' },
  { id: 'languages', label: 'Languages & expats' },
  { id: 'family', label: 'Family & kids' },
  { id: 'help', label: 'Help & tips' },
  { id: 'dogwalk', label: 'Dog walk' },
];

/** Shown to women only. */
export const LOOKING_FOR_GIRL: { id: LookingFor; label: string } = { id: 'irlygirl', label: 'IRLY Girl' };

export const LOOKING_LABEL: Record<string, string> = Object.fromEntries([...LOOKING_FOR, LOOKING_FOR_GIRL].map((o) => [o.id, o.label]));
