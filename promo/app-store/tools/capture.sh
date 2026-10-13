#!/usr/bin/env bash
# Captures the app screens used by the visuals into tools/screens (440 x 956 pt at 3x = 1320 x 2868 px).
# IRLY_REPO: the checkout whose web builds (dist/, made by build.sh) and photos are used; the
# screenshots come from main (522eede, 13 October 2026). Without it, this repository is used.
# Every screen is a production screen talking to the fictional backend in mock.mjs.
# Scroll positions (after ~) keep text clear of the bars and of the screen edge:
# DUMP=1 node shoot.mjs <dir> 1 'name=/route@wait~scroll' lists every text line and photo in view.
set -euo pipefail
cd "$(dirname "$0")"

# The ten App Store screenshots (compose.mjs, visuals.json).
APPEAR=day node shoot.mjs screens 3 \
  'm-match-day=/match@8000' 'm-network-day=/network@8000' 'm-communities-day=/communities@8000' \
  'm-community-day=/c/{COM.newcomers}@8000~1080' 'm-chat-day=/messages/{CONV.newcomers}@8000'
APPEAR=night node shoot.mjs screens 3 \
  'm-outdoor-night=/category/outdoor@8000~13' 'm-outdoor-night-113=/category/outdoor@8000~113' \
  'm-volley-night=/a/{ACT.volley}@8000' 'm-live-night=/live@8000' 'm-nadia-night=/person/{P.nadia}@8000' \
  'm-messages-night=/messages@8000'

# Header and search results images (compose-header.mjs), captured on 11 to 13 October from
# commit af7406e: Home comes from the demo build, taken at 21:41 Dubai time so that the
# 9:41 of the status bar matches the time shown on Home.
if [ "${HEADER_SCREENS:-0}" = 1 ]; then
  CLOCK=2026-10-13T21:41:00+04:00 APPEAR=night node shoot.mjs screens 3 'home-top=/@10000~54|demo'
  APPEAR=day node shoot.mjs screens 3 'match-day=/match@7000'
  APPEAR=night node shoot.mjs screens 3 'category-outdoor-night=/category/outdoor@7000~13'
fi
