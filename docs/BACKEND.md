# IRLY backend

Supabase (Postgres, auth, storage, realtime). Everything that must hold for
real users is enforced in the database, never only in the app.

## Files

- `supabase/migrations/20261005000000_irly_core.sql`: profiles, safety
  settings, blocks, reports and moderation cases, notifications,
  communities, activities and participants, conversations, members,
  messages, reactions, reads. Row level security on every table.
- `supabase/migrations/20261005000100_irly_match.sql`: IRLY Girl Match:
  configurable weights (`irly_match_config`), onboarding, match profiles,
  actions, matches, the scoring function and the RPC API.
- `supabase/migrations/20261005000200_irly_platform.sql`: realtime
  publication and storage buckets/policies (guarded, Supabase only).
- `supabase/tests/irly_test.sql`: behaviour tests (`npm run test:db`).
- `scripts/check-compat.mts`: the app's on-device score equals the SQL
  score (`npm run test:compat`).

## Rules that hold server-side

- IRLY Girl is women only: `private.is_girl_eligible` reads the gender
  declared at signup, which a member cannot change afterwards
  (`profiles_guard`). Every IRLY Girl table, RPC, girl-only activity and
  community checks it. Men get an error, not an empty screen.
- Nobody reads another member's match profile directly. Discovery goes
  through `irly_match_discover`, which returns only visible, non-blocked,
  undecided members and drops hidden fields (age, languages, areas).
- Helpers that take a user id live in the `private` schema (not exposed by
  the API) and refuse to answer about anyone but the caller.
- A mutual like creates one match, one private chat, starter messages and
  two `MATCH_CREATED` notifications, in one transaction. Liking twice or
  racing never duplicates (unique pair, unique chat per match).
- Block ends the match, closes the chat and hides both people everywhere.
  Reports open a moderation case only admins can read.
- Joining an activity or a community joins its chat in the same call.
  Capacity is checked under a row lock, so two last-second joins cannot
  both get the last spot.
- Exact locations are never stored for activities: coordinates are rounded
  to about 1 km; neighbourhoods everywhere else.

## Matching

Weighted mean of similarities over the facets both people filled in:
interests, activities, sports, friendship goals, lifestyle, languages,
availability, areas, age range, communities, travel. Weights live in
`irly_match_config` (admins can tune them without an app release). The app
keeps an identical copy in `src/features/girl/compat.ts` for on-device mode.

## Mise en route du projet IRLY (yqutcmgslwxcmnsqmhvy)

1. Supabase → SQL Editor → New query : coller tout `supabase/setup.sql`, puis Run.
2. Authentication → Sign In / Providers → Email : activé.
3. Authentication → Email Templates → « Magic Link » : ajouter `{{ .Token }}`
   dans le message, pour que l'e-mail contienne le code à 6 chiffres.
4. Dans l'app : Profil → IRLY account → e-mail → code.

L'URL et la clé publishable sont déjà dans `src/lib/supabase.ts` (publiques
par conception). Ne jamais mettre la clé `service_role` / secret dans l'app.

## Running

```bash
# Local tests (PostgreSQL 15+):
npm run test:db
npm run test:compat
npm run test:intent
npm run test:bali

# Supabase project:
supabase link --project-ref <ref>
supabase db push
cp .env.example .env   # fill EXPO_PUBLIC_SUPABASE_URL / ANON_KEY
```

## Engagement layer (migration 0600)

- **One interaction system.** `likes`, `comments` (one level of replies),
  `saves`, `shares`, `hidden_items` point at any entity by
  `(target_type, target_id)`: `irl_post`, `activity` (events are activities
  with `format = 'event'`), `community`, `community_post`, `comment`,
  `profile`, `place`, `catalog`. `private.can_see` (security invoker) checks
  the target under the caller's own RLS: you can only interact with what you
  can already see. `engagement(type, ids[])` returns counters + my state.
- **Canonical reads.** `activity_detail`, `my_calendar`, `search_all`
  (activities, communities, people, places, areas, cities, categories),
  `recommend_activities` (interests, friends going, likes/saves, never
  hidden items), `irl_feed` (with the linked activity), `comment_thread`.
- **Chats.** `open_direct` (friends or matches only), `share_to_chat`
  (a `share` message pointing at the entity).
- **Notifications.** New kinds (LIKE, COMMENT, COMMENT_REPLY, MENTION,
  FRIEND_REQUEST, FRIEND_ACCEPTED, ACTIVITY_UPDATED…). `notification_prefs`
  mutes kinds; a trigger drops muted kinds and anything from a blocked user.
- **Safety.** Rate limits (likes, comments, IRL posts, community posts),
  three reports in a day hide an IRL post / comment and raise the case to
  high priority, search hides profiles set to *Nobody*.
- **Content.** `countries → regions → cities → areas → places` and
  `categories`, admin-editable (RLS: everyone reads, admins write).
