import { findCommunity, findConversation, findPerson, findService, getCityContent } from '@/data/repo';
import type { CityId, Conversation, Message } from '@/data/types';

/**
 * Conversations = seed threads for the city + a fresh thread for every new
 * connection. In production this is the chat backend (rooms per activity,
 * community, booking), mirrored from IRLY v1's centralised chat store.
 */
export function cityConversations(
  cityId: CityId,
  connections: Record<string, 'pending' | 'connected'>,
  memberOf: Record<string, true> = {},
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
  return [...communities, ...fresh, ...seed];
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
    messages: [{ id: `${c.id}-welcome`, from: c.memberIds[0] ?? 'irly', text: `Welcome to ${c.name}! ${c.rhythm}. Say hi 👋`, minAgo: 1 }],
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
