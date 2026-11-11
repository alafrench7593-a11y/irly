# What IRLY is, with the source of each fact

Read from the code on 12 November 2026. The pages of the site say nothing that is not here. When the app changes, this file changes first, then the pages.

## Identity
| Fact | Source |
| --- | --- |
| Name: IRLY; app name « IRLY — Make Friends IRL »; site getirly.com | owner |
| An app to meet people who share your interests and do things together in real life; not a dating app | owner |
| Free; in the browser at getirly.com/app; iOS and Android apps coming | owner (not traced in code) |
| English and French, written, not machine-translated | `src/i18n/index.ts` |
| For adults: « IRLY is for people 18 and over » | `src/app/onboarding/profile.tsx`, `src/features/auth/signup.ts` |
| Publisher ALF FASHION BRAND FZCO; contact getirly@gmail.com | `src/config/app.ts`, `site/head.html` |
| Seven emirates in « IRLY Emirates »; Dubai is the launch city, the others are labelled « Early access » | `src/data/destinations.ts`, `src/app/onboarding/emirates.tsx` |

## What a member does
| Step | What the app really does | Source |
| --- | --- | --- |
| Start | Chooses a destination and an emirate, then four steps (first name and descriptions; at least three interests; profile with photo or avatar, age, bio, country, languages, gender; what they look for) | `src/app/welcome.tsx`, `src/app/onboarding/*`, `src/features/auth/signup.ts` |
| Account | Email and password (8 characters or more), or a sign-in link by email; the email may carry a 6-digit code | `src/app/account.tsx` |
| First communities | Suggested from the profile: « Join all », choose, or skip | `src/app/onboarding/communities.tsx` |
| Communities | Lists « Mine », « For you », « Discover »; search; themes. Joining is direct (no approval) and puts the member in the community's chat. A community page has Posts, Chat, Activities, Members | `src/app/communities.tsx`, `src/app/c/[id].tsx` |
| Creating a community | Any member: name, one line, about, category; the creator owns it | `src/app/community/new.tsx` |
| Creating an activity | Four steps: what, when and where (date, time, neighbourhood, optional address), who can see it (Public, Mutual follows, Community, Invite only), how many (2 to 60 or unlimited), free or paid, photo, description. A chat is created with it | `src/features/create/CreateHost.tsx` |
| Joining an activity | « Join the activity »; it goes to the calendar and its chat opens; the exact meeting point is shared in the chat; leaving frees the spot | `src/features/activity/ActivityDetailView.tsx` |
| Safety | Report (seen by IRLY's moderators only), block, list of blocked members | `src/features/moderation/ReportSheet.tsx`, `src/app/blocked.tsx` |
| IRLY Girl | Reserved for women; access follows the gender of the account, with a one-time photo check by the team | `src/features/girl/access.tsx` |
| IRLY Network | Professional profile, professionals, professional meetups, networking communities | `src/app/network/index.tsx` |
| IRLY Games | One game, Loup-Garou: online, against AI players, or a table joined by code | `src/features/games/catalog.ts`, `src/features/games/werewolf/home/WerewolfHome.tsx` |

## Never to be written
User numbers, ratings, reviews, testimonials, awards, partners, press, a count or list of communities, scheduled activities, prices of anything, store links (until the apps are out).

## Left out on purpose
- Google, Apple and phone sign-in: the buttons exist but show only when switched on; the live setting was not confirmed.
- Match IRLY: shown as « Soon ». IRLY Bali and other destinations: announced, not open.
- Paying for a paid activity inside the app: not checked, so nothing is said about it.
- Voice tables in Loup-Garou: built, not switched on.

## Who is named beside IRLY in search results (12 November 2026, one search each, results from the United States)
For « how to make friends in Dubai »: guides from property portals and from The National, Gulf News and Khaleej Times; the apps they name are Bumble BFF, Meetup, InterNations and Belong (a Dubai start-up covered by The National). For « comment se faire des amis à Dubaï »: almost no French editorial page; forum threads on expat.com and routard.com. The French search is the more open one.
