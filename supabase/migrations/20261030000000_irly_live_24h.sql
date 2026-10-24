-- Lives last 24 hours (were 4 hours). A Live needs no neighbourhood any more:
-- without one the app sends the city as area_id, the city-level marker that
-- private.irl_precision() already uses. Lives posted before stay on their
-- 4-hour end. Same insert rule as 20261024009300, with the new limit.

alter table public.irl_posts alter column expires_at set default now() + interval '24 hours';

drop policy if exists irl_posts_insert on public.irl_posts;
create policy irl_posts_insert on public.irl_posts for insert to authenticated with check (
  author_id = auth.uid()
  and expires_at <= now() + interval '24 hours 1 minute'
  and (community_id is null or private.i_belong(community_id))
  and (visibility <> 'community' or community_id is not null)
  and (app_scope = 'irly' or private.is_girl_eligible())
);
