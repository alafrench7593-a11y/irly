# IRLY back office

The back office lives in the app itself, under `/admin`:

- web: **https://getirly.com/app/admin** (sign in with the owner's IRLY account first);
- phone: **Settings → IRLY back office** (the button only shows for team members).

Every screen asks the server for the caller's role (`my_staff_role()`), and every
call is checked again by the server (SECURITY DEFINER functions in
`supabase/migrations/20261023000000_irly_admin_moderation.sql`,
`20261027200000_irly_admin_console.sql`, `20261027200100_irly_report_email.sql`).
Roles live in `public.staff_roles`, which no client can read or write.

| Role      | Can                                                                                  |
| --------- | ------------------------------------------------------------------------------------ |
| owner     | everything, and gives or removes roles (Team and roles)                              |
| admin     | everything except roles: overview, hide/restore/delete, bans, account deletion, settings |
| moderator | reports, notes, warnings, suspensions of 7 days at most, member sheets, removing members' photos |
| content   | community names, texts and photos; activity photos and IRLY's own photos (Photos) |

## 1. Make the owner's account owner (once)

No migration grants a role. The account must exist first (sign up in the app).
Either way below records the grant in the moderation log.

**A. GitHub (preferred):** Actions → **Grant owner** → Run workflow → type the
account's email. It needs the `SUPABASE_ACCESS_TOKEN` repository secret (already set).

**B. Supabase SQL editor** (Dashboard → SQL Editor, as the project owner):

```sql
select private.grant_owner('owner-email@example.com');
```

It answers with the account id, or "no IRLY account with this email: sign up in the app first".
The owner then gives other people their role from **Back office → Team and roles**.

## 2. Report emails

Pipeline: report → moderation case → `private.admin_notifications` (one row per
case) → `private.report_email_outbox` (at most one row per report) →
`scripts/report-email.mjs`, run every 10 minutes by `.github/workflows/report-email.yml`.
The sender claims rows with a lease, sends with the outbox id as idempotency key,
then marks them sent or failed (retried with a growing delay, 6 attempts; failed
ones can be sent again from Settings). Nothing is claimed while no destination
is set, so nothing is lost.

What to configure:

1. **Destination address** (not in the code; the repository only knows
   `appreview@getirly.com`, which is the App Review contact, not moderation):
   Back office → **Admin settings** → *Moderation email address*. Stored in
   `private.admin_settings`, readable and changeable by admins only.
2. **Which reports** (same screen): *Important reports* (default: threats,
   dangerous behaviour, sexual content, hate, or anything several members report),
   *Every report*, or *Off*.
3. **Provider: Resend** (https://resend.com). Verify the sending domain there
   (DNS records), create an API key with "Sending access" only.
4. **GitHub repository secrets** (Settings → Secrets and variables → Actions):
   - `RESEND_API_KEY`: the Resend key (`re_…`);
   - `REPORT_EMAIL_FROM`: the sender on the verified domain, e.g.
     `IRLY Moderation <moderation@your-domain>` (may also be a repository variable);
   - `SUPABASE_PURGE_KEY`: already set for "Storage purge" (the project's
     `sb_secret_…` key); only the `report_email_*` functions accept it.
5. Run **Actions → Report email → Run workflow** once and check the log says
   `1 claimed, 1 sent` after a test report (and Settings shows *Sent*).

The email holds the case number, kind, reason, priority, date and a link to
`<Back office link>/admin/case/<case id>` (default `https://getirly.com/app`,
changeable in Settings; opening it requires signing in as a team member). It never
holds a name, an email address, the report's text, a token or a key. The keys
stay in GitHub secrets: the app never sees them.

Local check (mocked provider, no network): `npm run test:report-email`.

## 3. What the team can do

- **Overview**: real counts (members, new 7/30 days, active in 30 days = wrote,
  messaged, created or joined; sign-ins where Supabase records them), communities,
  activities, posts, lives, reports by status, suspended and banned members,
  hidden items, email failures, latest actions.
- **Users**: search by name, username, id (email for admins); sheet with status,
  reports about them, sanctions and every team action about them; warning,
  suspension until a date, reactivation, ban; account deletion (admins, typing
  DELETE, never one's own account nor a team member) runs the member's own
  `delete_my_account()` pipeline (files queued for the storage purge, reported
  words kept, communities handed on).
- **Communities**: search, sheet (creator, who runs it, members, photo), edit
  name and texts, replace or remove the photo (new file name, so every screen
  loads the new one; the old file is queued for the storage purge once nothing
  uses it), suspend / restore / delete.
- **Photos** (Back office → Photos; migration `20261027700000_irly_admin_photos.sql`):
  - *IRLY photos*: every photo the app ships, by where it shows (categories,
    activities catalogue, official communities, Home and destinations, IRLY Girl
    and IRLY Moms, all keys), with search. A photo's sheet says where it shows;
    content staff and admins **Replace** it (the picked image is re-encoded, checked
    ≤ 5 MB, uploaded to the public `app-photos` bucket in their own folder, then
    saved in `public.app_photo_overrides` with a new version) or **Restore IRLY's
    photo**. Every member gets it without a new app version: phones read the list
    at launch, when they sync (back to the app, back online) and the team member's
    own phone at once. The app's own photo stays the fallback.
  - *Member photos*: communities and activities (replace or remove, content staff
    and above), posts, Lives and profiles (remove only, moderators and above: a
    member's photo is never replaced by another picture; a profile falls back to
    the next photo, the avatar or initials). Each opens the item's sheet, where a
    **Photos** panel does the same. Verification selfies are never shown there
    (review only, in Profile verifications); private message photos are not browsed
    (a reported message is removed from its report).
  - Every change needs a reason and is in the moderation log. The old file is
    queued for the storage purge once the new reference is saved, and deleted only
    if nothing uses it any more (checked again when the purge job runs).
- **Activities and posts** (activities, community posts, comments, lives): search,
  sheet, linked reports, hide (restorable), restore, delete (final; words kept 12
  months). Hidden items leave lists, details, search and the IRLY Map for
  everyone but the team; their authors cannot bring them back.
- **Reports**: statuses New / In review / Action needed / Resolved / Rejected,
  related reports (same content, same member), notes, decision history. Closing
  needs a note. Three reports hide a post or live for review only: never a final decision.
- **Moderation log**: append-only (the database refuses updates and deletes,
  except the 24-month retention).
- A suspended or banned member cannot post, message, join, like, follow,
  react, vote or edit what they published; they can still report, block, read
  and delete their account.
