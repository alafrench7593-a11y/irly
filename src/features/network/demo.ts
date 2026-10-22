import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { DEMO } from '@/config/app';
import { cityScope } from '@/data/destinations';
import { findPerson } from '@/data/repo';
import type { CityId } from '@/data/types';
import { useAppSpace, type AppSpace } from '@/state/appSpace';
import { useStore } from '@/state/store';
import type { ProDraft, ProFilters } from './api';
import { NO_LINKS } from './links';
import type { ProProfile } from './match';
import type { IndustryId, IntentId, RoleId } from './taxonomy';

/**
 * IRLY Network in the demonstration build: the same screens, fed with
 * illustrative professional profiles of the demo's example people (the p-*
 * people of data/content, with their example portraits) instead of the
 * server.
 *
 * DEMO ONLY. Every hook here mirrors a real one of api.ts (same shape) and
 * is only picked when DEMO is true, at module level. Connections and your
 * professional profile stay in this tab's memory: nothing is sent or read
 * anywhere, and the demo says so on every screen. None of these people is
 * a member.
 *
 * In IRLY Girl, Network is women only (as pro_discover_girl on the server):
 * the demo lists only the women below (`woman`), and a man's profile does
 * not open there, not even from a link.
 */

type Seed = {
  id: string;
  role: RoleId;
  jobTitle: string;
  company: string | null;
  industries: IndustryId[];
  skills: string[];
  project: string | null;
  lookingFor: string | null;
  canOffer: string | null;
  intents: IntentId[];
  /** Shown with initials (no photo), as members without a photo are. */
  noPhoto?: boolean;
  /** A woman: also listed in IRLY Girl's Network (women only). */
  woman?: boolean;
  /** Only in IRLY Girl's Network (a woman of the IRLY Girl demo). */
  girlOnly?: boolean;
  connection?: ProProfile['connection'];
};

