/* IRLY launch film: shared engine. Everything is a pure function of time. */
'use strict';
const W = 1440;
const BPM = 120;
const BEATS = 54;
const DUR = BEATS * 60 / BPM; // 27 s
const NS = 'http://www.w3.org/2000/svg';

// ---------- DOM helpers ----------
function H(tag, attrs = {}, parent, style) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'text') el.textContent = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (style) Object.assign(el.style, style);
  if (parent) parent.appendChild(el);
  return el;
}
function S(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) {
    if (k === 'text') el.textContent = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(el);
  return el;
}
function sa(el, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    el.setAttribute(k, typeof v === 'number' ? +v.toFixed(3) : v);
  }
}
function st(el, o) { Object.assign(el.style, o); }
// visibility: inherit so a hidden parent always wins (never 'visible').
function vis(el, on) { el.style.visibility = on ? 'inherit' : 'hidden'; }

// ---------- time helpers (all in beats) ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  lin: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  io2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  outBack: (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
/** 0→1 over [b0,b1] with an easing. */
function ramp(b, b0, b1, e = ease.io) {
  if (b <= b0) return 0;
  if (b >= b1) return 1;
  return e((b - b0) / (b1 - b0));
}
/**
 * Closed-form step response of a damped spring started at beat b0.
 * f: natural frequency in Hz, z: damping ratio. Pure function of time.
 */
function spr(b, b0, f = 3, z = 0.8) {
  const x = (b - b0) * 60 / BPM;
  if (x <= 0) return 0;
  const w = 2 * Math.PI * f;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }
  return 1 - Math.exp(-w * x) * (1 + w * x);
}
/**
 * A value with several targets: one spring per change, summed, so it stays a
 * pure function of time. keys: [beat, target, f?, z?] or [beat, target, 'ease', b1, easing].
 */
function chain(b, v0, keys) {
  let v = v0, prev = v0;
  for (const k of keys) {
    const d = k[1] - prev;
    let p;
    if (k[2] === 'ease') p = ramp(b, k[0], k[3], k[4] || ease.io);
    else p = spr(b, k[0], k[2] ?? 3, k[3] ?? 0.8);
    v += d * p;
    prev = k[1];
  }
  return v;
}
/** chain() for several numbers at once: keys hold arrays. */
function chainN(b, v0, keys) {
  return v0.map((_, i) => chain(b, v0[i], keys.map((k) => [k[0], k[1][i], ...k.slice(2)])));
}

// ---------- images ----------
const IMG = {};
async function loadImages(map) {
  await Promise.all(Object.entries(map).map(async ([k, url]) => {
    const im = new Image();
    im.src = url;
    await im.decode();
    IMG[k] = { url, w: im.naturalWidth, h: im.naturalHeight, el: im };
  }));
}
/** Rect of an image drawn "cover" inside box (x,y,w,h). */
function cover(key, x, y, w, h, fx = 0.5, fy = 0.5) {
  const im = IMG[key];
  const s = Math.max(w / im.w, h / im.h);
  const iw = im.w * s, ih = im.h * s;
  return { x: x + (w - iw) * fx, y: y + (h - ih) * fy, w: iw, h: ih };
}

