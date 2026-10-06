/* Scene A: wordmark → dot → pill → iris → photo → paper grid → bento → zoom.
   Also the return: black frame → pill → dot → letters. */
'use strict';
const A = {};
const TILE = 300, GAP = 16, G0 = 720 - TILE * 1.5 - GAP;
const gx = (c) => G0 + c * (TILE + GAP);
// [photo, grid col,row, unfold-from, bento rect, regroup beat]
const TILES = [
  ['jbr', 0, 1, 'right', [80, 80, 440, 440], 10.5],
  ['islands', 1, 0, 'bottom', [960, 80, 400, 400], 10.5],
  ['sailing', 1, 2, 'top', [540, 960, 400, 400], 11.5],
  ['kitesurf', 2, 1, 'left', [960, 500, 400, 440], 11],
  ['concert', 0, 0, 'right', [80, 540, 440, 400], 11],
  ['tableTennis', 0, 2, 'right', [80, 960, 440, 400], 11],
  ['climbing', 2, 0, 'left', [960, 960, 190, 400], 11.5],
  ['dhow', 2, 2, 'left', [1170, 960, 190, 400], 11.5],
];
const FESTIVAL_BENTO = [540, 80, 400, 860];
const ZOOM = { x: 300, y: 300, s: W / 440 };

