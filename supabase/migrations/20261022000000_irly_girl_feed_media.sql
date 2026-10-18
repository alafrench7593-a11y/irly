-- IRLY Girl feed: a post's photos or video come with it.
--
-- girl_feed returned the text of community posts but not their media, so a
-- photo posted in a women-only community showed on the community page and
-- not in IRLY Girl's « Recent posts ». Same rows, same rules (women only,
-- security invoker: the posts' read policy still decides), four more
-- columns. The return type changes, so the function is dropped and created
-- again; clients read columns by name, so older app builds keep working.

drop function if exists public.girl_feed(text, boolean, integer, timestamptz);

create function public.girl_feed(p_city text, p_moms boolean default false, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text,
  activity_id uuid, activity_title text, activity_starts_at timestamptz, likes integer, comments integer, liked boolean,
  created_at timestamptz, mine boolean, is_member boolean,
  media_paths text[], media_kind text, thumb_path text, media_seconds integer)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select p.id, c.id, c.name, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at,
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds
  from public.community_posts p
  join public.communities c on c.id = p.community_id and c.deleted_at is null and c.girl_only
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  where p.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
    and (not p_moms or c.category_id = 'family'
      or coalesce(c.topic, (select t.topic from public.communities t where t.id = c.parent_id)) = 'moms')
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;
revoke all on function public.girl_feed(text, boolean, integer, timestamptz) from public, anon;
grant execute on function public.girl_feed(text, boolean, integer, timestamptz) to authenticated;
