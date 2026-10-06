import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DESTINATIONS } from '@/data/destinations';
import type {
  ActivityKind,
  CityId,
  DestinationId,
  Intent,
  Interest,
  Message,
  UserType,
} from '@/data/types';
import { setHapticsEnabled } from '@/motion/haptics';
import type { CreateFormat } from '@/features/create/createStore';
import type { CategoryKey } from '@/data/catalog/categories';

export type Appearance = 'auto' | 'day' | 'night';

export type Gender = 'woman' | 'man' | 'other';

export type LookingFor =
  | 'friends'
  | 'sport'
  | 'networking'
  | 'activities'
  | 'travel'
  | 'food'
  | 'nightlife'
  | 'communities'
  | 'dogwalk'
  | 'events'
  | 'irlygirl';

export type Profile = {
  /** The account this on-device profile was published to; never sent to another one. */
  ownerId?: string;
  name: string;
  types: UserType[];
  interests: Interest[];
  activities: ActivityKind[];
  /** Required to finish signing up. Local URI until the server stores it. */
  photoUri?: string;
  age?: number;
  bio?: string;
  country?: string;
  languages?: string[];
  /** Declared at signup. Gives access to IRLY Girl when 'woman'. */
  gender?: Gender;
  lookingFor?: LookingFor[];
  /**
   * Optional and private. Never shown to anyone unless the member turns
   * `faithVisible` on, and never used to rank or filter people.
   */
  faith?: string;
  faithVisible?: boolean;
  /** When the member arrived in the city (for "New in Dubai · 12 days"). */
  arrivedAt?: number;
};

/**
 * A session created by the member. Universal: any catalog entry (category →
 * subcategory → activity) or a custom activity becomes one. `kind` is kept
 * for sessions created before the catalog existed.
 */
export type MyPlan = {
  id: string;
  cityId: CityId;
  kind?: ActivityKind;
  categoryId?: CategoryKey;
  subId?: string;
  activityId?: string;
  title?: string;
  place?: string;
  description?: string;
  privacy?: 'public' | 'connections' | 'community' | 'invite';
  note?: string;
  /** Sport, event, trip, meetup… (how it was created). */
  format?: CreateFormat;
  /** 0 = free. In `currency`, the destination's. */
  price?: number;
  currency?: string;
  day: string;
  time: string;
  /** 0 = unlimited. */
  spots: number;
  areaId: string;
  createdAt: number;
  /** The same plan on the server, once it was saved there (avoids showing it twice). */
  serverId?: string;
  /** The creator's own photo, on this phone. */
  coverUri?: string;
};

export type Booking = {
  id: string;
  serviceId: string;
  dateLabel: string;
  slot: string;
  createdAt: number;
};

type Flags = Record<string, true>;

type State = {
  hydrated: boolean;
  onboarded: boolean;
  destinationId: DestinationId | null;
  cityId: CityId | null;
  profile: Profile;
  appearance: Appearance;
  hapticsOn: boolean;
  joined: Flags;
  /** Answers other than "going" (going lives in `joined`). */
  rsvp: Record<string, 'maybe' | 'no'>;
  saved: Flags;
  memberOf: Flags;
  connections: Record<string, 'pending' | 'connected'>;
  bookings: Booking[];
  sent: Record<string, Message[]>;
  read: Flags;
  waitlist: Flags;
  lastIntent: Intent | null;
  myPlans: MyPlan[];
};

