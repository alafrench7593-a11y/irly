# IRLY — App Review notes (review account, spaces, account deletion)

What the App Review team needs to sign in and find every feature, checked
against the code. The password is **never** written here: it is the
`REVIEW_ACCOUNT_PASSWORD` repository secret and is typed only in App Store
Connect → App Review Information. See also `docs/APP-REVIEW-ANSWERS.md`
(answers to Apple's questions, screen recording script).

## 1. The review account

| | |
|---|---|
| Email | `appreview@getirly.com` |
| Password | given in App Store Connect (App Review Information), not in this repository |
| Made / refreshed by | GitHub → Actions → **Review account** → Run workflow (`.github/workflows/review-account.yml`, `scripts/review-account.mjs`) |
| Profile | first name « App Review », Dubai, a few interests, declared gender `other`, bio saying it is a test account |
| Visibility | hidden from members (profile visibility « nobody », messages from friends only): nobody mistakes it for a real person |

The workflow is safe to run again: it resets the password from the secret,
recreates the account if it was deleted (for example after the reviewer tried
« Delete account »), and proves the app can sign in with it (email + password
through the public key, then reads its own profile through row level security).

## 2. Sign-in steps for the reviewer

1. Launch IRLY.
2. On the Welcome screen, tap **« Already have an account? Sign in »**
   (or go through the short welcome, then Profile tab → **Sign in**).
3. Type the email and the password in the two fields under the Apple / Google
   buttons, then tap **Sign in**.
4. The account's profile comes back from the server: the app opens on Home
   (tap **Continue to IRLY** if the account screen stays open).

Errors are written for people: a wrong password, an unknown email or no
connection each get their own sentence; « Forgot password? » sends a reset
link. Sign in with Apple appears on iPhone only when it is switched on in
Supabase.

## 3. What this account sees, and why

**IRLY (Mixte) — everything.** Home, search, communities (browse, join,
community chat), activities (open, join, create, the plan's group chat),
people and profiles, Live, the map, Messages, notifications, Calendar, Saved,
the professional profile (IRLY Network), Settings, Download my data, Report
(the « … » menu of a profile or post, « Report » under a comment, long press
on a message), Block, Log out and Delete account.

**IRLY Girl and IRLY Maman — closed to this account, by design.** IRLY Girl is
a women-only space inside the same app; IRLY Maman (moms meeting moms, Mom
mode, children's age groups only) lives inside IRLY Girl. Access is decided on
the server by one rule, `private.girl_eligible_unchecked`: the member's
**declared** gender is « woman » and IRLY Girl was not withdrawn by the
moderators. The review account declares `other`, so tapping IRLY Girl or IRLY
Maman shows the « IRLY Girl is reserved for women » screen, which explains the rule. This is
the expected behaviour and is never bypassed (no special case for the review
account in the app or on the server).

Suggested sentence for the Notes field:

> IRLY Girl (and IRLY Maman inside it) is an optional women-only space. Access
> is based on the gender the member declares at sign-up; the demo account
> declares « other », so it sees the explanation screen of that space. Every
> other feature of the app is available to the demo account.

Owner decision, if Apple asks to see IRLY Girl: a second review account whose
profile declares « woman » would see it through the same rule (nothing
bypassed). It does not exist today and is not created by any script.

## 4. Account deletion (guideline 5.1.1(v))

- **Where:** the gear at the top right of every tab → **Settings** → section
  **My account** → **Delete account** (red).
- **Consequences screen:** a sheet titled « Delete your IRLY account? — This
  cannot be undone. » lists what is deleted (profile, photos, professional and
  IRLY Girl profiles, messages, posts, comments, connections, matches,
  notifications, the plans created — people going to an upcoming one are told),
  what happens to owned communities (handed to another member) and what is kept
  (content already reported, for the moderators). It offers « Download my data »
  first.
- **Explicit confirmation:** the red **Delete my account** button in that sheet;
  **Cancel** closes it. A second tap while the request runs does nothing.
- **Server:** `public.delete_my_account()`, a security-definer function
  (no privileged key in the app). In one transaction it deletes the sign-in
  account itself (`auth.users`, so its sessions and the email/password are
  gone: signing in again fails) and every row of the member through the
  foreign keys; it checks the account is gone before answering. Files in the
  member's storage folders are removed by the app and, whatever is left, by the
  purge job (`scripts/storage-purge.mjs`, every 30 minutes).
- **Then:** the phone forgets the session (Supabase sign-out plus the stored
  token removed), closes the live connections, wipes every local store and
  cached photo, and replaces the screens with Welcome (Back cannot return to a
  private screen).
- **Website:** `https://getirly.com/delete-account` explains the same steps and
  what is kept, for people who no longer have the app.

What is kept after deletion (all in the privacy policy, « How long we keep
data »): the text of content that was reported and the reports themselves
(until handled, then 12 months, without the deleted member's id as reporter);
text of messages and comments deleted earlier (12 months); messages to support
(24 months); usage events (13 months, no longer linked to the account);
hosting backups for a short time.

After the reviewer deletes the account, run the **Review account** workflow
again to recreate it.
