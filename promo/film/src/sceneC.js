/* Scene C: lock screen → phone → Dynamic Island → Mac window → drag the
   wallpaper into Safari → landing page → activity card → Join → the black
   shape: Joined → Going % → On your way → You're there → flood. */
'use strict';
const C = {};
const SCR = { x: 30, y: 5, w: 660, h: 1430, r: 96 };
const WIN = { x: 860, y: 260, w: 1160, h: 800, bar: 56 };
const PAGE = { x: WIN.x, y: WIN.y + WIN.bar, w: WIN.w, h: WIN.h - WIN.bar };
const pw = (x, y) => ({ x: PAGE.x + x, y: PAGE.y + y }); // page → world
const CARD = [60, 96, 1040, 548];
const PHOTO = [84, 120, 500, 500];
const HERO = [40, 110, 1080, 560];
const JOIN = [624, 548, 300, 68];
const NAVBTN = [978, 22, 142, 50];
const SW = [672, 732, 792, 852].map((x) => ({ x, y: 404 }));
const SWC = ['#0B0B0C', '#FF6B4A', '#22A699', '#3D7BFF'];
const CHIPS = [624, 702, 780].map((x) => ({ x, y: 474, w: 64, h: 48 }));
const SHAPE_C = pw(JOIN[0] + JOIN[2] / 2, JOIN[1] + JOIN[3] / 2); // order shape centre (world)

