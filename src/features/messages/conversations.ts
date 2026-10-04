import { findConversation, findPerson, findService, getCityContent } from '@/data/repo';
import type { CityId, Conversation, Message } from '@/data/types';

/**
 * Conversations = seed threads for the city + a fresh thread for every new
 * connection. In production this is the chat backend (rooms per activity,
 * community, booking), mirrored from IRLY v1's centralised chat store.
 */
export function cityConversations(cityId: CityId, connections: Record<string, 'pending' | 'connected'>): Conversation[] {
  const seed = getCityContent(cityId).conversations;
  const direct = new Set(seed.filter((c) => c.kind === 'direct').flatMap((c) => c.personIds));
  const fresh: Conversation[] = Object.entries(connections)
    .filter(([id, state]) => state === 'connected' && !direct.has(id) && findPerson(id)?.cityId === cityId)
    .map(([id]) => newConversation(id, cityId));
  return [...fresh, ...seed];
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
