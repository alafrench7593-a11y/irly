# Community social space (wave 2): shared contract

Base: main after PR #162 (communities overhaul). Read `docs/COMMUNITIES-CONTRACT.md` first.

## Already present (do not rebuild)
- **Posts**
  - Text, up to 10 photos, or 1 video: `post-media` bucket, 25 MB, 60 s in the picker, `expo-video` player, poster frame from `expo-video-thumbnails`.
  - Edit (`edited_at`), soft delete, likes, polls, `kind` question/recommendation, channels.
- **Comments:** one level of replies, realtime, `comments.mentions` plus the `MENTION` notification in `on_comment` (the app never sends mentions).
- **Pins:** `community_pins` / `pin_post` (max 10). Announcements: `announce()`.
- **Saves:** the `saves` table.
- **Governance (20261107000000):** roles, co-admins, bans, restrictions, journal, stats.
- **Chat:** replies, reactions, moderator delete (`community_delete_message`), `ConversationView` with a `pane` mode.
- **Feed:** `community_feed(p_community, p_limit, p_before?)` (latest in 20261103300000).

## Migration F: `supabase/migrations/20261108000000_irly_community_space.sql` (agent F only)
1. **Security fix.**
   - A comment on a community post requires `private.i_belong(community)` and no ban or restriction in that community. Today `comments_write` only checks `can_see`.
   - Same rule for likes on community posts and poll votes, if they bypass it too.
2. **Search.**
   - Indexes: `create extension if not exists pg_trgm`, then trigram indexes on `community_posts.body` and on `activities.title`.
   - `public.community_search(p_community uuid, p_query text, p_filter text default 'all', p_limit int default 30, p_before timestamptz default null) → table(kind text, id uuid, title text, snippet text, author_id uuid, author_name text, created_at timestamptz, media_kind text, thumb_path text, pinned boolean, score real)`
   - `kind` is one of `post`, `announcement`, `activity`, `member`, `media`.
   - `p_filter` is one of `all`, `recent`, `popular`, `media`, `activities`, `members`, `pinned`.
   - The caller must be able to read the community, with the IRLY Girl rules. Never return anything from a community the caller cannot read.
   - Query of at least 2 characters; dates may be matched by `p_before`.
3. **Media gallery.**
   - `public.community_media(p_community uuid, p_before timestamptz default null, p_limit int default 60) → table(post_id uuid, path text, kind text, thumb_path text, seconds int, author_id uuid, created_at timestamptz)`
   - One row per media file of live posts, newest first. Same read rules as the posts.
4. **Paged and sorted feed.**
   - `public.community_posts_page(p_community uuid, p_sort text default 'recent', p_before timestamptz default null, p_offset int default 0, p_limit int default 20)`
   - Returns the same columns as the latest `community_feed`.
   - `recent`: pinned first on the first page only, then `created_at desc` with a cursor.
   - `popular`: likes + 2×comments with time decay, paged by offset.
   - Leave `community_feed` untouched.
5. **Pin expiry.**
   - `community_pins.expires_at timestamptz null`.
   - `pin_post` gains an optional `p_until`; keep the old signature working, or overload safely.
   - Expired pins count as not pinned in the feed and the page.
6. **Chat pins.**
   - Table `message_pins (conversation_id, message_id, pinned_by, pinned_at, expires_at)`, max 5 per conversation.
   - `public.pin_message(p_message uuid, p_on boolean, p_until timestamptz default null)`: community chats only; moderators, co-admins with `moderation`, or the owner.
   - `public.chat_pins(p_conversation uuid) → table(message_id, body, sender_id, sender_name, kind, pinned_at, expires_at)`: members of the chat only.
   - Write to the community journal through the governance logger.
7. **Mentions on posts.**
   - `community_posts.mentions uuid[] not null default '{}'`, max 10.
   - On insert, and on update that adds mentions, notify the mentioned **members of that community** with `MENTION` (payload `post_id`, `community_id`, `from`). Respect blocks and IRLY Girl.
   - Mentioning a non-member is silently dropped.