// ---------- liquid glass ----------
let DEFS;
const mapCache = new Map();
const pendingDecodes = [];
function decodeURL(url) {
  const im = new Image();
  im.src = url;
  pendingDecodes.push(im.decode().catch(() => {}));
}
/** Displacement map for a rounded rectangle: a signed-distance field. */
function rrMap(w, h, r) {
  w = Math.max(8, Math.round(w / 4) * 4);
  h = Math.max(8, Math.round(h / 4) * 4);
  r = Math.min(Math.round(r / 2) * 2, w / 2, h / 2);
  const key = `${w}x${h}x${r}`;
  if (mapCache.has(key)) return mapCache.get(key);
  const M = 160;
  const sc = M / Math.max(w, h);
  const mw = Math.max(8, Math.round(w * sc)), mh = Math.max(8, Math.round(h * sc));
  const cv = document.createElement('canvas');
  cv.width = mw; cv.height = mh;
  const ctx = cv.getContext('2d');
  const id = ctx.createImageData(mw, mh);
  const bw = Math.min(Math.min(w, h) / 2, 110);
  const hw = w / 2, hh = h / 2;
  for (let py = 0; py < mh; py++) {
    for (let px = 0; px < mw; px++) {
      const x = ((px + 0.5) / mw) * w - hw;
      const y = ((py + 0.5) / mh) * h - hh;
      const qx = Math.abs(x) - (hw - r), qy = Math.abs(y) - (hh - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l; }
      else if (qx > qy) nx = 1; else ny = 1;
      nx *= Math.sign(x) || 1; ny *= Math.sign(y) || 1;
      let m = 0;
      if (d < 0 && -d < bw) { const t = 1 - (-d) / bw; m = Math.pow(t, 2.2); }
      const i = (py * mw + px) * 4;
      id.data[i] = 128 + nx * m * 127;
      id.data[i + 1] = 128 + ny * m * 127;
      id.data[i + 2] = 128;
      id.data[i + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);
  const url = cv.toDataURL();
  decodeURL(url);
  mapCache.set(key, url);
  return url;
}

/**
 * A displacement filter: one map, three displacements at slightly different
 * scales, one per colour channel, for chromatic edges.
 */
let filterN = 0;
function dispFilter() {
  const id = `df${filterN++}`;
  const f = S('filter', { id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, DEFS);
  const img = S('feImage', { result: 'map', preserveAspectRatio: 'none' }, f);
  const ch = ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'];
  const dm = [];
  ch.forEach((v, i) => {
    dm.push(S('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G', result: `d${i}` }, f));
    S('feColorMatrix', { in: `d${i}`, type: 'matrix', values: v, result: `c${i}` }, f);
  });
  S('feComposite', { in: 'c0', in2: 'c1', operator: 'arithmetic', k2: 1, k3: 1, result: 'c01' }, f);
  S('feComposite', { in: 'c01', in2: 'c2', operator: 'arithmetic', k2: 1, k3: 1 }, f);
  return {
    id,
    set(x, y, w, h, url, scale, pad = 40) {
      sa(f, { x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2 });
      sa(img, { x, y, width: w, height: h });
      if (img.getAttribute('href') !== url) img.setAttribute('href', url);
      dm.forEach((d, i) => sa(d, { scale: scale * (1 + i * 0.045) }));
    },
  };
}

/**
 * Rounded-rectangle liquid glass. Keeps its own clone (<use>) of the scene
 * behind it, filtered through the displacement map, plus a rim light.
 */
function glassRR(parent, backdropId, opts = {}) {
  const g = S('g', {}, parent);
  const cid = `gc${filterN}`;
  const clip = S('clipPath', { id: cid }, DEFS);
  const cr = S('rect', {}, clip);
  const df = dispFilter();
  const inner = S('g', { 'clip-path': `url(#${cid})` }, g);
  const lens = S('g', {}, inner);
  const use = S('use', { href: `#${backdropId}`, filter: `url(#${df.id})` }, lens);
  const shadow = S('rect', { fill: '#000', filter: 'url(#rrShadow)' }, g);
  g.insertBefore(shadow, inner);
  const tint = S('rect', { fill: opts.tint || 'rgba(255,255,255,0.16)' }, inner);
  const shade = S('rect', { fill: 'url(#glassShade)' }, inner);
  const rim = S('rect', { fill: 'none', stroke: 'rgba(255,255,255,0.75)', 'stroke-width': 1.6 }, g);
  const rim2 = S('rect', { fill: 'none', stroke: 'url(#glassRim)', 'stroke-width': 3.5 }, g);
  return {
    g,
    set(x, y, w, h, r, o = {}) {
      w = Math.max(w, 0.01); h = Math.max(h, 0.01);
      r = Math.min(r, w / 2, h / 2);
      const on = w > 0.5 && h > 0.5;
      vis(g, on);
      if (!on) return;
      for (const el of [cr, tint, shade, rim]) sa(el, { x, y, width: w, height: h, rx: r, ry: r });
      sa(shadow, { x, y: y + Math.min(14, h * 0.08), width: w, height: h, rx: r, ry: r, opacity: o.shadow ?? 1 });
      sa(rim2, { x: x + 1.8, y: y + 1.8, width: Math.max(0, w - 3.6), height: Math.max(0, h - 3.6), rx: Math.max(0, r - 1.8), ry: Math.max(0, r - 1.8) });
      const sc = o.scale ?? Math.min(70, Math.min(w, h) * 0.32);
      df.set(x, y, w, h, rrMap(w, h, r), sc);
      // magnification (lens): scale the clone about the centre
      const m = o.mag ?? 1;
      const cx = x + w / 2, cy = y + h / 2;
      lens.setAttribute('transform', m === 1 ? '' : `translate(${cx} ${cy}) scale(${m}) translate(${-cx} ${-cy})`);
      if (o.tint) tint.setAttribute('fill', o.tint);
    },
    hide() { vis(g, false); },
  };
}

/** Per-glyph glass: canvas distance field → displacement map, mask, highlight. */
function glyphAssets(ch, font, size) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const setFont = () => { ctx.font = `${font.weight} ${size}px ${font.family}`; ctx.fontStretch = font.stretch || 'normal'; };
  setFont();
  const m = ctx.measureText(ch);
  const pad = Math.round(size * 0.12);
  const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
  const gw = Math.ceil(m.actualBoundingBoxRight + m.actualBoundingBoxLeft) + pad * 2;
  const gh = Math.ceil(asc + desc) + pad * 2;
  cv.width = gw; cv.height = gh;
  setFont();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  const ox = pad + m.actualBoundingBoxLeft, oy = pad + asc;
  ctx.fillText(ch, ox, oy);
  const A = ctx.getImageData(0, 0, gw, gh).data;
  const mask = cv.toDataURL();
  // blurred alpha as a smooth distance field
  const cv2 = document.createElement('canvas');
  cv2.width = gw; cv2.height = gh;
  const c2 = cv2.getContext('2d');
  c2.filter = `blur(${Math.max(2, size * 0.035)}px)`;
  c2.drawImage(cv, 0, 0);
  const D = c2.getImageData(0, 0, gw, gh).data;
  const out = c2.createImageData(gw, gh);
  const hi = c2.createImageData(gw, gh);
  const at = (x, y) => D[(clamp(y, 0, gh - 1) * gw + clamp(x, 0, gw - 1)) * 4 + 3] / 255;
  const L = [-0.55, -0.83];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = (y * gw + x) * 4;
      const a = A[i + 3] / 255;
      const d = at(x, y);
      let gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
      const gl = Math.hypot(gx, gy) || 1;
      const nx = -gx / gl, ny = -gy / gl; // outward
      const e = clamp((1 - d) * 2.2);
      const mag = a * Math.pow(e, 1.4);
      out.data[i] = 128 + nx * mag * 127;
      out.data[i + 1] = 128 + ny * mag * 127;
      out.data[i + 2] = 128;
      out.data[i + 3] = 255;
      const lit = Math.max(0, nx * L[0] + ny * L[1]);
      const dark = Math.max(0, -(nx * L[0] + ny * L[1]));
      const rim = a * Math.pow(e, 3);
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = 255;
      hi.data[i + 3] = 255 * clamp(rim * (0.25 + 0.85 * lit) + a * 0.06 - rim * dark * 0.1);
    }
  }
  c2.putImageData(out, 0, 0);
  const map = cv2.toDataURL();
  c2.putImageData(hi, 0, 0);
  const high = cv2.toDataURL();
  [mask, map, high].forEach(decodeURL);
  return { ch, gw, gh, ox, oy, adv: m.width, mask, map, high };
}
let maskN = 0;
function glyphGlass(parent, backdropId, a) {
  const g = S('g', {}, parent);
  const mid = `gm${maskN++}`;
  const mk = S('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 9000, height: 9000 }, DEFS);
  const mimg = S('image', { href: a.mask, preserveAspectRatio: 'none' }, mk);
  const df = dispFilter();
  const shadow = S('image', { href: a.mask, preserveAspectRatio: 'none', filter: 'url(#glyphShadow)' }, g);
  const inner = S('g', { mask: `url(#${mid})` }, g);
  S('use', { href: `#${backdropId}`, filter: `url(#${df.id})` }, inner);
  const tint = S('rect', { fill: 'rgba(255,255,255,0.16)' }, inner);
  const hi = S('image', { href: a.high, preserveAspectRatio: 'none' }, g);
  return {
    g,
    /** x,y: the glyph's baseline origin; s: scale. */
    set(x, y, s = 1, scale = 34) {
      const on = s > 0.01;
      vis(g, on);
      if (!on) return;
      const gx = x - a.ox * s, gy = y - a.oy * s, gw = a.gw * s, gh = a.gh * s;
      for (const el of [mimg, hi]) sa(el, { x: gx, y: gy, width: gw, height: gh });
      sa(shadow, { x: gx, y: gy + 10 * s, width: gw, height: gh });
      sa(tint, { x: gx, y: gy, width: gw, height: gh });
      df.set(gx, gy, gw, gh, a.map, scale * s, 30);
    },
  };
}

// ---------- shared shapes ----------
/** Six iris blades around a hexagonal aperture of radius a, inside radius R. */
function irisPath(cx, cy, a, R, rot) {
  if (a >= R * 0.995) return '';
  a = Math.max(a, 0.01);
  const V = [];
  for (let k = 0; k < 6; k++) {
    const ang = rot + (k * Math.PI) / 3;
    V.push([cx + a * Math.cos(ang), cy + a * Math.sin(ang)]);
  }
  const hit = (p, d) => {
    // ray p + t d, t>0, against circle radius R
    const fx = p[0] - cx, fy = p[1] - cy;
    const B = fx * d[0] + fy * d[1];
    const C = fx * fx + fy * fy - R * R;
    const t = -B + Math.sqrt(Math.max(0, B * B - C));
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  };
  let path = '';
  for (let k = 0; k < 6; k++) {
    const A0 = V[k], A1 = V[(k + 1) % 6];
    // regular hexagon: edge k runs at rot + k·60° + 120°
    const d1 = rot + (k * Math.PI) / 3 + (2 * Math.PI) / 3;
    const d0 = d1 - Math.PI / 3;
    const P = hit(A1, [Math.cos(d1), Math.sin(d1)]); // edge k extended past its end
    const Q = hit(A0, [Math.cos(d0), Math.sin(d0)]); // previous edge extended past A0
    path += `M${A0[0].toFixed(2)},${A0[1].toFixed(2)}L${A1[0].toFixed(2)},${A1[1].toFixed(2)}L${P[0].toFixed(2)},${P[1].toFixed(2)}A${R},${R} 0 0 0 ${Q[0].toFixed(2)},${Q[1].toFixed(2)}Z`;
  }
  return path;
}

/** Text that rises out of a mask line: wrapper clips, inner moves. */
function maskText(parent, text, style) {
  const wrap = H('div', {}, parent, { position: 'absolute', overflow: 'hidden', whiteSpace: 'nowrap' });
  const inner = H('div', { text }, wrap, { position: 'relative', ...style });
  return {
    wrap, inner,
    set(x, y, rise, anchor = 'center') {
      const w = inner.offsetWidth || 1;
      const h = inner.offsetHeight || 1;
      const left = anchor === 'center' ? x - w / 2 : anchor === 'right' ? x - w : x;
      st(wrap, { left: `${left}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px` });
      st(inner, { transform: `translateY(${(1 - rise) * h * 1.05}px)` });
      vis(wrap, rise > 0.001 && rise < 1.999);
    },
  };
}

// ---------- cursor ----------
function makeCursor(parent) {
  const el = H('div', {}, parent, { position: 'absolute', left: 0, top: 0, width: '0px', height: '0px', zIndex: 50 });
  const ring = S('svg', { width: 120, height: 120, viewBox: '-60 -60 120 120' });
  ring.style.position = 'absolute'; ring.style.left = '-60px'; ring.style.top = '-60px';
  el.appendChild(ring);
  const ringC = S('circle', { r: 30, fill: 'none', stroke: '#0B0B0C', 'stroke-width': 4, 'stroke-linecap': 'round', transform: 'rotate(-90)' }, ring);
  const press = S('circle', { r: 22, fill: 'rgba(11,11,12,0.16)' }, ring);
  const svg = S('svg', { width: 40, height: 52, viewBox: '0 0 40 52' });
  svg.style.position = 'absolute'; svg.style.left = '-4px'; svg.style.top = '-3px';
  svg.style.transformOrigin = '4px 3px';
  el.appendChild(svg);
  S('path', { d: 'M4 3 L4 40 L13.5 31 L20 46 L27 43 L20.5 28.5 L34 28.5 Z', fill: '#0B0B0C', stroke: '#FFFFFF', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, svg);
  return {
    el,
    /** p: {x,y}, size: world scale, down: 0..1 press, hold: 0..1 long-press ring */
    set(x, y, size = 1, down = 0, hold = 0, on = true) {
      vis(el, on);
      st(el, { transform: `translate(${x}px, ${y}px) scale(${size})` });
      svg.style.transform = `scale(${1 - 0.14 * down})`;
      sa(press, { r: 10 + 16 * down, fill: `rgba(11,11,12,${0.18 * down})` });
      const C = 2 * Math.PI * 30;
      sa(ringC, { 'stroke-dasharray': `${C * hold} ${C}`, opacity: hold > 0 && hold < 1.001 ? 1 : 0 });
    },
  };
}
/** Press pulse at beat c: 0→1→0 over ~0.18 beat. */
function press(b, c, len = 0.3) {
  if (b < c - 0.05 || b > c + len) return 0;
  if (b < c) return (b - (c - 0.05)) / 0.05;
  return 1 - ramp(b, c + len * 0.35, c + len, ease.out);
}
/** Path for the cursor through waypoints [beat, x, y], each leg a spring. */
function cursorPath(b, pts, f = 2.4, z = 0.85) {
  const x = chain(b, pts[0][1], pts.slice(1).map((p) => [p[0], p[1], f, z]));
  const y = chain(b, pts[0][2], pts.slice(1).map((p) => [p[0], p[2], f, z]));
  return { x, y };
}

const ICON = {
  home: 'M4 11.5 12 4.5l8 7V20h-5v-5H9v5H4z',
  map: 'M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5zM9 4v13.5M15 6.5V20',
  plus: 'M12 5v14M5 12h14',
  chat: 'M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 11a3 3 0 1 0 0-6M18 20h3.5a5.5 5.5 0 0 0-4.5-5.4',
  car: 'M5 16.5h14M6.5 16.5v2M17.5 16.5v2M4.5 16.5l1.6-5.2A2 2 0 0 1 8 9.9h8a2 2 0 0 1 1.9 1.4l1.6 5.2',
};
function iconSVG(parent, name, size, color, sw = 2) {
  const s = S('svg', { width: size, height: size, viewBox: '0 0 24 24' }, parent);
  S('path', { d: ICON[name], fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
  return s;
}