- **Analytics / AI.** `analytics_events` (insert-only, admins read, no
  sensitive props) and `ai_commands` (the assistant's log, owner only).

## Sign-in providers (one-time, in the Supabase dashboard)

The app already has the buttons and the flows. Each provider only needs to
be switched on in **Authentication → Sign In / Providers**:

- **Email + password**: on by default. Keep "Confirm email" on.
- **Google**: create an OAuth client in Google Cloud (type *Web*), paste the
  client ID and secret. Authorised redirect URI:
  `https://yqutcmgslwxcmnsqmhvy.supabase.co/auth/v1/callback`.
- **Apple**: Services ID + key from the Apple Developer account (paid).
- **Phone**: needs an SMS provider (Twilio, MessageBird, Vonage).

Until a provider is on, its button shows "not switched on yet".

## Assistant

`src/features/ai/intent.ts` turns text or voice into a command (intent +
activity, day, time, area, city, budget), deterministic and tested
(`npm run test:intent`). Voice uses the browser's speech recognition on the
web and the keyboard's dictation in Expo Go. Anything that changes data
(create, switch city) is shown as an editable card and waits for a tap.

## Bali and IRLY Moms (migration 0700)

- **Geography.** `admin_areas` (Bali province → 8 regencies + Kota
  Denpasar) is kept apart from the destination `areas` people search
  (Canggu, Berawa…). Each area points at its regency (`admin_area_id`) and,
  for neighbourhoods, at the area people know it by (`parent_area_id`).
- **Area profiles** (`area_profiles`): editorial IRLY Guide ratings (0–5)
  used by "Where should I live?" and the test-stay plans
  (`src/features/bali/fit.ts`, `npm run test:bali`). No prices.
- **Guides** (`guide_articles`): every entry is `official` (must cite a
  source URL), `irly_guide` or `third_party`, with source date, last
  verified and review dates. Visa entries only point at the official
  portals until someone verifies the details and fills `last_verified_at`.
- **Move checklist**: `relocation_steps` + private `relocation_progress`.
- **Places**: provider fields (rating, reviews, price, cuisines, hours,
  photos, amenities) and `places_search` ranked by a Bayesian rating
  (review volume), IRLY popularity and freshness. Restaurants become social
  through ordinary activities (`place_id`, `activity_type`, `audience`).
- **IRLY Moms** lives inside IRLY Girl: `mom_mode` and `kids_age_groups`
  (age groups only) on the Match profile, `audience = 'moms'` activities
  (always girl-only), `girl_circle` for "Girls moving to Bali" and moms.
- **Hardening**: private helpers are no longer executable by default.

### Restaurants: one-time setup

1. Google Cloud → enable **Places API (New)** → create an API key
   (restrict it to that API).
2. GitHub → repository → Settings → Secrets → Actions →
   `GOOGLE_PLACES_API_KEY`.
3. Actions → **Places** → Run workflow (then it refreshes weekly).

The key stays in GitHub; the app only reads the database.

## Security fixes (migration 1300)

- Profiles: members cannot delete their own row (delete + re-insert bypassed the gender lock). Others never read `birthdate`, `faith`, `gender` or `is_admin`: column privileges, applied by `private.restrict_profile_columns()`. **A new column added to `profiles` later is not readable until that function is run again** (`select private.restrict_profile_columns();`).
- Posts, comments and messages: only the text and `deleted_at` can be edited. Author, community, conversation, kind and dates are fixed. A removal (by a moderator or after 3 reports) cannot be undone by the author, and moderators can only remove a post, never rewrite it.
- Removed comments and deleted messages are no longer readable by others, including through realtime.
- Mentions notify only real accounts that can see the item, once each.
- `join_activity` honours privacy: friends-only activities need the creator's friendship, community ones need membership, invite-only ones need a share in one of your chats.
- Blocking someone ends the friendship. Match discovery never reveals a hidden age through filters, or hidden languages through reasons. `friends` and `communities` profile visibility are enforced.
- Joining or befriending again does not re-notify (ACTIVITY_JOINED once per person, FRIEND_REQUEST once a week, COMMUNITY_JOINED only for a new membership).

## Second security pass (migration 1500)

- Invite-only activities open only through a share sent by the creator or someone going.
- Hidden match fields are stripped from match reasons, their facets and stored matches.
- `created_at` is the server clock on member inserts (backdating beat the rate limits).
- IRL posts and activities can only point at a community you belong to; an owner cannot change `created_by` or `girl_only`.
- Deleting an account deletes the person's messages and hands their communities to the longest-standing member. **Storage files are not deleted** (Supabase blocks SQL deletes on `storage.objects`): a scheduled cleanup through the Storage API is still to build.
- Storage: IRL media is readable only through a post you can see; profile photos are hidden from people in a block.
- A removed comment or message has its text erased (kept in `private.removed_content` for moderation) and keeps its place in threads.
- Polls are frozen once someone voted.
- `my_profile()` returns your own full row (column grants hide birthdate, faith, gender and is_admin, even from yourself, in direct selects).
- Known and accepted: Supabase Realtime does not apply RLS to DELETE events, so subscribers can receive the primary key of deleted rows (likes, friendships, memberships). The app no longer subscribes to unfiltered like deletions.
- Not enforced yet: `who_can_message`, `irl_visibility`, `activity_visibility`, `location_precision` in safety settings.

## Third security pass (migration 1600)

- Safety settings now enforced: `who_can_message` (new direct chats and messages in direct chats; a reply is always allowed once the other person wrote), `irl_visibility` (default audience of a new IRL post), `location_precision` (others never read `profiles.area_id`; `hidden` hides the city; IRL posts drop the venue below `area`). Still not enforced: `activity_visibility` (participant lists).
- Reports only through `report()`: it checks you can see the target, sets whose content it is, refuses self-reports and duplicates, 10 per hour. Three reports hide content only from accounts older than 7 days, and never after a moderator dismissed the case. Reports survive the reporter's account deletion.
- A removed comment or post is frozen for its author; removed text is purged from notifications.
- Activities: girl-only stays girl-only once women joined; capacity never below the people going; the community check applies only when the community changes.
- Match reasons keep their lists (empty when hidden): removing the keys crashed IRLY Girl screens. `hidden_fields` limited to `age`, `languages`, `areas`.
- Invitees can open an invite-only activity shared with them by the creator or someone going.
- Account deletion also removes the person's direct chats and notifications about them. Notifications only change `read_at`; chat roles and birthdate are fixed.

## Still to connect

- Provider keys for Apple, Google and SMS (see above).
- Push notifications (Expo push tokens + a database webhook on
  `notifications`).
- Google Places for real place search in Create.