8. **Rules.**
   - `communities.rules text` (max 4000).
   - `public.community_update_info(p_community, p_name text default null, p_tagline text default null, p_description text default null, p_rules text default null)`: owner, or a co-admin with `settings`. Official communities keep their fixed names; reuse the existing guards. Journal it.
9. **Scale.**
   - Cap the notification fan-out of `private.on_community_post` (latest in 20261018000100 or later; check) at 500 recipients per post, as the activity fan-out does.
   - When a post gets `deleted_at`, queue its `post-media` files with the existing `private.queue_removed_file` / storage cleanup mechanism used for activities (20261103400000).
10. **Push texts.** Extend `private.push_text` (latest: 20261107200000) for `MENTION` on a post (url `/c/<community_id>`).
11. **Tests.** `supabase/tests/community_space.test.sql` must cover every item above, including the security fix. The full suite must pass.

## App agent G: page, tabs, search, media, calendar, owner info
- **Files:** `src/app/c/[id].tsx`, `src/features/community/*` (new files allowed), and new routes `src/app/community/search/[id].tsx`, `src/app/community/media/[id].tsx` if needed.
- **Tabs:** Publications | Chat | Activités | Médias | Membres. About moves to a header sheet (« À propos »), which also shows the rules.
- **Chat tab:** embed `ConversationView` in `pane` mode for the community conversation. Members only; others see « Rejoins pour discuter ».
- **Pinned strip** at the top of Publications: posts from the feed with `pinned_at`, horizontal.
- **Search** icon in the header opening community search. Filter chips: Tout, Récent, Populaire, Médias, Activités, Membres, Épinglés. Results open the post, activity, profile or media.
- **Media tab:** grid from `community_media`, infinite scroll, a fullscreen viewer (photo zoom, video with poster then play), signed URLs through the existing media helpers.
- **Publications:**
  - Sort toggle Récent / Populaire.
  - Infinite pagination with `community_posts_page` (FlatList and `onEndReached`, or chunked rendering).
  - A « Nouvelles publications » pill when realtime signals new posts.
  - A floating « Publier » button opening the existing composer or `/post/new`.
- **Activities tab:** add a calendar or agenda view grouped by day of the community's activities, with week and month segments. Keep « + Proposer une activité » visible to all members.
- **Manage → Paramètres:** edit name, tagline, description and rules with `community_update_info`.

## App agent H: chat pins, mentions, comments moderation, profiles
- **Files:** `src/features/messages/*` (ConversationView, ChatBits), `src/app/comments.tsx`, the post composer (`src/app/post/new.tsx`, `src/features/posts/*`), the post card rendering in `src/features/community/*`, and `src/components/ui/Avatar` usage only (no visual change to Avatar itself).
- **Chat pins:**
  - Long-press « Épingler » / « Désépingler » for moderators (from `community_my_rights`), with an optional duration (24 h, 7 days, none).
  - A pinned banner at the top of the chat, cycling through the pins; tapping one scrolls to the message.
- **Mentions:**
  - Typing `@` opens an autocomplete from `community_members_list(p_search)` in the composer and in comments.
  - Send `mentions` (uuid[]) with posts and comments.
  - Render mentions highlighted and tappable (open the profile).
  - Render URLs as tappable links with a simple domain chip. No server fetch for previews.
- **Comments:**
  - Moderators and co-admins with `moderation` can delete others' comments (the `comments_moderate` policy exists).
  - Avatars in posts and comments open `/person/[id]`.

## Rules for all agents
- Typed RPC wrappers in one module per agent.
- Demo mode (`EXPO_PUBLIC_DEMO`) must never crash: return empty data.
- English UI strings with French entries in `src/i18n/fr.ts`, no machine translation. Every new server refusal gets a sentence in `src/i18n/errors.ts`.
- Use theme tokens, Glass, IRLY Girl flavor (pink/beige), night and day, motion tokens and skeletons.
- Single quotes, no prettier, no model names in files.
- Never touch `.github/testflight.txt`, version numbers or existing migrations.
