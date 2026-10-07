/* Scene E (the breakdown): black holds a beat, shrinks into a framed photo
   on a wall with moving plant shadows; the iris opens on it and closes; the
   frame fills the screen again. */
'use strict';
const E = {};
const FR = [458, 300, 524, 660]; // frame on the wall

function buildE(stage) {
  E.root = H('div', { class: 'scene' }, stage);
  E.cam = H('div', {}, E.root, { position: 'absolute', left: 0, top: 0, width: `${W}px`, height: `${W}px`, transformOrigin: '0 0' });
  // wall: warm plaster lit from the upper left
  E.wall = H('div', {}, E.cam, { position: 'absolute', inset: '-200px', background: 'radial-gradient(120% 90% at 18% 10%, #F4EEE4 0%, #E9E0D1 55%, #DCD1BF 100%)' });
  // the print
  E.frame = H('div', {}, E.cam, { position: 'absolute', background: '#0B0B0C', boxShadow: '0 30px 50px rgba(60,40,20,0.22), 0 6px 12px rgba(60,40,20,0.18)' });
  E.mat = H('div', {}, E.frame, { position: 'absolute', background: '#F6F3EC', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.18)' });
  E.photo = H('div', {}, E.mat, { position: 'absolute', backgroundImage: `url(${IMG.picnic.url})`, backgroundSize: 'cover', backgroundPosition: '60% 50%', overflow: 'hidden' });
  E.iris = S('svg', {}, E.photo);
  E.iris.style.position = 'absolute'; E.iris.style.left = '0'; E.iris.style.top = '0';
  E.irisPath = S('path', { fill: '#232326', stroke: '#55555B', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, E.iris);
  // moving plant shadows over everything (a monstera and a palm, swaying)
  E.sh = S('svg', { width: W + 400, height: W + 400, viewBox: `-200 -200 ${W + 400} ${W + 400}` }, E.cam);
  E.sh.style.position = 'absolute'; E.sh.style.left = '-200px'; E.sh.style.top = '-200px';
  E.sh.style.mixBlendMode = 'multiply';
  const f = S('filter', { id: 'leafBlur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, DEFS);
  S('feGaussianBlur', { stdDeviation: 9 }, f);
  E.leaves = S('g', { filter: 'url(#leafBlur)', fill: '#8A7356', opacity: 0.32 }, E.sh);
  E.fronds = [];
  const frond = (x, y, len, ang, n, w) => {
    const g = S('g', {}, E.leaves);
    S('path', { d: `M0 0 Q ${len * 0.5} ${-len * 0.06} ${len} 0`, stroke: '#8A7356', 'stroke-width': 7, fill: 'none' }, g);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1), px = len * t;
      const L = w * Math.sin(Math.PI * (0.25 + 0.75 * t));
      S('path', { d: `M${px} 0 q ${L * 0.35} ${-L * 0.5} ${L * 0.25} ${-L} q ${-L * 0.15} ${L * 0.45} ${-L * 0.25} ${L} Z` }, g);
      S('path', { d: `M${px} 0 q ${L * 0.35} ${L * 0.5} ${L * 0.25} ${L} q ${-L * 0.15} ${-L * 0.45} ${-L * 0.25} ${-L} Z` }, g);
    }
    E.fronds.push({ g, x, y, ang, ph: Math.random() * 6 });
  };
  frond(-120, -80, 900, 32, 11, 210);
  frond(-160, 380, 820, 8, 10, 190);
  frond(1500, 120, 760, 152, 9, 180);
  frond(1580, 900, 880, 196, 11, 200);
  frond(260, 1600, 700, -62, 9, 170);
  E.fronds.forEach((fr, i) => { fr.ph = i * 1.7; });
}

function seekE(b) {
  const on = b >= 46 && b < 51.5;
  vis(E.root, on);
  if (!on) return;
  const t = b / 2;
  // slow studio push while the print hangs
  const s = 1 + 0.07 * ramp(b, 47.6, 50.8, ease.io2);
  E.cam.style.transform = `translate(${720 - 720 * s}px, ${700 - 720 * s + 20}px) scale(${s})`;
  // shadows sway like leaves in a breeze
  E.fronds.forEach((fr) => {
    const a = fr.ang + 2.6 * Math.sin(t * 1.3 + fr.ph) + 1.2 * Math.sin(t * 2.9 + fr.ph * 2);
    const dx = 10 * Math.sin(t * 0.9 + fr.ph);
    fr.g.setAttribute('transform', `translate(${fr.x + dx} ${fr.y}) rotate(${a})`);
  });
  // black → frame (outer box shrinks, the opening grows), then back to black
  let o = chainN(b, [0, 0, W, W, W / 2], [[47, [...FR, 26], 1.7, 0.84]]);
  if (b >= 51) {
    const f = ramp(b, 51, 51.5, ease.in);
    o = [lerp(FR[0], -700, f), lerp(FR[1], -700, f), lerp(FR[2], W + 1400, f), lerp(FR[3], W + 1400, f), lerp(26, 1300, f)];
  }
  const [x, y, w, h, bw] = o;
  st(E.frame, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  const iw = Math.max(0, w - bw * 2), ih = Math.max(0, h - bw * 2);
  st(E.mat, { left: `${bw}px`, top: `${bw}px`, width: `${iw}px`, height: `${ih}px` });
  const m = Math.min(56, iw * 0.11);
  const pw2 = Math.max(0, iw - m * 2), ph2 = Math.max(0, ih - m * 2);
  st(E.photo, { left: `${m}px`, top: `${m}px`, width: `${pw2}px`, height: `${ph2}px` });
  // the same iris: opens on the print, closes again
  const R = Math.hypot(pw2, ph2) / 2 + 2;
  let a = 0;
  if (b >= 48.5 && b < 50.5) a = R * spr(b, 48.5, 3.0, 0.9);
  else if (b >= 50.5) a = R * (1 - ramp(b, 50.5, 51, ease.io));
  sa(E.iris, { width: pw2, height: ph2, viewBox: `0 0 ${pw2} ${ph2}` });
  sa(E.irisPath, { d: irisPath(pw2 / 2, ph2 / 2, a, R, (1 - clamp(a / R)) * Math.PI / 3 + Math.PI / 6) });
}
