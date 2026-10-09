import { supabase } from '@/lib/supabase';
import { changed } from './sync';

/**
 * Group chats people create (the server checks every rule: who may be
 * added, who may rename, the last one out deletes the group).
 */

function sb() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

const friendly = (m: string) =>
  /not accept/i.test(m) ? 'One of these people does not accept messages from you' : /fetch|network/i.test(m) ? 'No connection: try again' : m;

// One tap = one group: the same request while it is on its way is reused.
let creating: { key: string; promise: Promise<string> } | null = null;

/** Creates a group (you are its admin) and returns its conversation id. */
export function createGroup(title: string, members: string[], photoPath: string | null = null): Promise<string> {
  const key = JSON.stringify([title.trim(), [...members].sort(), photoPath]);
  if (creating?.key === key) return creating.promise;
  const promise = (async () => {
    const { data, error } = await sb().rpc('create_group', { p_title: title.trim(), p_members: members, p_photo: photoPath });
    if (error) throw new Error(friendly(error.message));
    changed('inbox');
    return data as string;
  })().finally(() => {
    creating = null;
  });
  creating = { key, promise };
  return promise;
}

export async function renameGroup(conversationId: string, title: string): Promise<void> {
  const { error } = await sb().rpc('rename_group', { p_conversation: conversationId, p_title: title });
  if (error) throw new Error(friendly(error.message));
  changed('inbox');
}

export async function leaveGroup(conversationId: string): Promise<void> {
  const { error } = await sb().rpc('leave_group', { p_conversation: conversationId });
  if (error) throw new Error(friendly(error.message));
  changed('inbox');
}
