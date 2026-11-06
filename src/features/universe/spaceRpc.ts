import type { SupabaseClient } from '@supabase/supabase-js';

import type { AppSpace } from '@/state/appSpace';

type Result = { data: unknown; error: { code?: string; message: string } | null };

/** A server older than migration 20261110700000 has no `p_space`: the list is then asked without it (the app still sorts it by space). */
const noSpaceParam = (e: Result['error']) => Boolean(e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message)));

/**
 * A list RPC asked for one app space only (`p_space`, migration
 * 20261110700000_irly_space_lists): the server leaves out every community
 * (and, for search, activity) of the other space, so a Girl, Mom or
 * women-only Network community never reaches the Mixte app, whatever list
 * forgets to filter.
 */
export async function rpcInSpace(sb: SupabaseClient, fn: string, args: Record<string, unknown>, space: AppSpace): Promise<Result> {
  const first = (await sb.rpc(fn, { ...args, p_space: space })) as Result;
  if (!noSpaceParam(first.error)) return first;
  return (await sb.rpc(fn, args)) as Result;
}
