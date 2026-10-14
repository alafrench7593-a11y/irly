-- A Live's media keeps its shape (width / height): the feed card is drawn at
-- the right size before the image arrives, so it never jumps after a restart.
-- Additive: a nullable column (older posts and older app versions send none).
alter table public.irl_posts add column if not exists media_ratio real;
do $$ begin
  alter table public.irl_posts add constraint irl_posts_media_ratio_check
    check (media_ratio is null or (media_ratio > 0.1 and media_ratio < 10));
exception when duplicate_object then null; end $$;

-- Same feed, same rules, plus the shape. The return type changes, so the
-- function is recreated (no data involved) with its original grant.
drop function if exists public.irl_feed(text);
create function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text,
  media_kind text, thumb_path text, media_seconds integer, media_ratio real)
language sql stable set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id, i.media_kind, i.thumb_path, i.media_seconds,
    i.media_ratio
  from public.irl_posts i
  cross join lateral (select first_name from public.profiles_public where id = i.author_id) p
  left join public.activities a on a.id = i.activity_id
  where i.city_id = any (private.city_scope(p_city)) and i.expires_at > now()
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = i.id::text)
  order by i.created_at desc
  limit 100
$$;
revoke all on function public.irl_feed(text) from public, anon;
grant execute on function public.irl_feed(text) to authenticated;
