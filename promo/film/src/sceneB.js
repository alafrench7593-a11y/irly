/* Scene B (the drop): glass letters → goo drop → glass toolbar → slider →
   day to golden hour → held knob becomes a lens → glass ball → next photo. */
'use strict';
const Bs = {};
const TOOLBAR = [330, 1170, 780, 124];
const SLIDER = [370, 1190, 700, 84];
const KNOB_Y = 1232, KNOB_X0 = 430, KNOB_X1 = 1010;
const BALL = { x: 720, y: 600 };
// Lock-screen wallpaper as it will appear when scene C takes over (frame coords).
const WALL = { x: -1776, y: -840, w: 4992, h: 3120 };

function buildB(stage) {
  Bs.root = H('div', { class: 'scene' }, stage);
  Bs.cam = H('div', {}, Bs.root, { position: 'absolute', left: 0, top: 0, width: `${W}px`, height: `${W}px`, transformOrigin: '0 0' });
  Bs.svg = S('svg', { width: W, height: W, viewBox: `0 0 ${W} ${W}` }, Bs.cam);
  Bs.svg.style.position = 'absolute';
  // the backdrop every glass element clones
  const bd = S('g', { id: 'bdB' }, Bs.svg);
  const c = cover('jbr', 0, 0, W, W);
  S('image', { href: IMG.jbr.url, x: c.x, y: c.y, width: c.w, height: c.h, preserveAspectRatio: 'none' }, bd);
  Bs.gold = S('image', { href: IMG.jbr_gold.url, x: c.x, y: c.y, width: c.w, height: c.h, preserveAspectRatio: 'none', opacity: 0 }, bd);

  // glass letters
  const font = { family: 'Archivo', weight: 800, stretch: 'expanded' };
  const size = 300;
  const word = 'LIVE';
  Bs.glyphs = [...word].map((ch) => glyphAssets(ch, font, size));
  const total = Bs.glyphs.reduce((s, a) => s + a.adv, 0) + 18 * (word.length - 1);
  let x = 720 - total / 2;
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = `800 ${size}px Archivo`;
  const capH = cv.measureText('L').actualBoundingBoxAscent;
  Bs.base = 700 + capH / 2;
  Bs.letters = Bs.glyphs.map((a) => {
    const gg = S('g', {}, Bs.svg);
    const cid = `lc${maskN++}`;
    const cp = S('clipPath', { id: cid }, DEFS);
    S('rect', { x: 0, y: 0, width: W, height: Bs.base + 4 }, cp);
    gg.setAttribute('clip-path', `url(#${cid})`);
    const gl = glyphGlass(gg, 'bdB', a);
    const L = { a, x, g: gg, gl };
    x += a.adv + 18;
    return L;
  });

  // goo: letters melt into a drop that stretches into the toolbar
  const goo = S('filter', { id: 'gooB', filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: W, 'color-interpolation-filters': 'sRGB' }, DEFS);
  Bs.gooBlur = S('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 1, result: 'bl' }, goo);
  S('feColorMatrix', { in: 'bl', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11', result: 'g' }, goo);
  const fm = S('feMerge', {}, goo);
  S('feMergeNode', { in: 'g' }, fm);
  S('feMergeNode', { in: 'SourceGraphic' }, fm);
  const gm = S('mask', { id: 'gooMaskB', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: W }, DEFS);
  Bs.gooShapes = S('g', { id: 'gooShapesB', filter: 'url(#gooB)' }, gm);
  Bs.gooLetters = Bs.letters.map((L) => {
    const t = S('text', { text: L.a.ch, fill: '#fff' }, Bs.gooShapes);
    st(t, { fontFamily: 'Archivo', fontWeight: 800, fontStretch: '125%', fontSize: `${size}px` });
    return t;
  });
  Bs.drop = S('rect', { fill: '#fff' }, Bs.gooShapes);
  Bs.gooGlass = S('g', { mask: 'url(#gooMaskB)' }, Bs.svg);
  Bs.gooDf = dispFilter();
  S('use', { href: '#bdB', filter: `url(#${Bs.gooDf.id})` }, Bs.gooGlass);
  S('rect', { x: 0, y: 0, width: W, height: W, fill: 'rgba(255,255,255,0.16)' }, Bs.gooGlass);
  // goo rim: the goo outline, eroded, as a thin light edge
  const rimF = S('filter', { id: 'gooRimB', filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: W }, DEFS);
  Bs.rimBlur = S('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 1, result: 'bl' }, rimF);
  S('feColorMatrix', { in: 'bl', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 24 -11', result: 'g' }, rimF);
  S('feMorphology', { in: 'g', operator: 'erode', radius: 2, result: 'e' }, rimF);
  S('feComposite', { in: 'g', in2: 'e', operator: 'out', result: 'edge' }, rimF);
  S('feColorMatrix', { in: 'edge', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.75 0' }, rimF);
  Bs.gooRim = S('use', { href: '#gooShapesB', filter: 'url(#gooRimB)' }, Bs.svg);

  // the one glass shape: toolbar → slider → knob → lens → ball → flood
  Bs.pill = glassRR(Bs.svg, 'bdB');
  // burj photo opening inside the ball (in the glass, above the clone)
  const bc = S('clipPath', { id: 'ballClip' }, DEFS);
  Bs.ballClipC = S('circle', {}, bc);
  Bs.ballImg = S('image', { href: IMG.burjKhalifa.url, x: WALL.x, y: WALL.y, width: WALL.w, height: WALL.h, preserveAspectRatio: 'none', 'clip-path': 'url(#ballClip)' }, Bs.svg);
  Bs.ballRim = S('circle', { fill: 'none', stroke: 'rgba(255,255,255,0.8)', 'stroke-width': 2 }, Bs.svg);
  // slider track and knob
  Bs.track = S('line', { stroke: '#FFFFFF', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.92 }, Bs.svg);
  Bs.knob = glassRR(Bs.svg, 'bdB', { tint: 'rgba(255,255,255,0.22)' });
  // toolbar icons (white), springing from zero
  Bs.icons = ['home', 'map', 'plus', 'chat', 'sliders'].map((n) => {
    const g = S('g', {}, Bs.svg);
    if (n === 'plus') S('circle', { r: 34, fill: '#FFFFFF' }, g);
    const p = S('path', { d: ICON[n], fill: 'none', stroke: n === 'plus' ? '#0B0B0C' : '#FFFFFF', 'stroke-width': n === 'plus' ? 2.6 : 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    p.setAttribute('transform', 'translate(-12 -12)');
    return { n, g };
  });
  Bs.cursorLayer = H('div', {}, Bs.cam, { position: 'absolute', inset: 0 });
  Bs.cursor = makeCursor(Bs.cursorLayer);
}

function seekB(b) {
  const on = b >= 16 && b < 26.6;
  vis(Bs.root, on);
  if (!on) return;
  // studio camera: push in on the toolbar and slider, back out for the ball
  const cam = chainN(b, [720, 720, 1], [[19.3, [720, 960, 1.5], 1.5, 0.9], [24.4, [720, 720, 1], 1.6, 0.92]]);
  Bs.cam.style.transform = `translate(${720 - cam[0] * cam[2]}px, ${720 - cam[1] * cam[2]}px) scale(${cam[2]})`;
  // golden hour follows the slider knob
  const drag = ramp(b, 22.2, 23.6, ease.io);
  sa(Bs.gold, { opacity: drag });

  // 1. glass letters, one per half-beat, out of a mask line
  const lettersOn = b < 18.05;
  Bs.letters.forEach((L, i) => {
    vis(L.g, lettersOn);
    if (!lettersOn) return;
    const r = spr(b, 16.5 + i * 0.25, 2.6, 0.7);
    L.gl.set(L.x, Bs.base + (1 - r) * L.a.gh * 1.05, r > 0.001 ? 1 : 0, 70);
  });

  // 2. goo: letters melt into a drop; the drop stretches into the toolbar
  const gooOn = b >= 18.05 && b < 19.75;
  vis(Bs.gooGlass, gooOn);
  vis(Bs.gooRim, gooOn);
  const sd = 0.4 + 15 * ramp(b, 18.05, 18.5) - 15 * ramp(b, 19.15, 19.7);
  sa(Bs.gooBlur, { stdDeviation: sd });
  sa(Bs.rimBlur, { stdDeviation: sd });
  const melt = ramp(b, 18.05, 18.95, ease.in);
  Bs.gooLetters.forEach((t, i) => {
    const L = Bs.letters[i];
    const s = 1 - melt;
    const cx = L.x + L.a.adv / 2;
    const x = lerp(cx, 720, ramp(b, 18.05, 18.95, ease.io)) - (L.a.adv * s) / 2;
    vis(t, s > 0.02);
    t.style.fontSize = `${300 * Math.max(s, 0.02)}px`;
    sa(t, { x, y: lerp(Bs.base, 700 + 60 * s, 1 - s) });
  });
  const rd = 118 * spr(b, 18.3, 2.2, 0.68);
  const dropR = chainN(b, [720 - rd, 700 - rd, 2 * rd, 2 * rd], [[19, TOOLBAR, 2.0, 0.62]]);
  // before beat 19 the drop is a growing circle at the centre
  const dr = b < 19 ? [720 - rd, 700 - rd, 2 * rd, 2 * rd] : chainN(b, [720 - 118, 700 - 118, 236, 236], [[19, TOOLBAR, 2.0, 0.62]]);
  void dropR;
  sa(Bs.drop, { x: dr[0], y: dr[1], width: Math.max(0, dr[2]), height: Math.max(0, dr[3]), rx: Math.min(dr[2], dr[3]) / 2 });
  if (gooOn) {
    const bx = b < 18.6 ? [280, 470, 880, 330] : dr;
    Bs.gooDf.set(bx[0], bx[1], bx[2], bx[3], rrMap(bx[2], bx[3], Math.min(bx[2], bx[3]) / 2), 48, 60);
  }

  // 3. the glass pill: toolbar → slider → knob → lens → ball → flood
  const pillOn = b >= 19.75;
  let p = chainN(b, [720 - 118, 700 - 118, 236, 236], [
    [19, TOOLBAR, 2.0, 0.62],
    [21.25, SLIDER, 2.4, 0.8],
  ]);
  const knobX = lerp(KNOB_X0, KNOB_X1, drag);
  if (b >= 24) {
    p = chainN(b, SLIDER, [
      [24, [KNOB_X1 - 52, KNOB_Y - 52, 104, 104], 2.6, 0.8],
      [24.3, [KNOB_X1 - 150, KNOB_Y - 150, 300, 300], 2.2, 0.66],
      [25, [BALL.x - 300, BALL.y - 300, 600, 600], 1.9, 0.78],
    ]);
  }
  let rad = Math.min(p[2], p[3]) / 2;
  if (b >= 26) {
    // the ball floods the frame (past the corners) in 0.3 s
    const R0 = 300, R1 = 1150;
    const rr = lerp(R0, R1, ramp(b, 26, 26.6, ease.in));
    p = [BALL.x - rr, BALL.y - rr, rr * 2, rr * 2];
    rad = rr;
  }
  if (pillOn) {
    const mag = 1 + 0.32 * ramp(b, 24.2, 24.8) - 0.32 * ramp(b, 25, 25.6);
    Bs.pill.set(p[0], p[1], p[2], p[3], rad, { mag, scale: b >= 24.2 ? Math.min(90, rad * 0.5) : undefined });
  } else Bs.pill.hide();

  // burj photo opens inside the ball as a circle from its centre
  const ballOn = b >= 25.5;
  vis(Bs.ballImg, ballOn);
  vis(Bs.ballRim, ballOn && b < 26.6);
  if (ballOn) {
    const cx = p[0] + p[2] / 2, cy = p[1] + p[3] / 2;
    const rIn = (rad - 6) * Math.min(1, spr(b, 25.5, 2.4, 0.9));
    sa(Bs.ballClipC, { cx, cy, r: Math.max(0, rIn) });
    sa(Bs.ballRim, { cx, cy, r: Math.max(0, rIn) });
  }

  // toolbar icons
  const iconsOn = b >= 19.75 && b < 21.4;
  Bs.icons.forEach((ic, i) => {
    vis(ic.g, iconsOn);
    if (!iconsOn) return;
    const s = Math.max(0, spr(b, 19.75 + i * 0.12, 3, 0.6) * (1 - ramp(b, 21.05, 21.35, ease.in)));
    const x = p[0] + p[2] * (0.12 + i * 0.19), y = p[1] + p[3] / 2;
    ic.g.setAttribute('transform', `translate(${x} ${y}) scale(${(s * (ic.n === 'plus' ? 1.5 : 1.9)).toFixed(3)})`);
  });

  // slider track: drawn across, then retracted into the knob
  const trackOn = b >= 21.3 && b < 24.4;
  vis(Bs.track, trackOn);
  if (trackOn) {
    const len = ramp(b, 21.3, 21.8, ease.out);
    const ret = ramp(b, 24, 24.35, ease.in);
    const x1 = lerp(KNOB_X0, KNOB_X1, len);
    sa(Bs.track, { x1: lerp(KNOB_X0, knobX, ret), y1: KNOB_Y, x2: lerp(x1, knobX, ret), y2: KNOB_Y });
  }
  const knobOn = b >= 21.5 && b < 24.15;
  if (knobOn) {
    const kr = 46 * spr(b, 21.5, 3, 0.62);
    Bs.knob.set(knobX - kr, KNOB_Y - kr, kr * 2, kr * 2, kr);
  } else Bs.knob.hide();

  // cursor: tap the sliders icon, drag the knob, hold it, then let go
  const icX = TOOLBAR[0] + TOOLBAR[2] * (0.12 + 4 * 0.19), icY = TOOLBAR[1] + TOOLBAR[3] / 2;
  let cx, cy;
  if (b < 22.2) ({ x: cx, y: cy } = cursorPath(b, [[0, 1600, 1500], [20, icX + 6, icY + 8], [21.3, KNOB_X0 + 8, KNOB_Y + 10]], 2.2, 0.85));
  else if (b < 24.6) { cx = knobX + 8; cy = KNOB_Y + 10; }
  else ({ x: cx, y: cy } = cursorPath(b, [[0, KNOB_X1 + 8, KNOB_Y + 10], [24.6, 1560, 1520]], 2.0, 0.9));
  const down = Math.max(press(b, 21), b >= 22 && b < 24.6 ? Math.min(1, (b - 22) / 0.1) : 0);
  const hold = b >= 23.7 && b < 24.6 ? ramp(b, 23.7, 24.3, ease.lin) : 0;
  Bs.cursor.set(cx, cy, 1.25, down, hold, b >= 20 && b < 25.4);
}