const SEEDS: Seed[] = [
  { id: 'p-omar', role: 'entrepreneur', jobTitle: 'Founder', company: 'Haul', industries: ['startups', 'mobility', 'trade'], skills: ['Operations', 'Supply chain', 'Fundraising'], project: 'Same-day freight between Jebel Ali and the city', lookingFor: 'A technical cofounder and first B2B clients in retail', canOffer: 'Intros to freight forwarders and the free zones', intents: ['cofounder', 'clients', 'investors'], connection: 'incoming' },
  { id: 'p-layla', woman: true, role: 'employee', jobTitle: 'Product designer', company: null, industries: ['fintech', 'design'], skills: ['UI/UX', 'Product', 'Branding'], project: 'Redesigning a payments app for first-time investors', lookingFor: 'Founders who care about design', canOffer: 'Design reviews and UX audits', intents: ['ideas', 'opportunities'], connection: 'requested' },
  { id: 'p-arjun', role: 'investor', jobTitle: 'Investment analyst', company: null, industries: ['fintech', 'saas', 'ai'], skills: ['Finance', 'Data', 'Fundraising'], project: null, lookingFor: 'Pre-seed B2B software teams in the Gulf', canOffer: 'Feedback on pitch decks and financial models', intents: ['opportunities', 'ideas'] },
  { id: 'p-nadia', woman: true, role: 'entrepreneur', jobTitle: 'Founder', company: 'Bloom Studio', industries: ['health', 'business'], skills: ['Branding', 'Operations', 'Hiring'], project: 'A second wellness studio in Jumeirah', lookingFor: 'Partners for corporate wellness programmes', canOffer: 'Wellness sessions for teams, a community of 2,000 members', intents: ['partners', 'grow', 'suppliers'] },
  { id: 'p-lucas', role: 'freelancer', jobTitle: 'Freelance developer', company: null, industries: ['tech', 'apps', 'ai'], skills: ['React', 'Python', 'AI/ML'], project: 'AI booking assistants for restaurants', lookingFor: 'Clients who need an MVP in six weeks', canOffer: 'Web and mobile apps, AI prototypes', intents: ['clients', 'cofounder'], connection: 'connected' },
  { id: 'p-james', role: 'employee', jobTitle: 'Head of Sales', company: null, industries: ['saas', 'tech'], skills: ['Sales', 'Partnerships', 'Hiring'], project: null, lookingFor: 'Channel partners across the GCC', canOffer: 'Sales playbooks and hiring advice', intents: ['partners', 'ideas'] },
  { id: 'p-amira', woman: true, role: 'freelancer', jobTitle: 'Corporate lawyer', company: 'Haddad Legal', industries: ['legal', 'business'], skills: ['Legal', 'Fundraising'], project: null, lookingFor: 'Startups setting up in the free zones', canOffer: 'Company setup, shareholder agreements, term sheets', intents: ['clients', 'partners'] },
  { id: 'p-sofia', woman: true, role: 'freelancer', jobTitle: 'Content creator', company: null, industries: ['creator', 'media', 'marketing'], skills: ['Content', 'Video', 'Social media'], project: 'A video series on Dubai’s small brands', lookingFor: 'Brands for long-term partnerships', canOffer: 'Short videos, a 40k audience in the Emirates', intents: ['clients', 'partners'] },
  { id: 'p-yusuf', role: 'employee', jobTitle: 'Data engineer', company: null, industries: ['ai', 'tech'], skills: ['Python', 'Data', 'AI/ML'], project: 'An open dataset of Dubai’s traffic', lookingFor: 'A cofounder for a data product', canOffer: 'Data pipelines and dashboards', intents: ['cofounder', 'ideas', 'job'], noPhoto: true },
  { id: 'p-samuel', role: 'entrepreneur', jobTitle: 'Founder', company: null, industries: ['retail', 'ecommerce', 'design'], skills: ['Branding', 'Growth', 'Paid ads'], project: 'A streetwear label made in the UAE', lookingFor: 'Investors and a local manufacturer', canOffer: 'E-commerce growth, launch playbooks', intents: ['investors', 'suppliers', 'partners'] },
  { id: 'p-khalid', role: 'employee', jobTitle: 'Real estate advisor', company: null, industries: ['realestate'], skills: ['Real estate', 'Sales'], project: null, lookingFor: 'Founders looking for office space', canOffer: 'Market insight on offices and retail units', intents: ['clients', 'investors'] },
  { id: 'p-chloe', woman: true, role: 'employee', jobTitle: 'Marketing manager', company: null, industries: ['marketing', 'food'], skills: ['Growth', 'SEO', 'Social media'], project: null, lookingFor: 'Restaurant founders opening this year', canOffer: 'Launch campaigns and local press', intents: ['opportunities', 'job'] },
  // Women of the IRLY Girl demo (content/girls.ts), in IRLY Girl's Network only.
  { id: 'g-amira', woman: true, girlOnly: true, role: 'founder', jobTitle: 'Founder', company: 'Glow Lab', industries: ['ecommerce', 'health'], skills: ['Branding', 'Fundraising', 'Growth'], project: 'A skincare brand made for the Gulf climate', lookingFor: 'Women founders to swap retail contacts with', canOffer: 'Intros to beauty retailers and labs', intents: ['partners', 'investors', 'ideas'] },
  { id: 'g-elena', woman: true, girlOnly: true, role: 'employee', jobTitle: 'Corporate lawyer', company: null, industries: ['legal', 'fintech'], skills: ['Legal', 'Fundraising'], project: null, lookingFor: 'Women in law and finance to meet every month', canOffer: 'Advice on company setup in DIFC', intents: ['meet', 'opportunities'] },
  { id: 'g-hana', woman: true, girlOnly: true, role: 'employee', jobTitle: 'UX lead', company: null, industries: ['fintech', 'design'], skills: ['UI/UX', 'Product'], project: null, lookingFor: 'Women in product and design', canOffer: 'Portfolio reviews and mentoring', intents: ['ideas', 'meet'], connection: 'incoming' },
];

const photoPath = (id: string) => `demo/${id}`;

/** The illustrative profiles, built from the demo people (name, area, portrait). */
const PROS: ProProfile[] = DEMO
  ? SEEDS.flatMap((s) => {
      const person = findPerson(s.id);
      if (!person) return [];
      return [
        {
          userId: s.id,
          firstName: person.name,
          photoPath: s.noPhoto || !person.photo ? null : photoPath(s.id),
          role: s.role,
          jobTitle: s.jobTitle,
          company: s.company,
          industries: s.industries,
          skills: s.skills,
          project: s.project,
          lookingFor: s.lookingFor,
          canOffer: s.canOffer,
          intents: s.intents,
          cityId: person.cityId,
          areaId: person.areaId,
          lat: null,
          lng: null,
          connection: s.connection ?? 'none',
          gender: s.woman ? 'woman' : 'man',
        },
      ];
    })
  : [];