function buildC(stage) {
  C.root = H('div', { class: 'scene' }, stage);
  C.cam = H('div', {}, C.root, { position: 'absolute', left: 0, top: 0, width: '2200px', height: '1500px', transformOrigin: '0 0' });
  // phone body (bezel grows out of the screen edge)
  C.body = H('div', {}, C.cam, { position: 'absolute', background: '#161618', boxShadow: 'inset 0 0 0 2px #3A3A3F, 0 40px 80px rgba(40,30,20,0.18)' });
  // phone screen + lock screen, in SVG for the glass
  C.svg = S('svg', { width: 2200, height: 1500, viewBox: '0 0 2200 1500' }, C.cam);
  C.svg.style.position = 'absolute';
  const sc = S('clipPath', { id: 'scrClip' }, DEFS);
  C.scrClipR = S('rect', { x: SCR.x, y: SCR.y, width: SCR.w, height: SCR.h, rx: SCR.r }, sc);
  const screen = S('g', { 'clip-path': 'url(#scrClip)' }, C.svg);
  const bd = S('g', { id: 'bdC' }, screen);
  const k = SCR.h / IMG.burjKhalifa.h;
  S('image', { href: IMG.burjKhalifa.url, x: SCR.x + SCR.w / 2 - (IMG.burjKhalifa.w * k) / 2, y: SCR.y, width: IMG.burjKhalifa.w * k, height: SCR.h, preserveAspectRatio: 'none' }, bd);
  // date
  const dc = S('clipPath', { id: 'dateClip' }, DEFS);
  S('rect', { x: 0, y: 0, width: 2200, height: 482 }, dc);
  const dg = S('g', { 'clip-path': 'url(#dateClip)' }, screen);
  C.date = S('text', { text: 'Tuesday 6 October', 'text-anchor': 'middle', fill: '#FFFFFF', x: 360 }, dg);
  st(C.date, { font: '600 30px Geist', letterSpacing: '0.01em' });
  // glass clock
  const font = { family: 'Archivo', weight: 700, stretch: 'normal' };
  C.clock = [...'9:41'].map((ch) => glyphAssets(ch, font, 200));
  const tw = C.clock.reduce((s, a) => s + a.adv, 0);
  let x = 360 - tw / 2;
  C.clockG = C.clock.map((a) => {
    const gg = S('g', {}, screen);
    const cid = `cc${maskN++}`;
    const cp = S('clipPath', { id: cid }, DEFS);
    S('rect', { x: 0, y: 0, width: 2200, height: 648 }, cp);
    gg.setAttribute('clip-path', `url(#${cid})`);
    const L = { a, x, gl: glyphGlass(gg, 'bdC', a) };
    x += a.adv;
    return L;
  });
  // home bar → glass live activity
  C.player = glassRR(screen, 'bdC', { tint: 'rgba(20,20,22,0.22)' });
  C.core = S('rect', { fill: '#FFFFFF' }, screen);
  const pc = S('clipPath', { id: 'playClip' }, DEFS);
  C.playClipR = S('rect', {}, pc);
  C.pc = S('g', { 'clip-path': 'url(#playClip)' }, screen);
  const tc = S('clipPath', { id: 'thumbClip' }, DEFS);
  C.thumbClipR = S('rect', { rx: 22 }, tc);
  const tcv = cover('tableTennis', 0, 0, 100, 100);
  C.thumb = S('image', { href: IMG.tableTennis.url, preserveAspectRatio: 'none', 'clip-path': 'url(#thumbClip)' }, C.pc);
  C.thumbBox = tcv;
  C.pTitle = S('text', { text: 'Padel tonight · JBR', fill: '#FFFFFF' }, C.pc);
  st(C.pTitle, { font: '600 30px Geist' });
  C.pSub = S('text', { text: '19:30 · 3 of 8 going', fill: 'rgba(255,255,255,0.78)' }, C.pc);
  st(C.pSub, { font: '500 23px Geist' });
  C.pTrack = S('rect', { fill: 'rgba(255,255,255,0.28)', rx: 4, height: 8 }, C.pc);
  C.pFill = S('rect', { fill: '#FFFFFF', rx: 4, height: 8 }, C.pc);

  // Dynamic Island + the blob that flies to the Mac (goo)
  const goo = S('filter', { id: 'gooC', filterUnits: 'userSpaceOnUse', x: -100, y: -200, width: 2400, height: 1800 }, DEFS);
  C.gooBlur = S('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 0.5, result: 'bl' }, goo);
  S('feColorMatrix', { in: 'bl', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12', result: 'g' }, goo);
  S('feComposite', { in: 'SourceGraphic', in2: 'g', operator: 'atop', result: 'top' }, goo);
  const fm = S('feMerge', {}, goo);
  S('feMergeNode', { in: 'g' }, fm);
  S('feMergeNode', { in: 'top' }, fm);
  C.goo = S('g', { filter: 'url(#gooC)' }, C.svg);
  C.island = S('rect', { fill: '#050506' }, C.goo);
  C.blob = S('rect', { fill: '#050506' }, C.goo);

  // Mac window (Safari, dark chrome)
  C.win = H('div', {}, C.cam, { position: 'absolute', left: `${WIN.x}px`, top: `${WIN.y}px`, width: `${WIN.w}px`, height: `${WIN.h}px`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 50px 100px rgba(40,30,20,0.22)' });
  C.bar = H('div', {}, C.win, { position: 'absolute', left: 0, top: 0, right: 0, height: `${WIN.bar}px`, background: '#0B0B0C' });
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => H('div', {}, C.bar, { position: 'absolute', left: `${22 + i * 22}px`, top: '22px', width: '13px', height: '13px', borderRadius: '50%', background: c }));
  C.tab1 = H('div', { text: 'Start Page' }, C.bar, { position: 'absolute', left: '110px', top: '11px', width: '260px', height: '34px', borderRadius: '9px', background: '#26262A', color: '#E8E8EA', font: '500 15px Geist', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  C.tab2 = H('div', { text: 'New Tab' }, C.bar, { position: 'absolute', left: '382px', top: '11px', width: '260px', height: '34px', borderRadius: '9px', color: '#A0A0A6', font: '500 15px Geist', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: '1.5px solid transparent' });
  H('div', { text: '+' }, C.bar, { position: 'absolute', left: '656px', top: '10px', color: '#A0A0A6', font: '400 26px Geist' });
  C.pageWrap = H('div', {}, C.win, { position: 'absolute', left: 0, top: `${WIN.bar}px`, width: `${PAGE.w}px`, height: `${PAGE.h}px`, overflow: 'hidden', background: '#F7F5F0' });
  C.roll = H('div', {}, C.win, { position: 'absolute', left: 0, width: '100%', height: '14px', background: 'linear-gradient(#2A2A2E, #0B0B0C 45%, #3A3A3F)', borderRadius: '7px' });
  // start page
  C.start = H('div', {}, C.pageWrap, { position: 'absolute', inset: 0 });
  H('div', { text: 'Favourites' }, C.start, { position: 'absolute', left: '150px', top: '120px', font: '700 26px Geist', color: '#0B0B0C' });
  for (let i = 0; i < 8; i++) H('div', {}, C.start, { position: 'absolute', left: `${150 + (i % 4) * 230}px`, top: `${180 + Math.floor(i / 4) * 200}px`, width: '170px', height: '150px', borderRadius: '22px', background: '#E7E3DA' });
  // landing page
  C.land = H('div', {}, C.pageWrap, { position: 'absolute', inset: 0 });
  const wm = H('div', { text: 'IRLY' }, C.land, { position: 'absolute', left: '40px', top: '26px', font: '800 34px Archivo', fontStretch: '125%', color: '#0B0B0C', letterSpacing: '-0.01em' });
  void wm;
  H('div', { text: 'Activities     Cities     Safety' }, C.land, { position: 'absolute', left: '420px', top: '38px', font: '500 18px Geist', color: '#55555B', whiteSpace: 'pre' });
  // the card (grows out of the photo's edge)
  C.card = H('div', {}, C.land, { position: 'absolute', background: '#FFFFFF', boxShadow: '0 1px 0 #E2DDD3, 0 24px 60px rgba(40,30,20,0.10)', overflow: 'hidden' });
  C.paint = H('div', {}, C.card, { position: 'absolute', inset: 0, background: '#FFE8E1' });
  C.cardBody = H('div', {}, C.land, { position: 'absolute', inset: 0 });
  const t = (txt, x, y, font, color) => maskText(C.cardBody, txt, { font, color, lineHeight: '1.2' });
  C.cTag = t('SOCIAL · DUBAI', 0, 0, '600 15px Geist', '#8A8A90');
  C.cTitle = t('Sunset at the Burj', 0, 0, '700 46px Geist', '#0B0B0C');
  C.cMeta = t('Tonight · 18:30 · Downtown Dubai', 0, 0, '500 22px Geist', '#55555B');
  C.cVibe = t('Category colour', 0, 0, '600 17px Geist', '#0B0B0C');
  C.cSize = t('Group size', 0, 0, '600 17px Geist', '#0B0B0C');
  C.sw = SW.map((p, i) => H('div', {}, C.cardBody, { position: 'absolute', width: '44px', height: '44px', borderRadius: '50%', background: SWC[i], boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 4.5px #D6D1C7' }));
  C.chips = CHIPS.map((c, i) => {
    const el = H('div', {}, C.cardBody, { position: 'absolute', width: `${c.w}px`, height: `${c.h}px`, borderRadius: '24px', boxShadow: 'inset 0 0 0 1.5px #CFCAC0', overflow: 'hidden' });
    const fill = H('div', {}, el, { position: 'absolute', inset: 0, background: '#0B0B0C', borderRadius: '24px' });
    const lab = H('div', { text: String([4, 6, 8][i]) }, el, { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 19px Geist', color: '#0B0B0C' });
    return { el, fill, lab };
  });
  // hero photo (the dragged wallpaper lands here, then becomes the card photo)
  C.hero = H('div', {}, C.cam, { position: 'absolute', overflow: 'hidden', backgroundImage: `url(${IMG.burjKhalifa.url})`, backgroundSize: 'cover', backgroundPosition: '50% 40%' });
  C.headline = maskText(C.hero, 'Find your people.', { font: '700 64px Geist', color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: '74px' });
  C.headline2 = maskText(C.hero, 'In real life.', { font: '700 64px Geist', color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: '74px' });
  // the black shape: nav button → Join → Joined → Going → route → there
  C.shape = H('div', {}, C.cam, { position: 'absolute', background: '#0B0B0C', overflow: 'hidden' });
  const lab = (txt, font = '600 22px Geist') => maskText(C.shape, txt, { font, color: '#FFFFFF' });
  C.sGet = lab('Get IRLY', '600 18px Geist');
  C.sJoin = lab('Join activity');
  C.sJoined = lab('Joined  ✓');
  C.sGoing = lab('3 of 8 going · 38%');
  C.sGoing2 = lab('6 of 8 going · 75%');
  C.sWay = lab('On your way · 4 min', '600 30px Geist');
  C.sThere = lab("You're there", '600 26px Geist');
  C.sFill = H('div', {}, C.shape, { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#2E2E33' });
  C.shape.insertBefore(C.sFill, C.shape.firstChild);
  C.route = S('svg', { width: 620, height: 300, viewBox: '0 0 620 300' }, C.shape);
  C.route.style.position = 'absolute';
  C.routePath = S('path', { d: 'M70 210 C 170 210, 190 120, 300 140 S 450 90, 550 110', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': '1 0' }, C.route);
  C.routeStart = S('circle', { cx: 70, cy: 210, r: 12, fill: '#FFFFFF' }, C.route);
  C.routeEnd = S('g', {}, C.route);
  S('path', { d: ICON.pin, fill: '#FFFFFF', stroke: '#0B0B0C', 'stroke-width': 1.4, transform: 'translate(-24 -44) scale(2)' }, C.routeEnd);
  C.routeCar = S('g', {}, C.route);
  S('circle', { r: 26, fill: '#FFFFFF' }, C.routeCar);
  S('path', { d: ICON.car, fill: 'none', stroke: '#0B0B0C', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: 'translate(-15.6 -17) scale(1.3)' }, C.routeCar);
  C.check = S('svg', { width: 120, height: 120, viewBox: '0 0 24 24' }, C.shape);
  C.check.style.position = 'absolute';
  C.checkP = S('path', { d: ICON.check, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, C.check);
  // dragged wallpaper card
  C.drag = H('div', {}, C.cam, { position: 'absolute', overflow: 'hidden', borderRadius: '26px', backgroundImage: `url(${IMG.burjKhalifa.url})`, backgroundSize: 'cover', backgroundPosition: '50% 40%', boxShadow: '0 30px 60px rgba(20,15,10,0.3)' });
  C.cursor = makeCursor(C.cam);
}

function rect(el, r, radius) {
  st(el, { left: `${r[0]}px`, top: `${r[1]}px`, width: `${Math.max(0, r[2])}px`, height: `${Math.max(0, r[3])}px`, borderRadius: `${radius}px` });
}

function seekC(b) {
  const on = b >= 26.6 && b < 46;
  vis(C.root, on);
  if (!on) return;
  // studio camera
  const cam = chainN(b, [360, 720, 1440 / SCR.w], [
    [28.5, [1013, 720, 0.686], 1.4, 0.9],
    [35, [WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, 1440 / WIN.w], 1.5, 0.9],
    [39.75, [SHAPE_C.x, SHAPE_C.y, 2.0], 1.6, 0.88],
  ]);
  C.cam.style.transform = `translate(${720 - cam[0] * cam[2]}px, ${720 - cam[1] * cam[2]}px) scale(${cam[2]})`;
  const camS = cam[2];

  // bezel grows out of the screen edge
  const bz = 26 * spr(b, 28.7, 2.4, 0.8);
  rect(C.body, [SCR.x - bz, SCR.y - bz, SCR.w + bz * 2, SCR.h + bz * 2], SCR.r + bz);
  vis(C.body, bz > 0.3);

  // lock screen
  const dr = spr(b, 27, 2.4, 0.75);
  sa(C.date, { y: 470 + (1 - dr) * 44 });
  C.clockG.forEach((L, i) => {
    const r = spr(b, 26.7 + i * 0.12, 2.6, 0.7);
    L.gl.set(L.x, 640 + (1 - r) * 170, r > 0.001 ? 1 : 0, 46);
  });
  // home bar stretches into the glass live activity
  const pr = chainN(b, [300, 1004, 120, 9], [[27.5, [60, 840, 600, 152], 2.0, 0.66]]);
  const prr = Math.min(pr[3] / 2, 40);
  C.player.set(pr[0], pr[1], pr[2], pr[3], prr, { scale: 26 });
  const core = 1 - ramp(b, 27.5, 27.85, ease.in);
  sa(C.core, { x: pr[0] + pr[2] / 2 - (60 * core), y: pr[1] + pr[3] / 2 - 4.5 * Math.min(1, core * 2), width: 120 * core, height: 9 * Math.min(1, core * 2), rx: 4.5 });
  vis(C.core, core > 0.01);
  sa(C.playClipR, { x: pr[0], y: pr[1], width: pr[2], height: pr[3], rx: prr });
  const th = 100 * spr(b, 27.9, 3, 0.62);
  sa(C.thumbClipR, { x: pr[0] + 26 + 50 - th / 2, y: pr[1] + 26 + 50 - th / 2, width: th, height: th });
  sa(C.thumb, { x: pr[0] + 26 + C.thumbBox.x, y: pr[1] + 26 + C.thumbBox.y, width: C.thumbBox.w, height: C.thumbBox.h });
  const tr = spr(b, 28, 2.6, 0.75);
  sa(C.pTitle, { x: pr[0] + 150, y: pr[1] + 62 + (1 - tr) * 60 });
  sa(C.pSub, { x: pr[0] + 150, y: pr[1] + 98 + (1 - spr(b, 28.1, 2.6, 0.75)) * 60 });
  const bar = ramp(b, 28.1, 28.6, ease.out);
  sa(C.pTrack, { x: pr[0] + 150, y: pr[1] + 118, width: 410 * bar });
  sa(C.pFill, { x: pr[0] + 150, y: pr[1] + 118, width: 410 * bar * 0.375 });

  // Dynamic Island: appears, stretches like a liquid, pinches, flies to the Mac
  const isOn = b >= 28.8 && b < 31.45;
  vis(C.goo, isOn);
  const iw = chain(b, 0, [[28.8, 190, 3, 0.7], [29.5, 400, 2.2, 0.45], [30, 190, 2.4, 0.6]]);
  const ih = chain(b, 0, [[28.8, 56, 3, 0.7]]);
  sa(C.island, { x: 360 - iw / 2, y: SCR.y + 24, width: Math.max(0, iw), height: Math.max(0, ih), rx: Math.max(0, ih) / 2 });
  sa(C.gooBlur, { stdDeviation: 0.5 + 9 * ramp(b, 29.4, 29.8) - 9 * ramp(b, 30.6, 31.1) });
  // blob: buds off the right end, flies in an arc, becomes the Mac title bar
  const fly = ramp(b, 30.1, 30.9, ease.io);
  const bud = spr(b, 29.9, 2.6, 0.7);
  const sx0 = 360 + 120, sy0 = SCR.y + 24 + 28;
  const tx = WIN.x + 40, ty = WIN.y + 28;
  const bx = lerp(sx0 + 70 * bud, tx, fly), by = lerp(sy0, ty, fly) - Math.sin(fly * Math.PI) * 220;
  const bs = 56 * Math.min(1, bud);
  let br = [bx - bs / 2, by - bs / 2, bs, bs];
  br = b < 30.9 ? br : chainN(b, [tx - 28, ty - 28, 56, 56], [[30.9, [WIN.x, WIN.y, WIN.w, WIN.bar], 2.4, 0.78]]);
  sa(C.blob, { x: br[0], y: br[1], width: Math.max(0, br[2]), height: Math.max(0, br[3]), rx: Math.min(br[3] / 2, b < 30.9 ? 99 : lerp(28, 14, ramp(b, 30.9, 31.3))) });
  vis(C.blob, b >= 29.9);

  // Mac window: chrome after the blob lands; content unrolls like a blind
  const winOn = b >= 31.45;
  vis(C.win, winOn);
  const roll = ramp(b, 31.5, 32.3, ease.out);
  const contentH = PAGE.h * roll;
  st(C.win, { height: `${WIN.bar + contentH}px` });
  st(C.roll, { top: `${WIN.bar + contentH - 7}px` });
  vis(C.roll, roll > 0 && roll < 1);
  // drag: long-press the wallpaper, carry it to the New Tab, the page pushes in
  const tabHover = b >= 34.7 && b < 35.9;
  st(C.tab2, { background: tabHover ? '#3A3A40' : 'transparent', color: tabHover ? '#FFFFFF' : '#A0A0A6', borderColor: tabHover ? '#6A6A72' : 'transparent' });
  const push = spr(b, 35, 2.2, 0.86);
  st(C.start, { transform: `translateX(${-PAGE.w * 0.35 * push}px)` });
  st(C.land, { transform: `translateX(${PAGE.w * (1 - push)}px)` });
  vis(C.start, push < 0.999);
  vis(C.land, b >= 35);

  // cursor
  const tab = { x: WIN.x + 382 + 130, y: WIN.y + 28 };
  const swc = pw(SW[1].x + 22, SW[1].y + 22), ch6 = pw(CHIPS[1].x + 32, CHIPS[1].y + 24), jn = pw(JOIN[0] + JOIN[2] / 2, JOIN[1] + JOIN[3] / 2);
  const cur = cursorPath(b, [[0, 2150, 1300], [32, 360, 330], [34, tab.x, tab.y + 6], [36.9, swc.x + 4, swc.y + 6], [38, ch6.x + 4, ch6.y + 6], [38.9, jn.x + 10, jn.y + 10], [40, jn.x + 260, jn.y + 230]], 2.0, 0.86);
  const hold = b >= 33 && b < 33.7 ? ramp(b, 33, 33.6, ease.lin) : 0;
  const down = Math.max(b >= 33 && b < 35.75 ? 1 : 0, press(b, 37.75), press(b, 38.25), press(b, 39.5));
  C.cursor.set(cur.x, cur.y, 1.35, down, hold, b >= 32 && b < 40.2);

  // dragged card: springs from zero under the cursor, follows, lands as the hero
  const lift = spr(b, 33.6, 2.8, 0.66);
  const fx = chain(b, 360, [[34, tab.x, 2.0, 0.8]]), fy = chain(b, 330, [[34, tab.y + 6, 2.0, 0.8]]);
  const heroW = [pw(HERO[0], HERO[1]).x, pw(HERO[0], HERO[1]).y, HERO[2], HERO[3]];
  let dc = [fx - 110 * lift, fy - 30 * lift, 220 * lift, 330 * lift];
  if (b >= 35.75) dc = chainN(b, [tab.x - 110, tab.y - 24, 220, 330], [[35.75, heroW, 2.2, 0.8]]);
  const photoW = [pw(PHOTO[0], PHOTO[1]).x, pw(PHOTO[0], PHOTO[1]).y, PHOTO[2], PHOTO[3]];
  if (b >= 36.5) dc = chainN(b, heroW, [[36.5, photoW, 2.0, 0.8]]);
  const dragOn = b >= 33.6;
  vis(C.drag, dragOn && b < 35.75);
  vis(C.hero, b >= 35.75);
  if (dragOn) {
    const rr = b < 35.75 ? 26 : lerp(26, 22, ramp(b, 35.75, 36.2));
    rect(b < 35.75 ? C.drag : C.hero, dc, rr);
  }
  // headline on the hero
  const hl = b < 36.4 ? spr(b, 36.05, 2.4, 0.75) : 1 + ramp(b, 36.4, 36.7, ease.in);
  C.headline.set(48, dc[3] - 150, hl, 'left');
  C.headline2.set(48, dc[3] - 78, b < 36.4 ? spr(b, 36.15, 2.4, 0.75) : hl, 'left');

  // card: frame and mat grow out of the photo's edge
  const cardOn = b >= 36.5;
  vis(C.card, cardOn);
  vis(C.cardBody, cardOn);
  if (cardOn) {
    const cr = chainN(b, PHOTO, [[36.6, CARD, 2.0, 0.78]]);
    rect(C.card, cr, 30);
    // colour paints across from the swatch
    const pr2 = 1500 * ramp(b, 37.75, 38.2, ease.out);
    const sx = SW[1].x + 22 - cr[0], sy = SW[1].y + 22 - cr[1];
    st(C.paint, { clipPath: `circle(${pr2}px at ${sx}px ${sy}px)` });
    const r = (bb) => spr(b, bb, 2.6, 0.75);
    C.cTag.set(624, 150, r(36.75), 'left');
    C.cTitle.set(624, 200, r(36.85), 'left');
    C.cMeta.set(624, 256, r(36.95), 'left');
    C.cVibe.set(624, 360, r(37.05), 'left');
    C.cSize.set(624, 450, r(37.15), 'left');
    C.sw.forEach((el, i) => {
      const s = spr(b, 37.1 + i * 0.07, 3, 0.6);
      rect(el, [SW[i].x, SW[i].y, 44, 44], 22);
      el.style.transform = `scale(${s.toFixed(3)})`;
    });
    C.chips.forEach((c, i) => {
      const s = spr(b, 37.2 + i * 0.07, 3, 0.6);
      rect(c.el, [CHIPS[i].x, CHIPS[i].y, CHIPS[i].w, CHIPS[i].h], 24);
      c.el.style.transform = `scale(${s.toFixed(3)})`;
      const sel = i === 1 ? ramp(b, 38.25, 38.5, ease.out) : 0;
      st(c.fill, { clipPath: `circle(${sel * 60}px at 50% 50%)` });
      c.lab.style.color = sel > 0.5 ? '#FFFFFF' : '#0B0B0C';
    });
  }

  // the black shape
  const shapeOn = b >= 35;
  vis(C.shape, shapeOn);
  if (shapeOn) {
    const nav = [pw(NAVBTN[0], NAVBTN[1]).x, pw(NAVBTN[0], NAVBTN[1]).y, NAVBTN[2], NAVBTN[3]];
    const push2 = PAGE.w * (1 - push);
    const join = [pw(JOIN[0], JOIN[1]).x, pw(JOIN[0], JOIN[1]).y, JOIN[2], JOIN[3]];
    const cx = SHAPE_C.x, cy = SHAPE_C.y;
    let g;
    if (b < 38.75) g = [nav[0] + push2, nav[1], nav[2], nav[3], 25];
    else {
      // flies down in an arc and becomes the Join button
      const f = ramp(b, 38.75, 39.25, ease.io);
      const arc = Math.sin(f * Math.PI) * 90;
      g = [lerp(nav[0], join[0], f) + arc, lerp(nav[1], join[1], f), lerp(nav[2], join[2], f), lerp(nav[3], join[3], f), lerp(25, 34, f)];
      g = chainN(b, g, [
        [39.75, [cx - 160, cy - 34, 320, 68, 34], 2.6, 0.7],
        [40.5, [cx - 280, cy - 40, 560, 80, 40], 2.4, 0.72],
        [42, [cx - 310, cy - 150, 620, 300, 46], 2.2, 0.74],
        [44.25, [cx - 120, cy - 120, 240, 240, 120], 2.4, 0.7],
      ]);
      if (b >= 45.4) {
        const rr = lerp(120, 900, ramp(b, 45.4, 46, ease.in));
        g = [cx - rr, cy - rr, rr * 2, rr * 2, rr];
      }
    }
    rect(C.shape, g, g[4]);
    const w = g[2], h = g[3];
    // label swaps, each in its own mask
    const swap = (inB, outB) => (b < inB ? 0 : b < outB ? Math.min(1, spr(b, inB, 2.8, 0.78)) : 1 + ramp(b, outB, outB + 0.25, ease.in));
    const place = (m, v, y = h / 2) => m.set(w / 2, y, v);
    place(C.sGet, b < 38.75 ? 1 : 1 + ramp(b, 38.75, 39, ease.in));
    place(C.sJoin, swap(39.05, 39.75));
    place(C.sJoined, swap(39.85, 40.5));
    place(C.sGoing, swap(40.6, 41.25));
    place(C.sGoing2, swap(41.3, 42));
    place(C.sWay, swap(42.15, 44.25), 62);
    place(C.sThere, swap(44.45, 45.05), h / 2 + 62);
    // progress fill paints across
    const p1 = ramp(b, 40.6, 41.0, ease.out) * 0.375 + ramp(b, 41.3, 41.7, ease.out) * 0.375;
    const fillOn = b >= 40.5 && b < 42;
    vis(C.sFill, fillOn);
    st(C.sFill, { width: `${w * p1}px` });
    // route: drawn across, the car drives it
    const routeOn = b >= 42.1 && b < 44.3;
    vis(C.route, routeOn);
    if (routeOn) {
      st(C.route, { left: `${(w - 620) / 2}px`, top: `${(h - 300) / 2 + 20}px` });
      const L = C.routePath.getTotalLength();
      const d = ramp(b, 42.2, 42.75, ease.out);
      sa(C.routePath, { 'stroke-dasharray': `${L * d} ${L}` });
      sa(C.routeStart, { r: 12 * spr(b, 42.15, 3, 0.6) });
      C.routeEnd.setAttribute('transform', `translate(550 110) scale(${spr(b, 42.7, 3, 0.6).toFixed(3)})`);
      const pt = C.routePath.getPointAtLength(L * ramp(b, 42.8, 44.1, ease.io));
      C.routeCar.setAttribute('transform', `translate(${pt.x} ${pt.y}) scale(${spr(b, 42.75, 3, 0.62).toFixed(3)})`);
    }
    const chkOn = b >= 44.4;
    vis(C.check, chkOn);
    if (chkOn) {
      st(C.check, { left: `${w / 2 - 60}px`, top: `${h / 2 - 84}px` });
      const L = 22;
      const out = ramp(b, 45.0, 45.3, ease.in);
      sa(C.checkP, { 'stroke-dasharray': `${L * ramp(b, 44.45, 44.8, ease.out) * (1 - out)} ${L}`, 'stroke-dashoffset': -L * out });
    }
    void camS;
  }
}
