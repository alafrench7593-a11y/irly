import { useCallback, useEffect, useRef, useState } from 'react';
import type { IconName } from '@/components/ui/Icon';
import { useAccount } from '@/features/auth/account';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * Dubai News & Life: headlines from the city's sources (title, short
 * summary, date, source, link to the original), refreshed every hour on the
 * server from sources an IRLY admin turned on after checking their terms.
 * News is kept apart from members' posts; sponsored items are labelled.
 */
export type NewsCategory = 'local' | 'events' | 'outings' | 'practical' | 'business' | 'family' | 'property' | 'leisure';
export const NEWS_CATEGORIES: { id: NewsCategory; label: string; icon: IconName }[] = [
  { id: 'local', label: 'Local news', icon: 'news' },
  { id: 'events', label: 'Events, concerts & festivals', icon: 'calendar' },
  { id: 'outings', label: 'Going out & deals', icon: 'star' },
  { id: 'practical', label: 'Practical life & transport', icon: 'compass' },
  { id: 'business', label: 'Business & networking', icon: 'briefcase' },
  { id: 'family', label: 'Family & schools', icon: 'heart' },
  { id: 'property', label: 'Property & settling in', icon: 'home' },
  { id: 'leisure', label: 'Leisure & trends', icon: 'sparkles' },
];

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  image: string | null;
  category: NewsCategory;
  publishedAt: number;
  source: string;
  sourceKind: 'official' | 'media' | 'partner';
  sponsored: boolean;
  saved: boolean;
};

const netError = (e: unknown) => (/fetch|network/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load');

export function useNews(cityId: string, category: NewsCategory | null, query: string, saved: boolean) {
  const uid = useAccount()?.userId;
  const key = `${uid}|${cityId}|${category}|${query}|${saved}`;
  const [state, setState] = useState<{ for: string; items: NewsItem[]; error: string | null }>({ for: '', items: [], error: null });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    const n = ++seq.current;
    supabase
      .rpc('news_feed', { p_city: cityId === 'abudhabi' ? 'dubai' : cityId, p_category: category, p_query: query.trim() || null, p_saved: saved, p_limit: 60 })
      .then(({ data, error }) => {
        if (n !== seq.current) return;
        if (error) return setState((s) => ({ ...s, for: key, error: netError(error.message) }));
        setState({
          for: key,
          error: null,
          items: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
            id: r.id as string,
            title: r.title as string,
            summary: (r.summary as string | null) ?? null,
            url: r.url as string,
            image: (r.image_url as string | null) ?? null,
            category: r.category as NewsCategory,
            publishedAt: Date.parse(r.published_at as string),
            source: r.source_name as string,
            sourceKind: r.source_kind as NewsItem['sourceKind'],
            sponsored: Boolean(r.sponsored),
            saved: Boolean(r.saved),
          })),
        });
      });
  }, [uid, cityId, category, query, saved, key]);
  useEffect(() => {
    const h = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, query]);
  useRefreshOn(['saved'], load);
  const ready = state.for === key;
  return { items: ready ? state.items : [], loading: Boolean(uid) && !ready, error: ready ? state.error : null, reload: load };
}

/* ───────── IRLY admins ───────── */

export type NewsSource = {
  id: string;
  name: string;
  site: string;
  feed: string | null;
  kind: 'official' | 'media' | 'partner';
  category: NewsCategory;
  active: boolean;
  termsChecked: boolean;
  showImages: boolean;
  notes: string | null;
  keywords: string | null;
  lastFetchAt: number | null;
  lastError: string | null;
  articles: number;
};

const sb = () => {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
};

export async function loadSources(): Promise<NewsSource[]> {
  const { data, error } = await sb().rpc('news_admin_sources');
  if (error) throw new Error(netError(error.message));
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    site: r.site_url as string,
    feed: (r.feed_url as string | null) ?? null,
    kind: r.kind as NewsSource['kind'],
    category: r.default_category as NewsCategory,
    active: Boolean(r.active),
    termsChecked: Boolean(r.terms_checked),
    showImages: Boolean(r.show_images),
    notes: (r.notes as string | null) ?? null,
    keywords: (r.keywords as string | null) ?? null,
    lastFetchAt: r.last_fetch_at ? Date.parse(r.last_fetch_at as string) : null,
    lastError: (r.last_error as string | null) ?? null,
    articles: Number(r.articles ?? 0),
  }));
}

export async function saveSource(s: Omit<NewsSource, 'id' | 'lastFetchAt' | 'lastError' | 'articles'> & { id: string | null }): Promise<void> {
  const { error } = await sb().rpc('news_save_source', {
    p_id: s.id,
    p_name: s.name,
    p_site: s.site,
    p_feed: s.feed,
    p_kind: s.kind,
    p_category: s.category,
    p_active: s.active,
    p_terms_checked: s.termsChecked,
    p_notes: s.notes,
    p_keywords: s.keywords,
    p_show_images: s.showImages,
  });
  if (error) throw new Error(netError(error.message));
}

export async function updateArticle(id: string, patch: { status?: 'published' | 'hidden'; category?: NewsCategory; sponsored?: boolean }): Promise<void> {
  const { error } = await sb().rpc('news_update_article', { p_id: id, p_status: patch.status ?? null, p_category: patch.category ?? null, p_sponsored: patch.sponsored ?? null });
  if (error) throw new Error(netError(error.message));
}

export async function addArticle(a: { title: string; summary: string; url: string; category: NewsCategory; sponsored: boolean }): Promise<void> {
  const { error } = await sb().rpc('news_add_article', { p_title: a.title, p_summary: a.summary, p_url: a.url, p_category: a.category, p_sponsored: a.sponsored });
  if (error) throw new Error(netError(error.message));
}
