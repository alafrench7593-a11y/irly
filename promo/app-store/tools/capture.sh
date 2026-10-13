#!/usr/bin/env bash
# Captures the 9 app screens used by the visuals into tools/screens (440 x 956 pt at 3x = 1320 x 2868 px).
# Production screens talk to the fictional backend in mock.mjs; Home and Discover come from the demo build.
# Demo screens are taken at 21:41 Dubai time, so the 9:41 of the status bar matches the time shown on Home.
# Scroll positions (after ~) are chosen so that no text is cut by the top bar or the tab bar
# (on Sport, the floating "Create session" button only covers the repeated "Planned by a member" label):
# DUMP=1 node shoot.mjs <dir> 1 'name=/route@wait~scroll|demo' lists every text line and photo in view.
# Discover shows Layla as already connected ("Message"), so her white "Connect" button does not merge with the MATCH button.
set -euo pipefail
cd "$(dirname "$0")"
CLOCK=2026-10-13T21:41:00+04:00 APPEAR=night node shoot.mjs screens 3 \
  'home-top=/@10000~54|demo' 'home-scroll=/@10000~920|demo' 'discover-scroll=/discover@9000~382|demo|{"connections":{"p-layla":"connected"}}'
APPEAR=day node shoot.mjs screens 3 \
  'match-day=/match@7000' 'communities-day=/communities@7000' 'live-day-scroll=/live@8000~1450'
APPEAR=night node shoot.mjs screens 3 \
  'category-night=/category/sport@7000~13' 'newcomers-chat-night=/messages/{CONV.newcomers}@8000' \
  'category-outdoor-night=/category/outdoor@7000~13'
