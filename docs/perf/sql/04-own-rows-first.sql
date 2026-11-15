-- PROPOSAL, not applied to production. Found on the staging copy (real Supabase), not on the local bench.
-- Supabase's auth.uid() contains a COALESCE; the planner treats a condition that holds it as one that
-- could leak rows, so it may not use it before the security rules: every row of the table is checked by
-- the rules first, and only then is the member's own row kept. Written as (select auth.uid()), the value
-- is computed once, before the scan, and the index on user_id is used.
-- Same rule, same rows: the comparison is unchanged, only when the value is computed.
--
-- Measured at rest on staging, 1,000 fictitious members, 15,090 notifications in all:
--   notifications, latest 50, as a man: 2,727 ms -> 11 ms; as a woman: 8.7 ms -> 2.7 ms
--   my_calendar(): 184 ms -> 1.6 ms (its body, timed directly)
-- Before applying: this file rewrites one security policy. Compare production with the migrations first,
-- and use a short lock_timeout.

alter policy notifications_self on public.notifications using (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.my_calendar(p_from timestamp with time zone DEFAULT (now() - '1 day'::interval), p_to timestamp with time zone DEFAULT (now() + '60 days'::interval))
 RETURNS TABLE(id uuid, title text, format text, category_id text, city_id text, area_id text, place_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, timezone text, hosting boolean, conversation_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select a.id, a.title, a.format, a.category_id, a.city_id, a.area_id, a.place_name, a.starts_at, a.ends_at, a.timezone,
    a.creator_id = (select auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id)
  from (select x.activity_id from public.activity_participants x
        where x.user_id = (select auth.uid()) and x.status = 'going' offset 0) x
  join public.activities a on a.id = x.activity_id
  where a.cancelled_at is null and a.starts_at between p_from and p_to
  order by a.starts_at
$function$

;
