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

## Running

```bash
# Local tests (PostgreSQL 15+):
npm run test:db
npm run test:compat

# Supabase project:
supabase link --project-ref <ref>
supabase db push
cp .env.example .env   # fill EXPO_PUBLIC_SUPABASE_URL / ANON_KEY
```

## Still to connect

- Sign in with Apple, Google and phone (Supabase Auth providers) and the
  signup profile writing to `profiles`. Until a member is signed in, the
  app uses on-device data (`deviceApi`), with the same behaviour.
- Push notifications (Expo push tokens + a database webhook on
  `notifications`).
- Google Places for real place search in Create.
