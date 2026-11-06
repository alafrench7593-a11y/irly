import { NotFound } from '@/components/layout/NotFound';

/**
 * Group chats were removed on 2026-11-06 (migration 20261109050000): their
 * old links say so. Community, activity and private chats stay in Messages.
 */
export default function NewGroupScreen() {
  return <NotFound title="Group chats are no longer available" />;
}
