# IRLY · launch film

27 s, 1440×1440, 60 fps, 120 BPM (54 beats), one continuous take.

- `irly-film.html`: the film. Open it to scrub (space plays). Every frame is
  drawn by `window.seek(t)` from time alone.
- `src/`: engine (`core.js`: springs, iris, liquid glass) and scenes A, B, C, E.
- `node build.mjs`: inlines fonts, photos and scripts into `irly-film.html`.
- `node stills.mjs <beats…>`: contact sheet of chosen beats.
- `node render.mjs`: 4 sub-frames per frame with Playwright, blended with
  ffmpeg `tmix` into `irly-film-silent.mp4`.
- `./checkpops.sh`: flags single-frame pops.

Photos: the app's public-domain library (`public-photos/`, see its CREDITS.md).
Audio: not yet; the track and sound effects (Mixkit) come next.