const PHOTOS: Record<string, string> = DEMO ? Object.fromEntries(SEEDS.flatMap((s) => (findPerson(s.id)?.photo ? [[photoPath(s.id), findPerson(s.id)?.photo as string]] : []))) : {};

type DemoNetwork = {
  me: ProProfile | null;
  visible: boolean;
  connection: Record<string, ProProfile['connection']>;
  setConnection: (id: string, c: ProProfile['connection']) => void;
  setMe: (me: ProProfile | null, visible: boolean) => void;
};

const useDemoNetwork = create<DemoNetwork>((set) => ({
  me: DEMO
    ? { userId: 'demo-me', firstName: 'You', photoPath: null, role: 'entrepreneur', jobTitle: 'Founder', company: null, industries: ['ai', 'saas'], skills: ['Product', 'Growth', 'AI/ML'], project: 'An AI assistant for small clinics', lookingFor: 'A technical cofounder', canOffer: 'Product and growth advice', intents: ['cofounder', 'partners', 'ideas'], cityId: 'dubai', areaId: 'marina', lat: null, lng: null, connection: 'none' }
    : null,
  visible: true,
  connection: {},
  setConnection: (id, c) => set((s) => ({ connection: { ...s.connection, [id]: c } })),
  setMe: (me, visible) => set({ me, visible }),
}));

