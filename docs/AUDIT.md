# IRLY: pre-launch audit (7 October 2026)

Scope: the Expo app (`src/`), the Supabase backend (`supabase/migrations`), the CI and the iOS configuration (`app.json`).

The audit was done by:
- reading the code;
- running the database test suite (`scripts/test-db.sh`) on a fresh copy of every migration;
- querying the schema for missing protections;
- crawling every screen of the web build;
- running the end-to-end tests in a real browser against the live backend, with two real member accounts (`scripts/e2e-ui.mjs`, `scripts/e2e-sync.mjs`).

**This report is not a legal opinion.** The legal texts in the app are drafts. A lawyer must review them, and every `[LEGAL INFORMATION REQUIRED]` must be filled in `src/config/app.ts` before launch.

---

## Summary

| | Found | Fixed | Remaining |
|---|---|---|---|
| 🔴 Critical | 11 | 11 | 0 |
| 🟠 High | 19 | 16 | 3 (moderation tool, IRLY Girl legal review, push setup: listed below) |
| 🟡 Medium | 6 | 4 | 2 |
| 🟢 Low | 4 | 1 | 3 |
| **Total** | **40** | **32** | **8** |

By type:

| Type | Count | Problems |
|---|---|---|
| Synchronisation | 7 | 1, 7, 12, 13, 19, 20, 28 |
| Security, privacy and data rights | 10 | 4, 6, 17, 18, 22, 29, 32 and remaining items |
| App Store | 9 | 2, 9, 10, 11, 23, 24, 25, 26 and remaining items |
| UX | 8 | 3, 14, 15, 16, 21, 27, 30, 31 |
| Performance | 1 | UnreadSync: one realtime subscription for the whole app instead of one per header |

---

## 🔴 Critical (all fixed)

Each problem is set out as **Problem → Cause → Fix → Test**.

1. **Chat: the newest messages were missing in long conversations**
   - Problem: after 200 messages, a conversation showed the oldest 200, never the latest ones.
   - Cause: `order(created_at).limit(200)` read the history from the start.
   - Fix: the chat now loads the newest 50 messages, then older ones on demand ("Load earlier messages"). Messages are merged without duplicates and kept in time order (`src/features/server/chat.ts`).
   - Test: the E2E steps "message still there after a reload" and the earlier chat steps.

2. **Invented content was shown as real activity**
   - Problem: people, sessions, events, communities, places, and services with ratings and reviews were all fictional, yet presented as real. Private chats with example people answered automatically ("typing…" then a canned reply). The notifications, the bell count, the lives and the IRLY Girl members were examples too.
   - Cause: this was seed content from the prototype.
   - Fix: hidden in production, at one place (`src/data/repo.ts`, `src/features/girl/api.ts`, `Headers.tsx`). The build flag `EXPO_PUBLIC_DEMO=1` brings it back for presentations. City guides and editorials stay, since they are general information.
   - Test:
     - the crawl of 54 screens shows no crash and no blank screen;
     - the E2E suite passes without demo content.

3. **The profile could not be edited after signup**
   - Problem: name, bio, photo, languages, interests and city were frozen after onboarding.
   - Cause: there was no edit screen.
   - Fix: a new **Edit profile** screen (`src/app/edit-profile.tsx`) backed by `updateMyProfile`. It saves on the server first, then on the phone. A new photo replaces the old file in storage.
   - Test:
     - DB tests: a member edits their own fields, never someone else's;
     - E2E: the new bio reaches the server.

4. **Deleting an account left the photos in storage**
   - Problem: profile, IRLY Girl, live and activity photos stayed in storage after the account was deleted.
   - Cause: the database cannot delete storage files.
   - Fix: the app now deletes your files in all four buckets before the server deletes the account. The deletion also:
     - unregisters the push token;
     - signs out locally;
     - explains in the sheet what will be deleted;
     - offers the data export first.
   - Test: the last E2E step deletes the test account from the app, then checks that the profile, the auth user, the messages and the storage files are all gone.

5. **Every report was filed as "inappropriate", with no choice of reason**
   - Problem: messages could not be reported at all, and Networking had no Report and no Block.
   - Cause: the category was hard-coded.
   - Fix: one report sheet with 8 categories (harassment, hate speech, spam, scam, fake profile, inappropriate content, threats, other), optional details and "Also block". It is used:
     - on activities, communities, community posts, comments and live posts;
     - on messages, with a long press;
     - on chat headers;
     - on Networking profiles.

     The server accepts only these categories.
   - Test:
     - DB: reporting a message as a scam, a profile for threats, an unknown category is refused, members never read reports about them;
     - E2E: a long press on a message, then Scam, is stored.

