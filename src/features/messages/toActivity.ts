import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import type { GeoIndex } from '@/features/ai/intent';
import { postLooksLikeAPlan } from '@/features/community/assist';
import { openCreate, type CreatePreset } from '@/features/create/createStore';
import { t as tx } from '@/i18n';
import { supabase } from '@/lib/supabase';

export type ChatCommunity = { id: string; name: string; cityId?: string; girlOnly?: boolean };

/** The community a chat belongs to, as the create form needs it (its emirate, IRLY Girl). One read, on tap only. */
export async function chatCommunity(communityId: string, fallbackName: string): Promise<ChatCommunity> {
  if (!supabase) return { id: communityId, name: fallbackName };
  const { data } = await supabase.from('communities').select('name, city_id, girl_only').eq('id', communityId).maybeSingle();
  const row = data as { name?: string; city_id?: string; girl_only?: boolean } | null;
  return { id: communityId, name: row?.name ?? fallbackName, cityId: row?.city_id, girlOnly: row?.girl_only || undefined };
}

/**
 * A chat message as the start of an activity: read the way a community
 * post is (postLooksLikeAPlan: « padel tomorrow 8pm, who's in? »), else its
 * first line as the name and the whole text as the description.
 */
export function presetFromMessage(text: string, community: ChatCommunity): CreatePreset {
  const body = text.trim();
  const city = community.cityId && community.cityId in CITIES ? CITIES[community.cityId as CityId] : undefined;
  const geo: GeoIndex = city ? { cities: [{ id: city.id, name: city.name }], areas: city.areas.map((a) => ({ id: a.id, name: a.name, cityId: city.id })) } : { cities: [], areas: [] };
  const plan = postLooksLikeAPlan(body, geo, tx);
  const firstLine = body.split('\n')[0].replace(/\s+/g, ' ').trim();
  const title = (plan?.title ?? firstLine).slice(0, 80);
  const category = plan?.category && plan.category in CATEGORY_BY_ID ? (plan.category as CategoryKey) : undefined;
  return {
    communityId: community.id,
    communityName: community.name,
    cityId: community.cityId,
    girlOnly: community.girlOnly,
    title: title.length >= 3 ? title : tx('Meetup'),
    description: body.slice(0, 1000),
    ...(category ? { categoryId: category } : {}),
  };
}

/** Opens the create form, filled from the message; nothing is created until the member publishes it. */
export function openActivityFromMessage(text: string, community: ChatCommunity): void {
  openCreate(null, presetFromMessage(text, community));
}
