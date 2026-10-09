import type { IconName } from '@/components/ui/Icon';
import type { PhotoKey } from '@/data/photos';

export type SoonId = 'pro' | 'bonplan' | 'visa' | 'location';

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
};

/**
 * The four services IRLY is preparing. They are shown so people know what
 * is coming and can ask to be told when each opens; none of them takes a
 * booking, an application, a payment or a document today.
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
    liveNow: { label: 'Bali visa & stay guide', caption: 'Already in the Bali guide', icon: 'book', href: '/bali/guide/visa' },
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
};

export const SOON_ORDER: SoonId[] = ['pro', 'bonplan', 'visa', 'location'];
