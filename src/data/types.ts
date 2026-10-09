import type { IconName } from '@/components/ui/Icon';
import type { LightId } from '@/theme/lights';
import type { PhotoKey } from './photos';

/* ───────────────────────── Geography ───────────────────────── */

export type DestinationId = 'emirates' | 'bali' | 'thailand' | 'singapore' | 'london' | 'paris';

export type CityId = 'dubai' | 'abudhabi' | 'sharjah' | 'ajman' | 'rak' | 'fujairah' | 'uaq' | 'bali';

/** Normalised position on a city's map canvas (0..1 on both axes). */
export type MapPoint = { x: number; y: number };

export type Area = { id: string; name: string; point: MapPoint };

export type HomeSectionKey =
  | 'forYou'
  | 'nearby'
  | 'meet'
  | 'activities'
  | 'events'
  | 'places'
  | 'coworking'
  | 'services'
  | 'communities'
  | 'business'
  | 'discover';

export type Destination = {
  id: DestinationId;
  name: string;
  shortName: string;
  flag: string;
  country: string;
  tagline: string;
  status: 'live' | 'soon';
  light: LightId;
  photo: PhotoKey;
  cities: CityId[];
  defaultCity?: CityId;
};

export type MapArt = 'dubai' | 'abudhabi' | 'coast' | 'bali';

export type City = {
  id: CityId;
  destinationId: DestinationId;
  name: string;
  region: string;
  tagline: string;
  /** Hours from UTC, used for greetings and day/night. No DST in UAE or Bali. */
  utcOffset: number;
  light: LightId;
  photo: PhotoKey;
  launch?: boolean;
  coordinates: string;
  currency: 'AED' | 'IDR';
  temperature: number;
  stats: { communities: number; activities: number; events: number };
  areas: Area[];
  map: MapArt;
  homeSections: HomeSectionKey[];
  activityKinds: ActivityKind[];
  serviceCategories: ServiceCategoryId[];
  businessTopics: BusinessTopicId[];
  /** Short editorial label for the city discovery rail. */
  discoverTitle: string;
};

/* ───────────────────────── People ───────────────────────── */

export type UserType = 'expat' | 'local' | 'tourist' | 'entrepreneur' | 'professional' | 'student' | 'nomad';

export type Interest =
  | 'sports'
  | 'wellness'
  | 'food'
  | 'nightlife'
  | 'business'
  | 'startups'
  | 'art'
  | 'music'
  | 'outdoors'
  | 'fashion'
  | 'tech'
  | 'languages'
  | 'family'
  | 'travel';

export type Intent = 'similar' | 'friends' | 'sports' | 'business' | 'activities' | 'explore';

export type Availability = 'mornings' | 'evenings' | 'weekends' | 'flexible';

export type Person = {
  id: string;
  name: string;
  age: number;
  types: UserType[];
  headline: string;
  bio: string;
  cityId: CityId;
  areaId: string;
  interests: Interest[];
  activities: ActivityKind[];
  intents: Intent[];
  availability: Availability[];
  languages: string[];
  origin: string;
  since: string;
  verified: boolean;
  /** Seed for the generated avatar gradient. */
  hue: number;
  online?: boolean;
  /** Profile photo (example portrait in the demo build). */
  photo?: string;
};

/* ───────────────────────── Things to do ───────────────────────── */

export type ActivityKind =
  | 'padel'
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'running'
  | 'yoga'
  | 'gym'
  | 'hiking'
  | 'surf'
  | 'cycling'
  | 'swimming'
  | 'boxing'
  | 'volleyball'
  | 'kayak'
  | 'wellness'
  | 'beach'
  | 'networking';

export type Level = 'all' | 'beginner' | 'intermediate' | 'advanced';

/** Every visual in IRLY is a real photograph. */
/** A catalogue photo, or a member's own photo (uri) with the catalogue one as fallback. */
export type Visual = { photo: PhotoKey; uri?: string | null };

export type When = { dayOffset: number; time: string; durationMin: number };

export type ActivitySession = {
  id: string;
  cityId: CityId;
  kind: ActivityKind;
  title: string;
  areaId: string;
  venue: string;
  when: When;
  level: Level;
  spots: number;
  goingIds: string[];
  extraGoing: number;
  hostId: string;
  price: number;
  communityId?: string;
  visual?: Visual;
};

export type EventCategory = 'sports' | 'networking' | 'party' | 'wellness' | 'business' | 'culture' | 'food';

