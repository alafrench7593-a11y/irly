# IRLY on every screen size (phones, folding phones, wide windows)

One app, one codebase. The layout is chosen from the width IRLY really has,
never from a device name. No public iOS API reports a fold state, and no
folding iPhone or simulator exists yet. "Inner" and "outer" screens below
are width classes simulated in a browser. They are not tests on a real
device.

## Architecture

| Piece | File | Role |
|---|---|---|
| Size classes | `src/components/layout/responsive.tsx` | `compact` < 360 pt, `regular` 360–699, `expanded` ≥ 700. `useLayout()` updates live on rotate, fold or resize. |
| Page width | `src/components/layout/frame.ts` | `useFrame()` gives the width this page is given. Cards size themselves from it, never from the window. |
| Page column | `ScreenColumn` (root stack and tabs `screenLayout`) | Phones: full width. Wide windows: pages without a wide layout keep a 640 pt column over the destination's blurred light (`AmbientBackdrop`). Pages in `WIDE_ROUTES` / `WIDE_TABS` get the full width. The tree is the same at every size, so pages are not remounted. |
| Navigation | `src/components/navigation/TabBar.tsx` | Phones: the floating glass bar. Expanded: the same slots in a glass rail on the left, which tightens on short windows. |
| Shell | `src/components/layout/AppFrame.tsx` | Native apps always fill their window. Desktop web keeps the phone preview from 1200 px; `?frame=0` turns it off. |
| Helpers | `layout/SplitView.tsx`, `layout/ProfileColumns.tsx`, `layout/grid.ts`, `layout/wide.tsx` | List + detail panes, two-column profiles, grid columns computed from width, wide columns, grids and masonry. |

## Wide layouts (expanded)

- **Messages:** conversation list on the left and the conversation on the right, with an empty state when none is selected. Folding back to narrow opens the selected conversation as a page.
- **Activities and an activity type:** filters pinned at the top, list on the left, the session detail on the right with Going / Not going / Maybe at the bottom. The selection is kept in `?s=`.
- **Profiles** (member, your own, demo people, Network):
  - left column: photo, identity and actions, sticky while the right column scrolls;
  - right column: interests, activities, communities, posts.
- **Search** (Discover with a query): kinds and counts in a side column, results in 2–4 column grids.
- **Communities:**
  - the list: filters in a side column, a grid of richer cards;
  - a community page from 900 pt: info and Join on the left, the feed on the right.
- **Home:** main column plus a side column (today, news, people near you, your communities).
- **Discover:** grids computed from width.
- **IRL:** two-column feed, with Go live and the people live around you in a side panel.

## Audit: what was not adaptive, and what changed

- `AppFrame` locked every window of 700 pt and more (native included) into a 430 pt phone column. It now fills the window on native, and the size class picks the layout.
- The tab bar was always a bottom bar. It becomes a rail when expanded.
- The activity-type grid broke words at 320 pt ("Networkin/g"). The column count now comes from the width.
- Fixed widths that are left as they are: cards inside horizontal carousels (210, 248, 168 pt…). They scroll sideways by design and passed at 320 pt. Admin screens (CRM pipeline columns) are staff-only and were not reworked.

## Tests

`node scripts/e2e-responsive.mjs <demo dist>` runs the demo web build:

- 14 main screens × 8 width classes:
  - 320 narrow outer screen;
  - 375, 393 and 440 phones;
  - 760 portrait, 900 square and 1100 landscape inner screens;
  - 852 phone held sideways.
- For each screen and size it checks that there is no horizontal overflow and no page error.
- It also resizes the window while text is typed in Search and checks the text is kept.

Last run: 226 passed, 0 failed.

## Still to adapt or to decide

- **Orientation:** iPhones stay portrait-only (`app.json`, `UISupportedInterfaceOrientations`). Unlocking landscape needs a native build, a choice of which screens rotate, and tests on device. The wide layouts already work in landscape windows on the web.
- **`supportsTablet` is false:** iPads run IRLY in iPhone compatibility mode. Turning it on would show the wide layouts on iPad, but App Store Connect then requires iPad screenshots.
- **Folding iPhone:** how iOS will present an iPhone-only app on a large inner screen is unknown (full window or compatibility mode). If it gives the full window, the expanded layouts apply automatically.
- **Wide layouts checked only by type-checking:** the signed-in member profile, a server community page and server activities in a pane. The demo build has no server data for these.
- **Pages on the readable column only:** settings, notifications, events, categories, onboarding, IRLY Girl and Mom flows, legal pages, admin.
- **Known limits:**
  - the IRL masonry is not balanced by height;
  - the side columns on Home and Communities are not pinned;
  - crossing 760 pt remounts the Home sections that move between columns (scroll and page state are kept).
- **Subscriptions and payments:** there is no subscription or payment screen in the app today, so there was nothing to adapt.
