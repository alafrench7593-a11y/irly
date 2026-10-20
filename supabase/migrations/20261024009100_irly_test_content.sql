-- IRLY: no end-to-end test text left where members look ("Hello from Mia mvdxpmvc").
--
-- The end-to-end scripts (scripts/e2e*.mjs) run against the live backend
-- with throwaway accounts (e2e-…@irly.test) and stamp what they write with
-- the run, Date.now() in base 36. 20261024007100 and 20261024009000 fixed
-- the community titles; this hides the rest, and only that:
--   - what a test account wrote (an account the scripts did not delete);
--   - what a deleted test account left with no author (messages and
--     notices keep their text, messages_sender_id_fkey ON DELETE SET NULL),
--     when the text is exactly one of the scripts' own texts followed by a
--     run stamp ("Hello from Mia mvdxpmvc"; the list is private.e2e_text());
--   - group chat titles of chats no real member is in.
-- A member's own post, comment, activity, live post, profile or message is
-- never matched: the text rule only reads rows with no author.
--
-- Nothing is erased, everything is hidden the way the app hides it:
--   - community posts, comments, chat messages: deleted_at (their text goes
--     to private.removed_content, kept for moderation, as on any delete);
--   - activities: cancelled (cancelled_at), out of every list;
--   - live posts: expired now (expires_at), out of the live feed;
--   - professional profiles: out of Networking (visible = false);
--   - group chat titles: the stamp dropped;
--   - community notices (copies of a notice already sent): removed, they
--     have no hidden state; only exact test texts.

-- One of the scripts' texts with its run stamp (the stamp: any eight base-36
-- characters starting with l, m or n, as every Date.now() from 2021 to 2038).
create or replace function private.e2e_text(p_text text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(btrim(p_text), '') ~ ('^(' || concat_ws('|',
      -- A text, then the stamp.
      '(Angel investor · Vera Capital|Building things in Bali|Comment|E2E brunch sunday, who''s in\?|E2E community brunch'
        || '|Girl feed live|Group hello|Hello from Mia|Hello girls|Hi Uma|Live from Vera|Live plan|Not saved|Oman, yes!'
        || '|Open coffee|Padel crew|Padel photo|Photo group|Reply|Reply to Vera|Salut, comment vas-tu \?|Sync check'
        || '|Très bien, et toi \?|Vera Capital|Welcome Mia|Who plays Saturday\?|E2E Padel|Girls Padel|Book & Matcha|Sync club|Photo club)'
        || ' [l-n][a-z0-9]{7}( Bali)?',
      -- The stamp inside the text.
      'E2E [l-n][a-z0-9]{7}: how long is the Emirates ID renewal\?',
      'E2E poll [l-n][a-z0-9]{7}\?') || ')$')
  -- The stamp alone ("mvdxpmvc", "… renewal") is not matched: a member's
  -- "marathon" reads the same. Those come from test accounts only, hidden by author.
$$;
revoke all on function private.e2e_text(text) from public, anon, authenticated;

create or replace function private.irly_hide_test_content() returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  n_posts integer; n_comments integer; n_messages integer; n_activities integer;
  n_live integer; n_pro integer; n_chats integer; n_notices integer;
begin
  update public.community_posts set deleted_at = now()
  where deleted_at is null and private.community_from_test_account(author_id);
  get diagnostics n_posts = row_count;

  update public.comments set deleted_at = now()
  where deleted_at is null and private.community_from_test_account(author_id);
  get diagnostics n_comments = row_count;

  update public.messages set deleted_at = now()
  where deleted_at is null
    and (private.community_from_test_account(sender_id) or (sender_id is null and private.e2e_text(body)));
  get diagnostics n_messages = row_count;

  update public.activities set cancelled_at = now()
  where cancelled_at is null and private.community_from_test_account(creator_id);
  get diagnostics n_activities = row_count;

  update public.irl_posts set expires_at = now()
  where (expires_at is null or expires_at > now())
    and private.community_from_test_account(author_id);
  get diagnostics n_live = row_count;

  update public.pro_profiles set visible = false
  where visible and private.community_from_test_account(user_id);
  get diagnostics n_pro = row_count;

  -- Group chats ("Padel crew mvgq82y1") no real member is in; a community's chat follows its title already.
  update public.conversations v set title = regexp_replace(btrim(v.title), ' [l-n][a-z0-9]{7}$', '')
  where v.community_id is null and private.e2e_text(v.title)
    and not exists (select 1 from public.conversation_members cm
                    where cm.conversation_id = v.id and not private.community_from_test_account(cm.user_id));
  get diagnostics n_chats = row_count;

  delete from public.community_broadcasts
  where private.community_from_test_account(sender_id) or (sender_id is null and private.e2e_text(body));
  get diagnostics n_notices = row_count;

  return jsonb_build_object('posts', n_posts, 'comments', n_comments, 'messages', n_messages, 'activities', n_activities,
    'live', n_live, 'pro', n_pro, 'chats', n_chats, 'notices', n_notices);
end $$;
revoke all on function private.irly_hide_test_content() from public, anon, authenticated;

select private.irly_hide_test_content();
