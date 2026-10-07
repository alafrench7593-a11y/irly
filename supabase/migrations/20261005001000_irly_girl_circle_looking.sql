-- IRLY Girl circles: also filter by what women are looking for
-- (activities, travel companions, coworking, wellness, sports) and show
-- who arrived recently. Same rules as before: women only, privacy,
-- blocking, hidden fields.

drop function if exists public.girl_circle(text, text, boolean, text, integer);

create or replace function public.girl_circle(
  p_destination text,
  p_status text default null,
  p_moms boolean default false,
  p_area text default null,
  p_limit integer default 30,
  p_looking text default null
)
returns table (user_id uuid, first_name text, areas text[], destination_status text, move_month date, mom_mode boolean,
  kids_age_groups text[], looking_for text[], interests text[], score integer)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  return query
  select mp.user_id, p.first_name,
    case when 'areas' = any (mp.hidden_fields) then '{}'::text[] else mp.areas end,
    mp.destination_status, mp.move_month, mp.mom_mode,
    case when mp.mom_mode then mp.kids_age_groups else '{}'::text[] end,
    mp.looking_for, mp.interests,
    (select s.score from private.match_score(me, mp.user_id) s)
  from public.irly_match_profiles mp
  join public.profiles p on p.id = mp.user_id and p.deleted_at is null and p.gender = 'woman'
  left join public.safety_settings ss on ss.user_id = mp.user_id
  where mp.user_id <> me
    and mp.visible
    and coalesce(ss.profile_visibility, 'everyone') <> 'nobody'
    and not private.is_blocked(me, mp.user_id)
    and (mp.destination = p_destination or (mp.destination is null and p.city_id = p_destination))
    and (p_status is null or mp.destination_status = p_status)
    and (not p_moms or mp.mom_mode)
    and (p_area is null or (p_area = any (mp.areas) and not 'areas' = any (mp.hidden_fields)))
    and (p_looking is null or p_looking = any (mp.looking_for))
  order by 10 desc nulls last, mp.last_active_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;

revoke all on function public.girl_circle(text, text, boolean, text, integer, text) from public, anon;
grant execute on function public.girl_circle(text, text, boolean, text, integer, text) to authenticated;
