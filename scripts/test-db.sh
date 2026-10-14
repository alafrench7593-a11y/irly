#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL database and runs the
# server-side tests (RLS, women-only access, matching, chats, capacity).
# Needs a local PostgreSQL 15+ superuser: PGUSER/PGHOST as usual.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${IRLY_TEST_DB:-irly_test}
dropdb --if-exists "$DB" >/dev/null
createdb "$DB"
cat supabase/tests/shim.sql supabase/migrations/*.sql | psql -v ON_ERROR_STOP=1 -q -d "$DB" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/irly_test.sql
# Regression tests, one file per fix area (each runs on the same schema).
for f in supabase/tests/*.test.sql; do
  [ -e "$f" ] || continue
  echo "== $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
dropdb "$DB"