6. **Blocking did not end connections or private chats**
   - Problem: after a block, the connection or pending request remained, and the private chat stayed in both inboxes.
   - Cause: `block_user` only handled IRLY Girl matches.
   - Fix: `block_user` now also:
     - deletes the friendship or connection both ways;
     - deletes the requests between the two people;
     - removes the private chat from both inboxes;
     - leaves the blocked person's messages out of the unread counts and the "last message".
   - Test:
     - DB: chat hidden for both people, writing refused, a new request refused;
     - E2E: block from the chat, then the other member's insert is refused.

7. **The Messages badge stayed at 0 for real members**
   - Problem: real members never saw a count of their unread messages.
   - Cause: the badge only counted the example conversations.
   - Fix: a single `UnreadSync` at the root feeds the badge from the real inbox, with one realtime subscription for the whole app.
   - Test: E2E "Vera writes while Uma is elsewhere → the Messages badge counts it".

8. **"Typing…" could never reach the other person**
   - Problem: each phone subscribed to its own uniquely named topic, so broadcasts were never shared.
   - Cause: the helper that names realtime topics adds a unique suffix to each subscription.
   - Fix: one shared `typing:<conversation>` topic per chat.
   - Test: the E2E step "Vera is typing → Uma sees it".

9. **No Privacy Policy, Terms or Community Guidelines in the app**
   - Problem: Apple requires these documents to be reachable in the app.
   - Cause: they did not exist.
   - Fix:
     - the three texts are in `src/content/legal.ts`, reachable from Profile → Legal & support;
     - they are linked at sign-up, with confirmation of the minimum age;
     - the facts they need come from one config (`src/config/app.ts`);
     - missing legal facts are shown in red as `[LEGAL INFORMATION REQUIRED]`.
   - Test: the crawl (legal routes, and an unknown document shows "does not exist").

10. **Google sign-in on iPhone without Sign in with Apple (rule 4.8)**
    - Problem: Google could be offered alone on iPhone.
    - Cause: the buttons depended only on which providers are switched on.
    - Fix: on iOS, Google is offered only when Apple is offered too.
    - Test: code review. This needs a device to confirm.

11. **Permissions declared but never used, and no privacy manifest**
    - Problem: camera, microphone (added by default by the image picker) and "always" location were declared without being used.
    - Cause: the plugins' default options.
    - Fix:
      - the camera and microphone permissions are removed;
      - "always" location is off;
      - the location and photos texts are rewritten to say exactly what IRLY does;
      - `ios.privacyManifests` is added (UserDefaults, file timestamp, boot time, disk space; no tracking).
    - Test: `expo prebuild` → `Info.plist` contains only location while in use, motion and photo library; `PrivacyInfo.xcprivacy` is generated.

## 🟠 High (fixed)

12. Messages missed while the app was in the background or offline were never fetched. The chat now catches up when the app returns to the foreground and when the realtime connection comes back.
13. Deleted messages stayed on the other phone. They are now removed live, and when catching up.
14. You could not delete a message you sent. Now: long press → delete for everyone (`delete_my_message`). The text is kept aside only for moderators.
15. Chats showed no times. Each run of messages now shows its time, with a line for each day.
16. There was no way to see or unblock blocked members. Added: Settings → Blocked members (`my_blocks`).
17. There was no data export (GDPR access and portability). Added: Download my data (`export_my_data`). It contains only your own data; other people's messages are left out.
18. There was no support, no contact and no "Report a problem". Added: Help & support (FAQ, a form stored in `support_requests`, 5 messages an hour at most, only admins can read it).
19. The profile photo link expired after 30 days. It is now renewed at every launch.
20. Changing city did not update the server profile. It now does.
21. The map could crash when location services were off. Errors are now handled, with a message and the city view.
22. Shared links pointed to `irly.app`, a domain the project does not control. Links now use one configured web address.
23. The text "coming soon" was shown (rule 2.1). Removed.
24. The developer "Design System" screen appeared in production settings. It now shows only in the demo build.
25. Sign-up only said "keep IRLY safe". It now links the Terms, Guidelines and Privacy Policy and confirms you are 18 or older.
26. `supportsTablet: true` without an iPad layout. The app is now iPhone only. A build number was added.
27. Delete account had no loading state, so a double tap was possible, and the explanation was weak. Both fixed.

## 🟡 Medium

- **Fixed**:
  - 28: messages from blocked senders were counted as unread;
  - 29: usage events were kept forever, now 13 months;
  - 30: Notifications was a blank page when empty, now an empty state;
  - 31: age was editable, which the server refuses (minimum age), so it is now shown read-only.
- **Remaining**:
  - no photos in server chats (the database supports them, the app does not send them yet);
  - the legal texts are in English only (the rest of the app is English and French).

## 🟢 Low

