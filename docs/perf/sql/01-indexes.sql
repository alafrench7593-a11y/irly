-- PROPOSAL, not applied anywhere. Indexes only: no rule, no data and no function changes.
-- Measured on a local copy with 50,000 fictitious members (see docs/perf/REPORT.md).
-- Each statement runs alone, outside a transaction, so writes are not blocked while it builds.
-- Send each statement as its own request (the deploy script wraps files in a transaction, which these refuse).
-- Afterwards check that none is left invalid: select indexrelid::regclass from pg_index where not indisvalid;
-- Never set force_generic_plan on private.purge_notifications: the four payload indexes need its custom plans.
-- 1. private.drop_push_copy(): "delete from push_outbox where notification_id = old.id" runs once per deleted notification.
create index concurrently if not exists push_outbox_notification_idx on public.push_outbox (notification_id) where notification_id is not null;
-- 2. private.purge_notifications(): removing a post / comment / activity deletes its notifications by payload key (was a seq scan of notifications each time).
create index concurrently if not exists notifications_post_ref_idx on public.notifications ((payload ->> 'post_id')) where (payload ->> 'post_id') is not null;
create index concurrently if not exists notifications_comment_ref_idx on public.notifications ((payload ->> 'comment_id')) where (payload ->> 'comment_id') is not null;
create index concurrently if not exists notifications_activity_ref_idx on public.notifications ((payload ->> 'activity_id')) where (payload ->> 'activity_id') is not null;
create index concurrently if not exists notifications_target_ref_idx on public.notifications ((payload ->> 'target_id')) where kind in ('LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION');
-- 3. foreign keys without an index, hit when a member or a game room is deleted
create index concurrently if not exists game_messages_user_idx on public.game_messages (user_id) where user_id is not null;
create index concurrently if not exists ww_players_user_all_idx on private.ww_players (user_id) where user_id is not null;
create index concurrently if not exists game_rooms_host_idx on public.game_rooms (host_id) where host_id is not null;
create index concurrently if not exists game_rooms_winner_idx on public.game_rooms (winner_id) where winner_id is not null;
create index concurrently if not exists community_posts_game_room_idx on public.community_posts (game_room_id) where game_room_id is not null;
create index concurrently if not exists communities_created_by_idx on public.communities (created_by) where created_by is not null;