function buildA(stage) {
  A.root = H('div', { class: 'scene' }, stage);
  A.cam = H('div', {}, A.root, { position: 'absolute', left: 0, top: 0, width: `${W}px`, height: `${W}px`, transformOrigin: '0 0' });
  // tiles
  A.tiles = TILES.map(([key, c, r, from, bento, beat]) => {
    const el = H('div', {}, A.cam, { position: 'absolute', overflow: 'hidden', backgroundImage: `url(${IMG[key].url})`, backgroundSize: 'cover', backgroundPosition: 'center' });
    const shade = H('div', {}, el, { position: 'absolute', inset: 0, background: '#0B0B0C' });
    return { key, el, shade, grid: [gx(c), gx(r), TILE, TILE], from, bento, beat, unfold: ['top', 'bottom'].includes(from) || [1].includes(c) ? (r === 1 ? 9 : 8.75) : 0 };
  });
  // unfold beats: plus first, corners after
  A.tiles.forEach((t) => {
    const [, c, r] = TILES.find((x) => x[0] === t.key);
    t.unfold = c === 1 || r === 1 ? 8.75 : 9.5;
  });
  // wordmark
  A.svg = S('svg', { width: W, height: W, viewBox: `0 0 ${W} ${W}` }, A.cam);
  A.svg.style.position = 'absolute';
  A.svg.style.left = '0'; A.svg.style.top = '0';
  A.svg.style.overflow = 'visible';
  const F = 250;
  A.F = F;
  A.letters = [...'IRLY'].map((ch) => {
    const t = S('text', { text: ch, fill: '#0B0B0C' }, A.svg);
    st(t, { fontFamily: 'Archivo', fontWeight: 800, fontSize: `${F}px` });
    return { ch, t };
  });
  const widthAt = (el, stretch) => { el.style.fontStretch = `${stretch}%`; return el.getComputedTextLength(); };
  A.letters.forEach((L) => { L.w62 = widthAt(L.t, 62); L.w125 = widthAt(L.t, 125); });
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = `800 ${F}px Archivo`;
  const capH = cv.measureText('I').actualBoundingBoxAscent;
  A.D0 = Math.round(F * 0.25);
  A.gap = F * 0.035;
  const total = A.letters.reduce((s, L) => s + L.w125, 0) + A.gap + A.D0;
  let x = W / 2 - total / 2;
  A.letters.forEach((L) => { L.x0 = x; x += L.w125; });
  A.anchor = x; // right edge of the Y
  A.base = W / 2 + capH / 2;
  A.dot = { x: x + A.gap + A.D0 / 2, y: A.base - A.D0 / 2 };
  // the blob: dot → pill → circle → square → festival tile
  A.blob = H('div', {}, A.cam, { position: 'absolute', overflow: 'hidden', background: '#0B0B0C' });
  A.photo = H('div', {}, A.blob, { position: 'absolute', inset: 0, backgroundImage: `url(${IMG.festival.url})`, backgroundSize: 'cover', backgroundPosition: 'center' });
  A.label = maskText(A.blob, 'Meet people. In real life.', { font: '600 44px Geist', color: '#FFFFFF', letterSpacing: '-0.01em', lineHeight: '56px' });
  A.iris = S('svg', {}, A.blob);
  A.iris.style.position = 'absolute'; A.iris.style.left = '0'; A.iris.style.top = '0';
  A.irisPath = S('path', { fill: '#232326', stroke: '#55555B', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, A.iris);
  A.cursor = makeCursor(A.cam);
}

function wordmarkK(b) {
  if (b < 16) return 1 - ramp(b, 0, 1.55, ease.in);
  return spr(b, 53, 2.7, 0.74);
}

function seekA(b) {
  const ret = b >= 51.5;
  vis(A.root, b < 16 || ret);
  if (!(b < 16 || ret)) return;
  // camera (zoom into the JBR tile, landing on the drop at beat 16)
  let cx = 720, cy = 720, s = 1;
  if (!ret && b > 14) {
    const e = ramp(b, 14, 16, ease.io);
    s = Math.exp(e * Math.log(ZOOM.s));
    const sx = lerp(ZOOM.x, 720, e), sy = lerp(ZOOM.y, 720, e);
    cx = ZOOM.x - (sx - 720) / s;
    cy = ZOOM.y - (sy - 720) / s;
  }
  A.cam.style.transform = `translate(${720 - cx * s}px, ${720 - cy * s}px) scale(${s})`;

  // wordmark: accordion into its own dot
  const k = wordmarkK(b);
  A.letters.forEach((L) => {
    const on = k > 0.003;
    vis(L.t, on);
    if (!on) return;
    const x = A.anchor - k * (A.anchor - L.x0);
    const tw = k * L.w125;
    let stretch = 62, sx = tw / L.w62;
    if (tw >= L.w62) {
      stretch = clamp(62 + 63 * (tw - L.w62) / (L.w125 - L.w62), 62, 125);
      const wAt = L.w62 + (L.w125 - L.w62) * (stretch - 62) / 63;
      sx = tw / wAt;
    }
    L.t.style.fontStretch = `${stretch.toFixed(2)}%`;
    sa(L.t, { x: 0, y: 0, transform: `translate(${x.toFixed(2)} ${A.base}) scale(${sx.toFixed(4)} 1)` });
  });

  // blob geometry
  const D0 = A.D0;
  let g;
  if (!ret) {
    g = chainN(b, [A.dot.x, A.dot.y, D0, D0, D0 / 2], [
      [1.4, [720, 720, D0 * 1.12, D0 * 1.12, D0 * 0.56], 2.6, 0.8],
      [2, [720, 720, 660, 150, 75], 2.0, 0.62],
      [5, [720, 720, 600, 600, 300], 2.3, 0.78],
      [7, [720, 720, 600, 600, 28], 2.6, 0.85],
      [7.5, [720, 720, TILE, TILE, 28], 2.4, 0.8],
      [10.5, [FESTIVAL_BENTO[0] + FESTIVAL_BENTO[2] / 2, FESTIVAL_BENTO[1] + FESTIVAL_BENTO[3] / 2, FESTIVAL_BENTO[2], FESTIVAL_BENTO[3], 28], 2.0, 0.78],
    ]);
  } else {
    g = chainN(b, [720, 720, W, W, 0], [
      [52, [720, 720, 660, 150, 75], 2.2, 0.72],
      [52.5, [A.dot.x, A.dot.y, D0, D0, D0 / 2], 2.6, 0.86],
    ]);
  }
  const [bx, by, bw, bh] = g;
  const br = Math.min(g[4], bw / 2, bh / 2);
  st(A.blob, { left: `${bx - bw / 2}px`, top: `${by - bh / 2}px`, width: `${bw}px`, height: `${bh}px`, borderRadius: `${Math.max(0, br)}px` });
  // photo inside the blob only after the iris has closed
  vis(A.photo, !ret && b >= 6.5);
  // label rises out of a mask line inside the pill
  const rise = !ret && b < 6.5 ? spr(b, 3, 2.4, 0.75) : 0;
  A.label.set(bw / 2, bh / 2, rise);
  // iris
  const R = Math.hypot(bw, bh) / 2 + 2;
  let a = R;
  if (!ret && b >= 5 && b < 6.5) a = R * (1 - ramp(b, 5, 6, ease.io));
  else if (!ret && b >= 6.5 && b < 8) a = R * spr(b, 6.5, 3.4, 0.92);
  const rot = (1 - clamp(a / R)) * Math.PI / 3;
  sa(A.iris, { width: bw, height: bh, viewBox: `0 0 ${bw} ${bh}` });
  sa(A.irisPath, { d: irisPath(bw / 2, bh / 2, a, R, rot + Math.PI / 6) });

  // grid tiles: unfold like a paper map, then regroup as a bento
  A.tiles.forEach((t) => {
    const on = !ret && b >= t.unfold;
    vis(t.el, on);
    if (!on) return;
    const u = Math.min(1.015, spr(b, t.unfold, 2.3, 0.72));
    const rc = chainN(b, t.grid, [[t.beat, t.bento, 2.0, 0.78]]);
    const zoomR = t.key === 'jbr' ? 28 * (1 - ramp(b, 14, 16, ease.io)) : 28;
    const origin = { top: 'top', bottom: 'bottom', left: 'left', right: 'right' }[t.from];
    const sc = ['top', 'bottom'].includes(t.from) ? `scale(1, ${u})` : `scale(${u}, 1)`;
    // a tile unfolding from the tile beside it hinges on the shared edge
    const hinge = { top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' }[t.from];
    st(t.el, { left: `${rc[0]}px`, top: `${rc[1]}px`, width: `${rc[2]}px`, height: `${rc[3]}px`, borderRadius: `${zoomR}px`, transform: sc, transformOrigin: hinge });
    t.shade.style.opacity = (0.4 * (1 - clamp(u))).toFixed(3);
    void origin;
  });

  // cursor: in at 12, click the JBR tile at 13.5, slide away during the zoom
  const c = cursorPath(b, [[0, 1620, 1660], [12, 312, 318], [14, 600, 640]], 1.9, 0.86);
  A.cursor.set(c.x, c.y, 1.25, press(b, 13.5), 0, !ret && b >= 12 && b < 16);
}
