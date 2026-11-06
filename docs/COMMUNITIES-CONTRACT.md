# Communities overhaul: shared contract (agents A–E)

The base is branch `claude/confident-ride-1o2o3x` (= main, commit 1b3a49f). An audit of what already exists is summarised below. Do not rebuild existing features.

## Already in place (keep, reuse)
- **Any member can create a community activity, published immediately.**
  - The policy `activities_create` (20261005001500) checks `private.i_belong`.
  - In the app, `ProposeActivity` is shown to everyone (src/app/c/[id].tsx). `CreateHost` preselects the community.
  - No setting restricts this. **Never add one.**
- **Roles today:** `community_members.role` is one of `member`, `moderator`, `owner`.
  - `set_community_role` (last defined in 20261025000100) toggles moderator ↔ member; owner only.
  - `remove_community_member` (20261103100000) exists, but no UI calls it.
- **Sanctions:** only platform-wide ones (`public.sanctions` + `private.block_sanctioned()`). No per-community ban or restriction exists.
- **Members list:** `community_people` is moderator-only.
- **Chat:**
  - Already working: real avatars, tap to open the profile (ConversationView), `messages.reply_to` + guard, `message_reactions` table, activity cards (`share_to_chat`, `ActivityShareCard`), photos.
  - Missing UI: replies and reactions.
- **Posts:** `community_posts` with polls, `announce()` (moderators), `pin_post`, `pin_activity`.
- **IRLY Girl isolation:** restrictive policies + `i_belong` / `join_community` eligibility checks. Every new RPC must keep it (`private.is_girl_eligible()`).

## Role ranks (server truth)
owner 3 > co_admin 2 > moderator 1 > member 0.
- Nobody acts on someone of equal or higher rank, except the owner on co-admins.
- A co-admin's rights come from `community_members.permissions` (jsonb booleans): `members`, `moderation`, `announcements`, `activities`, `settings`, `stats`, `roles`.
- Moderators always have `moderation` + `activities` (moderate only).

## Migration A: `supabase/migrations/20261107000000_irly_community_governance.sql` (agent A only)

**Schema changes**
- Widen the role CHECK to include `co_admin`. This is non-destructive: drop the constraint, then re-add it wider.
- Add `community_members.permissions jsonb not null default '{}'`.

**New tables**
- `community_bans (community_id, user_id, reason, until timestamptz null = permanent, created_by, created_at)`
- `community_restrictions (community_id, user_id, until, reason, created_by, created_at)`
- `community_warnings (community_id, user_id, reason, created_by, created_at)`
- `community_audit`: append-only journal (actor, action, target_user, target_id, reason, meta jsonb, created_at). No update or delete for anyone.

**RPCs** (all security definer, `set search_path`, rank checks server-side, every sensitive action written to `community_audit`)
- `public.community_my_rights(p_community uuid) → jsonb`
  - returns `{ role, permissions, can_manage_members, can_moderate, can_roles, can_settings, can_stats, can_announce, can_official, banned_until, restricted_until }`
- `public.community_set_role(p_community uuid, p_user uuid, p_role text)`
  - role is one of `co_admin`, `moderator`, `member`
  - owner: any role
  - co-admin with `roles`: moderator or member only, and only on members or moderators
- `public.community_set_permissions(p_community uuid, p_user uuid, p_perms jsonb)`
  - owner only; the target must be a co-admin
- `public.community_transfer_ownership(p_community uuid, p_user uuid)`
  - owner only; the target must be a member; the old owner becomes co-admin with all permissions
- `public.community_kick(p_community uuid, p_user uuid, p_reason text)`
- `public.community_ban(p_community uuid, p_user uuid, p_reason text, p_until timestamptz default null)`
  - removes the membership
- `public.community_unban(p_community uuid, p_user uuid)`
- `public.community_warn(p_community uuid, p_user uuid, p_reason text)`
- `public.community_restrict(p_community uuid, p_user uuid, p_until timestamptz, p_reason text)`
  - while it lasts, the user cannot post, chat or create activities in this community
