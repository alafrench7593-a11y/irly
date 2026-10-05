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

## Still to connect

- Provider keys for Apple, Google and SMS (see above).
- Push notifications (Expo push tokens + a database webhook on
  `notifications`).
- Google Places for real place search in Create.
