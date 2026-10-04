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

export type Appearance = 'auto' | 'day' | 'night';

export type Profile = {
  name: string;
  types: UserType[];
  interests: Interest[];
  activities: ActivityKind[];
};

export type MyPlan = {
  id: string;
  cityId: CityId;
  kind: ActivityKind;
  day: string;
  time: string;
  spots: number;
  areaId: string;
  createdAt: number;
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
  setAppearance: (a: Appearance) => void;
  setHaptics: (on: boolean) => void;
  toggleJoin: (id: string) => boolean;
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
};

export const emptyProfile: Profile = { name: '', types: [], interests: [], activities: [] };

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
      resetOnboarding: () =>
        set({ onboarded: false, destinationId: null, cityId: null, profile: emptyProfile, lastIntent: null }),
      setAppearance: (appearance) => set({ appearance }),
      setHaptics: (hapticsOn) => {
        setHapticsEnabled(hapticsOn);
        set({ hapticsOn });
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