type Actions = {
  setDestination: (destinationId: DestinationId, cityId?: CityId) => void;
  setCity: (cityId: CityId) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  /** Wipes everything on this device: profile, plans, messages, connections. */
  deleteAccount: () => void;
  setAppearance: (a: Appearance) => void;
  setHaptics: (on: boolean) => void;
  toggleJoin: (id: string) => boolean;
  setRsvp: (id: string, answer: 'going' | 'maybe' | 'no') => void;
  toggleSave: (id: string) => boolean;
  toggleMembership: (id: string) => boolean;
  connect: (personId: string) => void;
  book: (b: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  sendMessage: (conversationId: string, text: string) => void;
  receiveMessage: (conversationId: string, from: string, text: string) => void;
  markRead: (conversationId: string) => void;
  joinWaitlist: (destinationId: DestinationId) => void;
  setIntent: (intent: Intent) => void;
  postPlan: (plan: Omit<MyPlan, 'id' | 'createdAt'>) => MyPlan;
  linkPlan: (id: string, serverId: string) => void;
};

export const emptyProfile: Profile = { name: '', types: [], interests: [], activities: [], languages: [], lookingFor: [] };

/**
 * Storage that never throws: private browsing, sandboxed web views and
 * quota errors degrade to in-memory state instead of breaking the app.
 */
const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const v = await AsyncStorage.getItem(name);
      return v ?? memory.get(name) ?? null;
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem: async (name, value) => {
    memory.set(name, value);
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // keep the in-memory copy
    }
  },
  removeItem: async (name) => {
    memory.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

function toggle(flags: Flags, id: string): [Flags, boolean] {
  const next = { ...flags };
  if (next[id]) {
    delete next[id];
    return [next, false];
  }
  next[id] = true;
  return [next, true];
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      destinationId: null,
      cityId: null,
      profile: emptyProfile,
      appearance: 'auto',
      hapticsOn: true,
      joined: {},
      rsvp: {},
      saved: {},
      memberOf: {},
      connections: {},
      bookings: [],
      sent: {},
      read: {},
      waitlist: {},
      lastIntent: null,
      myPlans: [],

      setDestination: (destinationId, cityId) =>
        set({ destinationId, cityId: cityId ?? DESTINATIONS[destinationId].defaultCity ?? null }),
      setCity: (cityId) => {
        const destinationId = (Object.keys(DESTINATIONS) as DestinationId[]).find((d) =>
          DESTINATIONS[d].cities.includes(cityId),
        );
        set({ cityId, destinationId: destinationId ?? get().destinationId });
      },
      updateProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      completeOnboarding: () => set({ onboarded: true }),
      deleteAccount: () =>
        set({
          onboarded: false,
          destinationId: null,
          cityId: null,
          profile: emptyProfile,
          lastIntent: null,
          joined: {},
          rsvp: {},
          saved: {},
          memberOf: {},
          connections: {},
          bookings: [],
          sent: {},
          read: {},
          myPlans: [],
        }),
      resetOnboarding: () =>
        set({ onboarded: false, destinationId: null, cityId: null, profile: emptyProfile, lastIntent: null }),
      setAppearance: (appearance) => set({ appearance }),
      setHaptics: (hapticsOn) => {
        setHapticsEnabled(hapticsOn);
        set({ hapticsOn });
      },
      setRsvp: (id, answer) => {
        const joined = { ...get().joined };
        const rsvp = { ...get().rsvp };
        if (answer === 'going') {
          joined[id] = true;
          delete rsvp[id];
        } else {
          delete joined[id];
          rsvp[id] = answer;
        }
        set({ joined, rsvp });
      },
      toggleJoin: (id) => {
        const [joined, on] = toggle(get().joined, id);
        set({ joined });
        return on;
      },
      toggleSave: (id) => {
        const [saved, on] = toggle(get().saved, id);
        set({ saved });
        return on;
      },
      toggleMembership: (id) => {
        const [memberOf, on] = toggle(get().memberOf, id);
        set({ memberOf });
        return on;
      },
      connect: (personId) => {
        if (get().connections[personId]) return;
        set({ connections: { ...get().connections, [personId]: 'pending' } });
        // Simulates the other person accepting: real-life apps feel alive.
        setTimeout(() => {
          const current = useStore.getState().connections;
          if (current[personId] === 'pending') {
            useStore.setState({ connections: { ...current, [personId]: 'connected' } });
          }
        }, 2600);
      },
      book: (b) => {
        const booking: Booking = { ...b, id: `bk-${Date.now()}`, createdAt: Date.now() };
        set({ bookings: [booking, ...get().bookings] });
        return booking;
      },
      sendMessage: (conversationId, text) => {
        const list = get().sent[conversationId] ?? [];
        const msg: Message = { id: `me-${Date.now()}`, from: 'me', text, minAgo: 0, at: Date.now() };
        set({ sent: { ...get().sent, [conversationId]: [...list, msg] } });
      },
      markRead: (conversationId) => {
        if (get().read[conversationId]) return;
        set({ read: { ...get().read, [conversationId]: true } });
      },
      receiveMessage: (conversationId, from, text) => {
        const list = get().sent[conversationId] ?? [];
        const msg: Message = { id: `in-${Date.now()}`, from, text, minAgo: 0, at: Date.now() };
        set({ sent: { ...get().sent, [conversationId]: [...list, msg] } });
      },
      joinWaitlist: (destinationId) => set({ waitlist: { ...get().waitlist, [destinationId]: true } }),
      setIntent: (lastIntent) => set({ lastIntent }),
      postPlan: (plan) => {
        const created: MyPlan = { ...plan, id: `my-${Date.now()}`, createdAt: Date.now() };
        set({ myPlans: [created, ...get().myPlans] });
        return created;
      },
      linkPlan: (id, serverId) => set({ myPlans: get().myPlans.map((p) => (p.id === id ? { ...p, serverId } : p)) }),
    }),
    {
      name: 'irly-v2',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (state) setHapticsEnabled(state.hapticsOn);
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Selected city id, guaranteed once onboarding is done. */
export function useCityId(): CityId {
  return useStore((s) => s.cityId) ?? 'dubai';
}