- `public.community_unrestrict(p_community uuid, p_user uuid)`
- `public.community_sanctions(p_community uuid, p_user uuid default null) → table(kind, user_id, name, reason, until, created_by, created_at)`
  - managers only
- `public.community_moderate_activity(p_activity uuid, p_reason text)`
  - moderators and up, on an activity of their community
  - unlinks the activity from the community; if it was community-only, it is also cancelled
  - never edits its content
- `public.community_delete_message(p_message uuid, p_reason text)`
  - moderators and up, community chat only, never DMs
- `public.community_audit_log(p_community uuid, p_limit int default 100) → table(...)`
  - owner, or a co-admin with `stats` or `members`
- `public.community_stats(p_community uuid) → jsonb`
  - returns `{ members, new_7d, new_30d, upcoming_activities, activities_30d, participants_30d, messages_7d, open_reports }` from real counts
  - owner, or a co-admin with `stats`

**Enforcement**
- A ban blocks `join_community` and makes `i_belong` false.
- A restriction blocks inserts on activities with that community, on community chat messages and on community posts.
- The rule « any member may create an activity » must stay true for members in good standing.

**Notifications** (existing `notifications` mechanism): role given or removed, warning, ban, restriction, ownership received.

**Tests:** `supabase/tests/community_governance.test.sql`

## Migration B: `supabase/migrations/20261107100000_irly_community_social.sql` (agent B only)

**RPCs**
- `public.community_members_list(p_community uuid, p_search text default null, p_limit int default 200, p_offset int default 0) → table(user_id uuid, name text, role text, joined_at timestamptz)`
  - for any member, and anyone when the community is public and visible to them
  - ordered owner, co_admin, moderator, member, then name
  - excludes people the caller blocked or who blocked the caller, and deleted accounts
  - IRLY Girl rules apply
- `public.community_header(p_community uuid) → jsonb`
  - returns `{ members, upcoming_activities, faces: [{user_id, name}] (up to 5), new_members_7d }`
- `public.community_directory(p_city text, p_sort text default 'members', p_search text default null, p_limit int default 100) → table(id, name, tagline, description, emoji, category_id, topic, official, girl_only, members_count, upcoming_count, posts_week, created_at, is_member, is_favorite)`
  - sorts: `members` (default, by real member count desc), `active` (posts and messages, last 7 days), `recent` (created_at desc), `activities` (upcoming count)
  - search covers name, tagline, description and category
  - leave `community_list` as it is
- `community_favorites (user_id, community_id, created_at)` table + `public.toggle_community_favorite(p_community uuid) → boolean`

**Trigger on activity insert with a community_id**
- notify the members with kind `ACTIVITY_CREATED`
  - excluding the creator
  - respecting `community_notification_prefs`: add an `activities boolean default true` column
  - respecting blocks
  - with a fan-out cap per insert
- post ONE activity card into the community chat, reusing the `share_to_chat` message format; idempotent, no duplicate if shared again

**Tests:** `supabase/tests/community_social.test.sql`

## App agents
- **Agent C** (page + management UI): `src/app/c/[id].tsx`, `src/features/community/*` (new files allowed), new route `src/app/community/manage/[id].tsx`.
- **Agent D** (chat): `src/features/messages/ConversationView.tsx` and new chat components.
- **Agent E** (discovery): `src/app/communities.tsx` + discovery components.

All agents:
- use `src/lib/supabase` RPC calls typed locally; demo mode (`EXPO_PUBLIC_DEMO`) must not crash;
- add the FR strings in `src/i18n/fr.ts`;
- respect `src/theme/tokens.ts`, `useTheme()`, Glass, IRLY Girl flavor and night/day;
- use single quotes, no prettier, no model names in files;
- never touch `.github/testflight.txt`, version numbers or existing migrations.