- **Fixed**: 32, Networking connection requests have their own notifications and a limit of 30 a day (done before this audit).
- **Remaining**:
  - anyone can insert usage events (size-limited, no personal data);
  - an access token stays valid on the server until it expires (about an hour) after the account is deleted, though the account rows no longer exist;
  - the profile page `/person/:id` only exists for example people.

## Remaining High (not code, or needs a decision)

- **Moderation back office.** Reports are stored with a priority (3 reporters in a day = high), but there is no screen for moderators. Apple expects reports to be acted on. Until a tool exists, use the Supabase dashboard (`reports`, `moderation_cases`, `private.removed_content`) and define a response time.
- **IRLY Girl access is based on the gender each member declares.** It is not verified. Have this reviewed by a lawyer for each country (UAE, Indonesia, EU users).
- **Phone notifications are not live yet.** They need an EAS project id (`eas init`) and a store build. Also confirm the `pg_net` extension is enabled in Supabase (Database → Extensions).

---

## Data inventory

| Data | Why | Where | Who can see it | Kept | Edit | Delete |
|---|---|---|---|---|---|---|
| Email / phone | sign-in | Supabase Auth | member; admins via dashboard | until deletion | Security | Delete account |
| First name, photo, bio, languages, interests, city, country | profile, suggestions | `profiles`, `profile-photos` | members, per "Who can find my profile" | until deletion | Edit profile | Delete account |
| Birth year (age) | 18+ rule, age shown | `profiles.birthdate` (not readable by other members) | member (via `my_profile`) | until deletion | support only | Delete account |
| Gender | IRLY Girl access | `profiles.gender` (not readable by others) | server checks only | until deletion | support only | Delete account |
| Faith (optional) | shown only if the member chooses | `profiles.faith` (not readable by others) | nobody unless shown | until deletion | at signup | Delete account |
| Professional profile | Networking | `pro_profiles` | members (unless hidden or blocked) | until deletion | Professional | in-app, or Delete account |
| IRLY Girl profile, likes, matches | matching | `irly_match_*`, `match-photos` | eligible women | until deletion | IRLY Girl profile | Delete account |
| Messages | chat | `messages` | conversation members | until deletion | delete own | Delete account |
| Posts, comments, lives, activities | community | their tables, `irl-media`, `activity-photos` | per audience | until deletion; lives 4 h | delete own | Delete account |
| Connections, blocks | social graph, safety | `friendships`, `blocks` | the two people | until deletion | yes | Delete account |
| Reports | moderation | `reports`, `moderation_cases`, `private.removed_content` | reporter (own); admins | until handled + 12 months (enforced on the server) | no | kept for moderation |
| Push token + language | notifications | `push_tokens`, `push_outbox` (7 days) | server only | until sign-out or deletion | Settings switch | sign-out or Delete account |
| Usage events | product statistics | `analytics_events` (no text, email, location, faith or gender) | admins | 13 months | no | removed after 13 months |
| Device location | centre the map | phone only, never sent | nobody | not stored | — | — |
| Support requests | help | `support_requests` | admins | 24 months (enforced on the server) | no | not linked once the account is deleted |

Third-party SDKs: none for analytics or advertising. The services used are Supabase, the Expo push service, Apple/Google sign-in if switched on, and the phone's maps.

---

## Manual check required

- Filled on 7 October 2026: individual operator (Samuel Princivil), address (Dubai Digital Park, Dubai Silicon Oasis), Dubai law and courts, UAE PDPL, hosting in the EU (Ireland; inferred from the database address, to confirm in Supabase → Settings → General), legal bases, data protection authority, and retention (reports 12 months after closing, support 24 months, both enforced on the server).
- Still to fill in `src/config/app.ts` and `src/content/legal.ts`: the exact public email(s), the safeguards for transfers outside the EU and UAE, and the liability clause. Then have the three texts reviewed by a lawyer (UAE).
- App Store Connect:
  - privacy nutrition labels (from the inventory above);
  - age rating (social, user-to-user chat, meeting people: 17+ suggested);
  - support URL and privacy policy URL, which need public web pages;
  - the reviewer's demo account.
- On a real iPhone:
  - Sign in with Apple and Google, if switched on;
  - permission prompts (photos, location, notifications) when allowed and refused;
  - push delivery and opening the right screen from a notification;
  - keyboard and safe areas on a small screen (iPhone SE) and a Dynamic Island model;
  - Wi-Fi to 4G switch during a chat.
- Supabase settings:
  - `pg_net` enabled;
  - email templates and redirect URLs;
  - Google/Apple providers;
  - password policy;
  - rate limits.
- Who handles reports and support requests, and how fast.
- Whether gender-restricted features (IRLY Girl) are lawful where IRLY launches.
