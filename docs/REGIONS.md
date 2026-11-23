# Regions: IRLY Emirates and IRLY Bali

One IRLY account, one region at a time. A region is where the member **lives**; it is not her nationality, her language or where her phone is today.

| Region | Server id (`countries.id`) | App destination | Cities |
| --- | --- | --- | --- |
| IRLY Emirates | `ae` | `emirates` | dubai, abudhabi, sharjah, ajman, uaq, rak, fujairah |
| IRLY Bali | `id` | `bali` | bali (`Asia/Makassar`, IDR) |

## What was already there
- App: `src/data/destinations.ts`, a registry of destinations and cities (areas, currency, UTC offset, photos). No screen names a destination.
- Server: `countries`, `regions`, `cities` (with their timezone), areas and IRLY's official communities for every city, Bali included. Lists took a city chosen by the app.

## What makes it a region (migration `20261125000000_irly_regions.sql`)
- `profiles.region_id`: the country of the profile's city, kept by a trigger. Inside a region the city changes freely (the emirate picker); a direct write of a city of another region is refused.
- Reads: restrictive policies on `activities`, `communities`, `irl_posts`, `news_articles` (posts, comments, likes, pins and members follow their community). `private.city_scope`, used by the lists (feed, Lives, map, search, people suggested, Network, IRLY Girl), answers for the member's own region whatever city is asked. `city_challenges` and `game_rooms_open` likewise.
- Writes: triggers refuse creating an activity, a community or a Live outside one's region, joining a community or an activity of another region, and sitting at a public game table of another region.
- Not regional: private chats, a private game table joined by its code, reference data (places, areas), a member's profile opened from a chat.
- IRLY's staff read every region.

## Residence
- At sign-up the first screen asks « Where do you live? »; the choice is recorded with its date once the profile exists (`declare_residency`, table `region_declarations`).
- It is a statement on the member's honour. IRLY checks no document and no location, and claims neither.
- Accounts created before regions live in the Emirates (the city they already had); nothing was asked of them.

## Moving (`change_region`)
Asked from Settings → Destination (or wherever a city of another region is picked): the app opens « Move to another region ».
- Kept: the account, the profile, private chats, what she organised, her history.
- Left: the communities of the region she leaves and their chats; her seat in activities coming up there; pending requests to join private communities there.
- Refused: without the declaration; while she owns a community there (handed over or deleted first); less than 90 days after her last move; a suspended account.

## Opening another region
1. Server: rows in `countries`, `regions`, `cities` (with timezone), areas, official communities.
2. App: the destination and its cities in `src/data/destinations.ts` with `status: 'live'`, and its line in `REGION_OF` (`src/features/region/region.ts`).
Nothing else names a region.

## Known limits
- Residence is declared, not verified.
- « Dubai News & Life » reads the Emirates' sources: a region without sources has no news door.
- Notifications are sent for things a member is part of (her communities, activities, chats); there is no region-wide broadcast to separate.