export type IrlEvent = {
  id: string;
  cityId: CityId;
  title: string;
  category: EventCategory;
  areaId: string;
  venue: string;
  when: When;
  price: number;
  capacity: number;
  goingIds: string[];
  extraGoing: number;
  host: string;
  hostVerified: boolean;
  description: string;
  highlights: string[];
  visual: Visual;
  featured?: boolean;
};

export type PlaceKind = 'restaurant' | 'cafe' | 'beachclub' | 'rooftop' | 'coworking' | 'market' | 'gallery' | 'nature';

export type Place = {
  id: string;
  cityId: CityId;
  name: string;
  kind: PlaceKind;
  areaId: string;
  blurb: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  tags: string[];
  visual: Visual;
  irlyPick?: boolean;
};

export type Community = {
  id: string;
  cityId: CityId;
  name: string;
  tagline: string;
  description: string;
  members: number;
  memberIds: string[];
  kind: 'interest' | 'neighbourhood' | 'professional' | 'sport';
  rhythm: string;
  interests: Interest[];
  visual: Visual;
  verified?: boolean;
};

/* ───────────────────────── Services & business ───────────────────────── */

export type ServiceCategoryId =
  | 'housing'
  | 'car'
  | 'relocation'
  | 'visa'
  | 'setup'
  | 'realestate'
  | 'pros'
  | 'moving'
  | 'cleaning'
  | 'maintenance'
  | 'villa'
  | 'scooter'
  | 'coworking'
  | 'surf'
  | 'wellness'
  | 'transport'
  | 'tours'
  | 'local';

export type ServiceProvider = {
  id: string;
  cityId: CityId;
  category: ServiceCategoryId;
  name: string;
  tagline: string;
  description: string;
  priceFrom: number;
  unit: string;
  rating: number;
  reviews: number;
  responseTime: string;
  languages: string[];
  perks: string[];
  areaId: string;
  visual: Visual;
};

export type BusinessTopicId = 'setup' | 'visa' | 'networking' | 'professionals' | 'founders' | 'freelancers' | 'companies';

export type BusinessGuide = {
  id: string;
  cityId: CityId;
  topic: BusinessTopicId;
  title: string;
  summary: string;
  steps: string[];
  facts: { label: string; value: string }[];
};

export type Professional = {
  id: string;
  cityId: CityId;
  name: string;
  role: string;
  org: string;
  topic: BusinessTopicId;
  rating: number;
  reviews: number;
  languages: string[];
  personId?: string;
  hue: number;
};

/* ───────────────────────── Social ───────────────────────── */

export type FeedRef = { type: 'session'; id: string } | { type: 'event'; id: string };

/**
 * A real-life plan surfaced in the Social feed. The headline is computed
 * from the referenced session/event ("3 people are playing basketball
 * tomorrow.") so it always reflects live counts and dates.
 */
export type FeedPlan = {
  id: string;
  cityId: CityId;
  icon: IconName;
  ref: FeedRef;
  /** For events: the short noun used in the headline ("Networking dinner"). */
  label?: string;
  note?: string;
  postedMinAgo: number;
};

export type Editorial = {
  id: string;
  cityId: CityId;
  kicker: string;
  title: string;
  body: string;
  visual: Visual;
  areaId?: string;
};

/** `minAgo` for seed messages, `at` (epoch ms) for messages sent in the app. */
export type Message = { id: string; from: string; text: string; minAgo: number; at?: number };

export type Conversation = {
  id: string;
  cityId: CityId;
  kind: 'direct' | 'group' | 'event' | 'community' | 'service';
  title: string;
  personIds: string[];
  messages: Message[];
  unread: number;
  refId?: string;
  /** Server chats: the other member of a private chat, and each chat's own picture. */
  otherId?: string;
  /** The other member's profile photo (a storage path or an IRLY avatar). */
  otherPhoto?: string;
  /** The chat's own photo: the community's, the group's or the activity's (in "activity-photos"). */
  photoPath?: string;
  members?: number;
  /** The last message was a photo. */
  lastIsPhoto?: boolean;
  lastSenderName?: string;
};

/** Everything IRLY knows about one city. */
export type CityContent = {
  people: Person[];
  sessions: ActivitySession[];
  events: IrlEvent[];
  places: Place[];
  communities: Community[];
  services: ServiceProvider[];
  guides: BusinessGuide[];
  professionals: Professional[];
  feed: FeedPlan[];
  editorials: Editorial[];
  conversations: Conversation[];
};
