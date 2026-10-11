import { useCallback, useEffect, useRef, useState } from 'react';
import type { IconName } from '@/components/ui/Icon';
import { useAccount } from '@/features/auth/account';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * Help & Questions: members ask, answer and recommend about life in the
 * city. Questions are posts in the city's official Help community (one group
 * per category); answers are comments. Sensitive topics show official
 * sources next to members' experience, never in place of them.
 */
export type HelpCategory = { id: string; label: string; icon: IconName; official?: { label: string; url: string }[] };

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'visa',
    label: 'Visa & paperwork',
    icon: 'idCard',
    official: [
      { label: 'u.ae, the UAE government portal', url: 'https://u.ae/en/information-and-services/visa-and-emirates-id' },
      { label: 'ICP (federal identity and residency)', url: 'https://icp.gov.ae' },
      { label: 'GDRFA Dubai (Dubai residency)', url: 'https://gdrfad.gov.ae' },
    ],
  },
  {
    id: 'schools',
    label: 'Schools & nurseries',
    icon: 'graduation',
    official: [
      { label: 'KHDA (Dubai private schools)', url: 'https://www.khda.gov.ae' },
      { label: 'ADEK (Abu Dhabi education)', url: 'https://www.adek.gov.ae' },
    ],
  },
  { id: 'housing', label: 'Housing & areas', icon: 'home', official: [{ label: 'Dubai Land Department (Ejari, rentals)', url: 'https://dubailand.gov.ae' }] },
  { id: 'jobs', label: 'Jobs & careers', icon: 'briefcase', official: [{ label: 'MOHRE (work permits, labour law)', url: 'https://www.mohre.gov.ae' }] },
  {
    id: 'health',
    label: 'Health & wellbeing',
    icon: 'heart',
    official: [
      { label: 'Dubai Health Authority', url: 'https://www.dha.gov.ae' },
      { label: 'Department of Health Abu Dhabi', url: 'https://www.doh.gov.ae' },
    ],
  },
  { id: 'addresses', label: 'Restaurants & good addresses', icon: 'pin' },
  { id: 'services', label: 'Services & daily life', icon: 'settings', official: [{ label: 'RTA (transport, driving licence)', url: 'https://www.rta.ae' }] },
  { id: 'general', label: 'General questions', icon: 'question' },
];

export type HelpPost = {
  id: string;
  communityId: string;
  category: string;
  categoryName: string;
  authorId: string;
  firstName: string;
  body: string;
  kind: 'question' | 'recommendation' | 'post' | 'announcement';
  mediaPaths: string[];
  mediaKind: 'photo' | 'video' | null;
  thumbPath: string | null;
  at: number;
  edited: boolean;
  answers: number;
  likes: number;
  liked: boolean;
  saved: boolean;
  pinned: boolean;
  mine: boolean;
};
export type HelpGroup = { id: string; category: string; name: string; isMember: boolean; questions: number };

const netError = (e: unknown) => (/fetch|network/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load');

/** Questions and recommendations, by category and keywords; reloads on any community change. */
export function useHelpFeed(cityId: string, category: string | null, query: string, kind: 'question' | 'recommendation' | null) {
  const uid = useAccount()?.userId;
  const key = `${uid}|${cityId}|${category}|${query}|${kind}`;
  const [state, setState] = useState<{ for: string; items: HelpPost[]; groups: HelpGroup[]; error: string | null }>({ for: '', items: [], groups: [], error: null });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    const n = ++seq.current;
    Promise.all([
      supabase.rpc('help_feed', { p_city: cityId, p_category: category, p_query: query.trim() || null, p_kind: kind, p_limit: 60 }),
      supabase.rpc('help_groups', { p_city: cityId }),
    ])
      .then(([f, g]) => {
        if (n !== seq.current) return;
        if (f.error) throw new Error(f.error.message);
        setState({
          for: key,
          error: null,
          items: ((f.data as Record<string, unknown>[] | null) ?? []).map((r) => ({
            id: r.id as string,
            communityId: r.community_id as string,
            category: r.category as string,
            categoryName: r.category_name as string,
            authorId: r.author_id as string,
            firstName: (r.first_name as string) ?? 'Member',
            body: r.body as string,
            kind: r.kind as HelpPost['kind'],
            mediaPaths: (r.media_paths as string[] | null) ?? [],
            mediaKind: (r.media_kind as 'photo' | 'video' | null) ?? null,
            thumbPath: (r.thumb_path as string | null) ?? null,
            at: Date.parse(r.created_at as string),
            edited: Boolean(r.edited_at),
            answers: Number(r.answers ?? 0),
            likes: Number(r.likes ?? 0),
            liked: Boolean(r.liked),
            saved: Boolean(r.saved),
            pinned: Boolean(r.pinned),
            mine: Boolean(r.mine),
          })),
          groups: ((g.data as Record<string, unknown>[] | null) ?? []).map((r) => ({
            id: r.id as string,
            category: r.category as string,
            name: r.name as string,
            isMember: Boolean(r.is_member),
            questions: Number(r.questions ?? 0),
          })),
        });
      })
      .catch((e) => n === seq.current && setState((s) => ({ ...s, for: key, error: netError(e) })));
  }, [uid, cityId, category, query, kind, key]);
  useEffect(() => {
    const h = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, query]);
  useRefreshOn(['communities'], load);
  const ready = state.for === key;
  return { items: ready ? state.items : [], groups: state.groups, loading: Boolean(uid) && !ready, error: ready ? state.error : null, reload: load };
}
