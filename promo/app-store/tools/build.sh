#!/usr/bin/env bash
# The two web builds the screens come from (written to dist/, ignored by git).
# --clear matters: Expo inlines EXPO_PUBLIC_* at build time and its cache would keep the other build's values.
set -euo pipefail
cd "$(dirname "$0")/../../.."
EXPO_PUBLIC_DEMO=1 npx expo export --clear --platform web --output-dir dist/app-store-demo
EXPO_PUBLIC_SUPABASE_URL=https://irlymock.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_mock000000000000000000000 \
  npx expo export --clear --platform web --output-dir dist/app-store-prod
