import { findCommunity, findConversation, findPerson, findService, getCityContent } from '@/data/repo';
import { t as tx } from '@/i18n';
import type { CityId, Conversation, Message } from '@/data/types';
import { useGirlStore, type LocalMatch } from '@/features/girl/girlStore';
import { labelOf } from '@/features/girl/taxonomy';

/**
 * Conversations = seed threads for the city + a fresh thread for every new
 * connection. In production this is the chat backend (rooms per activity,
 * community, booking), mirrored from IRLY v1's centralised chat store.
 */
export function cityConversations(
  cityId: CityId,
  connections: Record<string, 'pending' | 'connected'>,
  memberOf: Record<string, true> = {},
  matches: LocalMatch[] = [],
): Conversation[] {
  const seed = getCityContent(cityId).conversations;
  const direct = new Set(seed.filter((c) => c.kind === 'direct').flatMap((c) => c.personIds));
  const fresh: Conversation[] = Object.entries(connections)
    .filter(([id, state]) => state === 'connected' && !direct.has(id) && findPerson(id)?.cityId === cityId)
    .map(([id]) => newConversation(id, cityId));
  // Joining a community joins its chat: no separate step to find it.
  const withChat = new Set(seed.filter((c) => c.kind === 'community').map((c) => c.refId));
  const communities: Conversation[] = Object.keys(memberOf)
    .filter((id) => !withChat.has(id) && findCommunity(id)?.cityId === cityId)
    .map((id) => communityConversation(id))
    .filter((c): c is Conversation => Boolean(c));
  // Every IRLY match opens a private chat, with starters from what you share.
  const matchChats = matches
    .filter((m) => findPerson(m.userId)?.cityId === cityId)
    .map((m) => matchConversation(m))
    .filter((c): c is Conversation => Boolean(c));
  return [...matchChats, ...communities, ...fresh, ...seed];
}

/** The private chat of an IRLY match (on-device mode). */
export function matchConversation(m: LocalMatch): Conversation | undefined {
  const p = findPerson(m.userId);
  if (!p) return undefined;
  const r = m.reasons;
  const starter = r.sports[0]
    ? `You both love ${labelOf(r.sports[0])} 👀`
    : r.activities[0]
      ? `You both like ${labelOf(r.activities[0]).toLowerCase()}.`
      : r.travel.length
        ? 'You both love travelling ✈️'
        : r.interests[0]
          ? `You\'re both into ${labelOf(r.interests[0]).toLowerCase()}.`
          : 'You both want to meet new people.';
  const minutes = Math.max(1, (Date.now() - m.createdAt) / 60000);
  return {
    id: m.conversationId,
    cityId: p.cityId,
    kind: 'direct',
    title: p.name,
    personIds: [p.id],
    unread: 0,
    refId: m.id,
    messages: [
      { id: `${m.id}-sys`, from: 'irly', text: "It's an IRLY match. Say hello!", minAgo: minutes },
      { id: `${m.id}-s1`, from: 'irly', text: starter, minAgo: minutes },
      { id: `${m.id}-s2`, from: 'irly', text: 'Want to grab coffee or create an activity together?', minAgo: minutes },
    ],
  };
}

/** The chat every community has; members are in it from the moment they join. */
export function communityConversation(communityId: string): Conversation | undefined {
  const c = findCommunity(communityId);
  if (!c) return undefined;
  return {
    id: `cv-com-${c.id}`,
    cityId: c.cityId,
    kind: 'community',
    title: c.name,
    personIds: c.memberIds,
    unread: 0,
    refId: c.id,
    messages: [{ id: `${c.id}-welcome`, from: c.memberIds[0] ?? 'irly', text: tx('Welcome to {name}! {rhythm}. Say hi 👋', { name: c.name, rhythm: tx(c.rhythm) }), minAgo: 1 }],
  };
}

/** The chat id a member lands in after joining a community. */
export function communityChatId(communityId: string, cityId: CityId): string {
  const seed = getCityContent(cityId).conversations.find((c) => c.kind === 'community' && c.refId === communityId);
  return seed?.id ?? `cv-com-${communityId}`;
}

function newConversation(personId: string, cityId: CityId): Conversation {
  const p = findPerson(personId);
  return {
    id: `cv-new-${personId}`,
    cityId,
    kind: 'direct',
    title: p?.name ?? 'New connection',
    personIds: [personId],
    unread: 0,
    messages: [],
  };
}

export function resolveConversation(id: string, cityId: CityId): Conversation | undefined {
  if (id.startsWith('cv-new-')) return newConversation(id.replace('cv-new-', ''), cityId);
  if (id.startsWith('cv-com-')) return communityConversation(id.replace('cv-com-', ''));
  if (id.startsWith('cv-match-')) {
    const m = useGirlStore.getState().matches.find((x) => x.conversationId === id);
    return m ? matchConversation(m) : undefined;
  }
  return findConversation(id);
}

export function allMessages(c: Conversation, sent: Record<string, Message[]>): Message[] {
  return [...c.messages, ...(sent[c.id] ?? [])];
}

export function senderName(from: string): string {
  if (from === 'me') return 'You';
  return findPerson(from)?.name ?? findService(from)?.name ?? 'IRLY';
}

export function minutesAgo(m: Message): number {
  return m.at ? (Date.now() - m.at) / 60000 : m.minAgo;
}

const REPLIES = [
  'Amazing, see you there! 🙌',
  'Perfect. I’ll save you a spot.',
  'Yes! Bring a friend if you like.',
  'Great, I’ll share the exact location tomorrow morning.',
];

export function cannedReply(seed: number): string {
  return REPLIES[seed % REPLIES.length];
}
