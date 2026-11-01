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
| Community census, Security audit, Website check | read only | manual | `main` only |

Scheduled runs always use the copy of the workflow on the repository's
default branch. Make `main` the default branch so schedules run from reviewed
code.

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
