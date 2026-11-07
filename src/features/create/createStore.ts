import { create } from 'zustand';
import type { CategoryKey } from '@/data/catalog/categories';
import type { When } from './when';

/** What the member is creating. Every format becomes a session with its own chat. */
export type CreateFormat = 'activity' | 'sport' | 'event' | 'session' | 'meetup' | 'trip';

export type CreatePreset = {
  categoryId?: CategoryKey;
  subId?: string;
  activityId?: string;
  format?: CreateFormat;
  communityId?: string;
  /** The community's emirate: its activities belong there. */
  cityId?: string;
  /** Opened from a community (« + Propose an activity »): its name, shown on the form as where the activity is proposed. */
  communityName?: string;
  /** An IRLY Girl community: the activity is women-only (the server enforces it too). */
  girlOnly?: boolean;
  /** Started from a chat message (« Turn into an activity »): its name and description, both editable on the form. */
  title?: string;
  description?: string;
  /** Started from an IRLY event (« Go together »): its key, stored with the activity so the event page lists it. */
  eventKey?: string;
  /** The event's name, shown on the form as what the activity is for. */
  eventTitle?: string;
  /** The event's neighbourhood, venue, date and time and photo: the form starts with them, all editable. */
  areaId?: string;
  place?: string;
  when?: When;
  /** An IRLY library photo link. */
  cover?: string;
  /**
   * Started from a post (« Create an activity » on a post card): the post's id
   * (community_posts.id). Saved as activities.source_post_id; the server checks
   * the member can see the post and refuses a second activity from the same
   * post by the same member within 2 minutes (a double tap).
   */
  sourcePostId?: string;
};

type CreateState = {
  open: boolean;
  /** Centre of the button the composer grows from, in host coordinates. */
  origin: { x: number; y: number } | null;
  /** Opened from a category, an activity or a format: the composer starts there. */
  preset: CreatePreset | null;
  show: (origin?: { x: number; y: number } | null, preset?: CreatePreset | null) => void;
  hide: () => void;
};

export const useCreateStore = create<CreateState>((set) => ({
  open: false,
  origin: null,
  preset: null,
  show: (origin, preset) => set({ open: true, origin: origin ?? null, preset: preset ?? null }),
  hide: () => set({ open: false }),
}));

/** Opens the composer, growing from `origin` when given, starting from `preset`. */
export function openCreate(origin?: { x: number; y: number } | null, preset?: CreatePreset | null) {
  useCreateStore.getState().show(origin, preset);
}

/** What a post card hands to « Create an activity ». */
export type PostActivitySeed = {
  /** community_posts.id */
  postId: string;
  /** The post's text (or its first line): the activity's name, editable. Under 3 characters, the member starts from the categories. */
  title?: string;
  /** The rest of the post, as the activity's description (editable, cut to the form's limit). */
  description?: string;
  /** The post's community: preselected (members-only visibility by default), with its name, emirate and IRLY Girl flag. */
  communityId?: string | null;
  communityName?: string;
  cityId?: string;
  girlOnly?: boolean;
};

/** The composer, started from a post: name prefilled, its community preselected, the post linked. */
export function presetFromPost(seed: PostActivitySeed): CreatePreset {
  return {
    sourcePostId: seed.postId,
    title: seed.title?.replace(/\s+/g, ' ').trim().slice(0, 80) || undefined,
    description: seed.description?.trim() || undefined,
    ...(seed.communityId ? { communityId: seed.communityId, communityName: seed.communityName, girlOnly: seed.girlOnly } : {}),
    ...(seed.cityId ? { cityId: seed.cityId } : {}),
  };
}

/** Opens the composer from a post card (« Create an activity »), growing from `origin` when given. */
export function openCreateFromPost(seed: PostActivitySeed, origin?: { x: number; y: number } | null) {
  openCreate(origin, presetFromPost(seed));
}