/** Demo only: `localStorage['irly-network-demo-offline'] = '1'` shows the "can't reach IRLY" state. */
function offline(): boolean {
  try {
    return DEMO && globalThis.localStorage?.getItem('irly-network-demo-offline') === '1';
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same shape as useMyPro. */
export function useDemoMyPro() {
  const me = useDemoNetwork((s) => s.me);
  const visible = useDemoNetwork((s) => s.visible);
  const setMe = useDemoNetwork((s) => s.setMe);
  const name = useStore((s) => s.profile?.name);
  const gender = useStore((s) => s.profile?.gender) ?? null;
  const pro = useMemo(() => (me ? { ...me, firstName: name || me.firstName, gender } : null), [me, name, gender]);
  const save = useCallback(
    async (d: ProDraft) => {
      await wait(500);
      setMe(
        { userId: 'demo-me', firstName: name || 'You', photoPath: null, role: d.role, jobTitle: d.jobTitle.trim(), company: d.company.trim() || null, industries: d.industries, skills: d.skills, project: d.project.trim() || null, lookingFor: d.lookingFor.trim() || null, canOffer: d.canOffer.trim() || null, intents: d.intents, cityId: d.cityId, areaId: d.areaId, lat: null, lng: null, connection: 'none' },
        d.visible,
      );
    },
    [setMe, name],
  );
  const remove = useCallback(async () => {
    await wait(400);
    setMe(null, true);
  }, [setMe]);
  return { pro, visible, links: NO_LINKS, linksOn: false, loading: false, error: null as string | null, save, remove, reload: () => undefined, signedIn: true };
}

const list = (connection: Record<string, ProProfile['connection']>) => PROS.map((p) => (connection[p.userId] ? { ...p, connection: connection[p.userId] } : p));

const WOMEN = new Set(SEEDS.filter((s) => s.woman).map((s) => s.id));
const GIRL_ONLY = new Set(SEEDS.filter((s) => s.girlOnly).map((s) => s.id));

/** Who Network shows in this space: in IRLY Girl the women only, in IRLY everyone but the IRLY Girl demo's women. */
const inSpace = (userId: string, space: AppSpace) => (space === 'girl' ? WOMEN.has(userId) : !GIRL_ONLY.has(userId));

/** What pro_discover answers, on the demo profiles. */
function discover(all: ProProfile[], cityId: string, f: ProFilters): ProProfile[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const scope = cityScope(cityId as CityId) as string[];
  return all.filter(
    (p) =>
      (f.city ? p.cityId === f.city : scope.includes(p.cityId)) &&
      (!f.industry || p.industries.includes(f.industry)) &&
      (!f.role || p.role === f.role) &&
      (!f.intent || p.intents.includes(f.intent)) &&
      (!q || [p.jobTitle, p.company ?? '', p.skills.join(' '), p.project ?? ''].some((x) => x.toLowerCase().includes(q))),
  );
}

/** Same shape as usePros: answers after a short pause, like the server, keeping the last list meanwhile. */
export function useDemoPros(cityId: string, filters: ProFilters) {
  const connection = useDemoNetwork((s) => s.connection);
  const setOne = useDemoNetwork((s) => s.setConnection);
  const [attempt, setAttempt] = useState(0);
  const space = useAppSpace();
  const key = `${space}|${cityId}|${JSON.stringify(filters)}|${attempt}`;
  const [res, setRes] = useState<{ for: string; ids: string[]; error: string | null }>({ for: '', ids: [], error: null });
  const first = useRef(true);
  useEffect(() => {
    const id = setTimeout(
      () => {
        first.current = false;
        if (offline()) setRes((r) => ({ for: key, ids: r.ids, error: 'offline' }));
        else setRes({ for: key, ids: discover(PROS.filter((p) => inSpace(p.userId, space)), cityId, filters).map((p) => p.userId), error: null });
      },
      first.current ? 900 : 420,
    );
    return () => clearTimeout(id);
    // `key` holds the space, the filters and the city.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const all = useMemo(() => list(connection), [connection]);
  // The last list stays while the next one loads, never across spaces (no man in IRLY Girl, even for a moment).
  const shown = useMemo(
    () => res.ids.filter((id) => inSpace(id, space)).map((id) => all.find((p) => p.userId === id)).filter((p): p is ProProfile => Boolean(p)),
    [res.ids, all, space],
  );
  const setConnection = useCallback((userId: string, c: ProProfile['connection']) => setOne(userId, c), [setOne]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const retrying = res.for !== key && res.error != null;
  return { list: shown, photos: PHOTOS, loading: res.for !== key, retrying, error: res.error, setConnection, retry, signedIn: true };
}

/** Same shape as usePro. */
export function useDemoPro(userId: string) {
  const connection = useDemoNetwork((s) => s.connection);
  const setOne = useDemoNetwork((s) => s.setConnection);
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState({ for: '', failed: false });
  const space = useAppSpace();
  const key = `${space}|${userId}|${attempt}`;
  useEffect(() => {
    const id = setTimeout(() => setRes({ for: key, failed: offline() }), 450);
    return () => clearTimeout(id);
  }, [key]);
  // In IRLY Girl a man's profile does not open, even from a link (as pro_profile_of_girl).
  const pro = useMemo(() => (inSpace(userId, space) ? (list(connection).find((p) => p.userId === userId) ?? null) : null), [connection, userId, space]);
  const setConnection = useCallback((c: ProProfile['connection']) => setOne(userId, c), [setOne, userId]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // As on the server: a retry keeps the failure on screen until it answers.
  const waiting = res.for !== key;
  const state: 'loading' | 'ready' | 'missing' | 'error' = res.failed ? 'error' : waiting ? 'loading' : pro ? 'ready' : 'missing';
  return { pro: state === 'ready' ? pro : null, photo: state === 'ready' && pro?.photoPath ? (PHOTOS[pro.photoPath] ?? null) : null, links: NO_LINKS, state, retrying: waiting && res.failed, setConnection, retry };
}

/** Connect in the demo: answered after a moment, kept in this tab only. */
export async function demoConnect(userId: string): Promise<string> {
  await wait(650);
  if (offline()) throw new Error('No connection. Check your network and try again');
  const now = useDemoNetwork.getState().connection[userId] ?? PROS.find((p) => p.userId === userId)?.connection;
  const accepted = now === 'incoming';
  useDemoNetwork.getState().setConnection(userId, accepted ? 'connected' : 'requested');
  return accepted ? 'accepted' : 'pending';
}

/** Withdraw, decline or remove in the demo. */
export async function demoDisconnect(userId: string): Promise<void> {
  await wait(500);
  if (offline()) throw new Error('No connection. Check your network and try again');
  useDemoNetwork.getState().setConnection(userId, 'none');
}
