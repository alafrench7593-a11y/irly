# Operations

How production is changed from GitHub Actions, and what must stay true.
This repository is public: every Actions log is readable by anyone.

## Rules for workflows

- Production (Supabase database, sign-in settings, accounts, App Store
  Connect) is changed from `main` only. Working branches (`claude/*`) never
  deploy or write production data on push.
- Workflows that change production run in the `production` environment
  (Settings → Environments → `production`). Add required reviewers there and
  restrict its deployment branches to `main`: a run then waits for approval.
- Every workflow declares `permissions:` (least needed: `contents: read`,
  `contents: write` only where it commits).
- Secrets and user inputs reach scripts through `env:`, never as
  `${{ ... }}` inside a `run:` script.
- Logs show counts, never identities (names, emails, ids, chat or community
  titles). Census and clean-up scripts print details only on a local run with
  `IRLY_LOCAL_DETAILS=1` (ignored when `CI` is set).
- Credentials (certificates, profiles, keys) are never uploaded as workflow
  artifacts.

| Workflow | Production effect | Triggers | Guard |
| --- | --- | --- | --- |
| Database (`supabase.yml`) | applies migrations | push to `main`, PR (tests only), manual | deploy job: `main` only, `production` environment, one deploy at a time |
| E2E (`e2e.yml`) | throwaway test accounts | push to `main`, after main's Database run, manual | `main` only |
| Sign-in setup (`auth.yml`) | auth settings | push to `main`, monthly, manual | schedule or `main`, `production` environment |
| Grant owner, Review account | accounts | manual | `main` only, `production` environment |
| Apple build status (`asc-builds.yml`) | App Store Connect team / testers (optional inputs) | manual | `main` only, `production` environment |
| Places, Storage purge, Report email | data refresh, file purge, email | schedule, manual | schedule or `main` |
| Over-the-air update (`ota.yml`) | new JavaScript on installed iPhone apps | manual, input `SEND` | `main` only, `production` environment |
| Android build (`android.yml`) | none (an .aab on Expo, nothing sent to Google Play) | manual | `main` only |
| Health (`health.yml`) | read only: crashes of the last 24 h, newest database backup | daily, manual | schedule or `main` |
| Community census, Security audit, Website check | read only | manual | `main` only |

Scheduled runs always use the copy of the workflow on the repository's
default branch. Make `main` the default branch so schedules run from reviewed
code.

## Crashes, updates and backups

- **Crash reports** go through the app's own analytics (`public.analytics_events`,
  `src/lib/crashReport.ts`): `SCREEN_ERROR` when a screen shows "Something went
  wrong", `JS_ERROR` for errors no screen caught (a fatal one is kept on the
  phone and sent at the next launch). A report holds the error's kind, a
  scrubbed first line (`src/lib/crashScrub.ts`, tested by `npm run test:crash`),
  the screen with ids removed, the app version and the update it ran: never a
  stack, a member's text or an id. Native crashes (outside JavaScript) are not
  caught: App Store Connect → TestFlight → Crashes, or Xcode → Organizer.
- **Health** (`health.yml`, every morning): crashes of the last 24 hours and
  the newest database backup. A red run means something needs a look; GitHub
  emails the failure to the repository's owner. It goes red when the project
  has no backup in 48 hours, which is the case on Supabase's free plan.
- **Over-the-air updates** (`expo-updates`, `ota.yml`): a JavaScript fix
  reaches installed apps without a build or an App Store review; apps check at
  launch and apply it at the next launch. The runtime version is the native
  fingerprint: an update only reaches builds with the same native layer, so a
  JavaScript update can never land on an app missing a native module. Apps
  built before expo-updates was added (build 34 and earlier) receive nothing.
  Apple allows updates that fix or adjust the reviewed app, not ones that
  change its purpose.
- **Restoring the database**: Supabase dashboard → Database → Backups (daily
  backups on a paid plan; point-in-time recovery is an add-on). A restore
  replaces the whole database: decide it with the owner, never from a
  workflow.

## Known advisories (npm audit)

Left as is on purpose, re-checked at each Expo SDK upgrade:

- `maplibre-gl` 5.x (web map, critical): XSS bypass in its HTML sanitizer.
  IRLY never passes HTML to the map (no popups, the attribution comes from the
  tile style). The fixed 6.x changes how its worker loads and breaks the web
  map with the Metro bundler: upgrade when that is solved.
- `expo-router` 57 through `query-string` / `decode-uri-component` (high):
  slow decoding of a malformed link, on the device that opens it. Fixed in
  Expo SDK 58 only.
- `glob`, `minimatch`, `@expo/fingerprint` (moderate): build tools, not in
  the app.

## Running a production clean-up

The one-off clean-up workflows (`cleanup-content.yml`, `cleanup-launch.yml`,
`cleanup-test-data.yml`, `test-data-census.yml`) were removed after they ran:
they were re-armable by editing one `APPLY` line. Removing a workflow file
deletes no data. The scripts stay in `scripts/` for reference and refuse to
delete anything unless **both** `APPLY=1` and
`CONFIRM_PROD_DELETE=yes-i-am-sure` are set. They always keep the App Review
account `appreview@getirly.com` and stop if it would be touched.

To run one deliberately:

1. Re-read the script and adapt its scope (ids, patterns) to today's data.
   Start with a read-only census (counts only in the log).
2. On a branch, add a new workflow that has only a manual trigger and the
   `production` environment, and runs from `main` only:

   ```yaml
   name: Clean-up (one-off, YYYY-MM-DD)
   on:
     workflow_dispatch:
       inputs:
         apply:
           description: Type DELETE to delete (anything else is a dry run)
           default: dry-run
   permissions:
     contents: read
   jobs:
     cleanup:
       if: github.ref == 'refs/heads/main'
       runs-on: ubuntu-latest
       environment: production
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 22
         - run: node scripts/cleanup-content.mjs
           env:
             SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
             APPLY: ${{ inputs.apply == 'DELETE' && '1' || '0' }}
             CONFIRM_PROD_DELETE: ${{ inputs.apply == 'DELETE' && 'yes-i-am-sure' || '' }}
   ```

   No `push:` trigger: merging the file must never run it.
3. Open a pull request; have it reviewed and merged to `main`.
4. Actions → the workflow → Run workflow on `main`, first as a dry run;
   check the counts. Then run it again with `DELETE`; a `production`
   reviewer approves the run.
5. Delete the workflow file in a follow-up pull request the same day.
