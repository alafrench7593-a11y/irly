import type { IconName } from '@/components/ui/Icon';
import { destinationOpen } from '@/data/destinations';
import type { PhotoKey } from '@/data/photos';

export type SoonId = 'pro' | 'bonplan' | 'visa' | 'location' | 'match';

export type SoonService = {
  id: SoonId;
  /** Brand name, never translated. */
  name: string;
  icon: IconName;
  photo: PhotoKey;
  tagline: string;
  pitch: string;
  /** What is being prepared. Plans, worded as plans: nothing here works yet. */
  preparing: { icon: IconName; title: string; body: string }[];
  /** Parts that already work today, if any: real screens only. */
  liveNow?: { label: string; caption: string; icon: IconName; href: string };
  /** Said plainly on the page, so nobody mistakes a teaser for a service. */
  notice: string;
  /**
   * Whether "Tell me when it opens" can be stored for this id. The server
   * keeps an allow-list of ids (public.service_interest check and
   * set_service_interest); an id it does not know yet shows a plain line
   * instead of a button that would fail. Defaults to true.
   */
  notify?: boolean;
};

/**
 * The services IRLY is preparing. They are shown so people know what is
 * coming and can ask to be told when each opens; none of them takes a
 * booking, an application, a payment or a document today. The Discover
 * rail lists SOON_ORDER; Match IRLY is reached from the tab bar instead.
 */
export const SOON: Record<SoonId, SoonService> = {
  pro: {
    id: 'pro',
    name: 'IRLY PRO',
    icon: 'briefcase',
    photo: 'meeting',
    tagline: 'Work, business and the people behind them.',
    pitch: 'A professional side to IRLY: meet the people you could work with, then build something together, in real life.',
    preparing: [
      { icon: 'building', title: 'Company pages', body: 'Businesses present who they are and who they are looking for.' },
      { icon: 'handshake', title: 'Jobs and freelance missions', body: 'Opportunities shared by members and companies in your city.' },
      { icon: 'calendar', title: 'Business meetups', body: 'Founder breakfasts, talks and afterworks to meet in person.' },
      { icon: 'badgeCheck', title: 'Checked professional profiles', body: 'A clear sign when someone’s business has been checked.' },
    ],
    liveNow: { label: 'Networking', caption: 'Professionals near you, available today', icon: 'network', href: '/network' },
    notice: 'No jobs, companies or missions are listed yet. Networking already works today.',
  },
  bonplan: {
    id: 'bonplan',
    name: 'IRLY BON PLAN',
    icon: 'ticket',
    photo: 'mall',
    tagline: 'Good deals and useful services, for members.',
    pitch: 'Offers from places in your city and the services every newcomer needs, gathered in one place.',
    preparing: [
      { icon: 'store', title: 'Member offers', body: 'Restaurants, gyms and places with something for IRLY members.' },
      { icon: 'truck', title: 'Services for newcomers', body: 'Moving, internet, cleaning, the first weeks made simple.' },
      { icon: 'star', title: 'Honest reviews', body: 'Reviews only from members who actually used the service.' },
    ],
    notice: 'No offers or partners are available yet.',
  },
  visa: {
    id: 'visa',
    name: 'IRLY VISA',
    icon: 'stamp',
    photo: 'dubai',
    tagline: 'Visas and settling in, explained clearly.',
    pitch: 'Know which visa fits you, what to prepare and what comes next, before you move and once you are here.',
    preparing: [
      { icon: 'book', title: 'Guides by visa type', body: 'Work, freelance, family, investor and long stays, step by step.' },
      { icon: 'file', title: 'Document checklists', body: 'What to prepare, in what order, so nothing is missing.' },
      { icon: 'bell', title: 'Reminders', body: 'Your renewal and expiry dates, so they never surprise you.' },
      { icon: 'users', title: 'Help from qualified advisers', body: 'For the cases a guide cannot answer.' },
    ],
    // The Bali guide, while Bali is open (coming soon for now).
    ...(destinationOpen('bali') ? { liveNow: { label: 'Bali visa & stay guide', caption: 'Already in the Bali guide', icon: 'book', href: '/bali/guide/visa' } } : {}),
    notice: 'IRLY is not a government service. No visa can be applied for or processed through IRLY.',
  },
  location: {
    id: 'location',
    name: 'IRLY LOCATION',
    icon: 'car',
    photo: 'automotive',
    tagline: 'Car rental, starting in Dubai.',
    pitch: 'A car for a day, a week or a month, booked in a few taps when you have just arrived.',
    preparing: [
      { icon: 'clock', title: 'Short and long rentals', body: 'From a day to a few months.' },
      { icon: 'banknote', title: 'The full price up front', body: 'What you pay, shown before you book.' },
      { icon: 'pin', title: 'Dubai first', body: 'Then more cities across the Emirates.' },
    ],
    notice: 'No cars can be booked yet. Rentals are not available.',
  },
  // Match IRLY: the disc in the middle of the tab bar. Its screen exists
  // (src/app/match.tsx) but stays closed while FEATURES.matchIrly is off.
  match: {
    id: 'match',
    name: 'MATCH IRLY',
    icon: 'heartHandshake',
    photo: 'dinnerGroup',
    tagline: 'People to meet, for real.',
    pitch: 'Real members who share your interests and plans, suggested with the reason why. No swiping, no score on people.',
    preparing: [
      { icon: 'sparkles', title: 'Suggestions with the reason why', body: 'What you both chose: interests, activities, goals, languages and city.' },
      { icon: 'shield', title: 'Verified members only', body: 'Photos and a selfie checked by a person at IRLY, for everyone you meet.' },
      { icon: 'userPlus', title: 'Add friend, or not now', body: 'A request the other person accepts. Nothing opens a chat on its own.' },
      { icon: 'calendar', title: 'Then meet in real life', body: 'Plans and activities to do together, near you.' },
    ],
    liveNow: { label: 'Real-life plans', caption: 'Activities near you, open to join today', icon: 'users', href: '/social' },
    notice: 'Match IRLY is not open yet. No suggestions are made and nobody is matched with you.',
  },
};

export const SOON_ORDER: SoonId[] = ['pro', 'bonplan', 'visa', 'location'];
