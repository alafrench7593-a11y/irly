-- The activity page reads its catalog subcategory too, so its photo is chosen
-- from the same words as everywhere else (title, subcategory, place).
-- Same function, one more column at the end.
drop function if exists public.activity_detail(uuid);
create function public.activity_detail(p_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, format text, title text, description text, category_id text,
  city_id text, area_id text, place_name text, starts_at timestamptz, ends_at timestamptz, price_minor integer, currency text,
  capacity integer, going integer, girl_only boolean, community_id uuid, cover_url text, my_status text, conversation_id uuid,
  cancelled boolean, sub_id text)
language sql stable security invoker set search_path = public as $$
  select a.id, a.creator_id, p.first_name, a.format, a.title, a.description, a.category_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.price_minor, a.currency, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    a.cancelled_at is not null,
    a.sub_id
  from public.activities a
  left join public.profiles_public p on p.id = a.creator_id
  where a.id = p_id
$$;
revoke all on function public.activity_detail(uuid) from public, anon;
grant execute on function public.activity_detail(uuid) to authenticated;
