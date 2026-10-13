// iPhone frame shared by the screenshots (compose.mjs) and the wide header images
// (compose-header.mjs): rim, bezel, Dynamic Island, status bar (9:41, signal, Wi-Fi,
// battery) and home indicator, drawn over a real 1320 x 2868 capture of the app.
// screenHTML shows the same capture without a device (search results image).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(DIR, '../../..');
const FONTS = `${REPO}/node_modules/@expo-google-fonts/manrope`;
// The status bar time is set in Inter SemiBold when installed (closest to SF Pro), Manrope otherwise.
const INTER = ['/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', '/Library/Fonts/Inter-SemiBold.otf', `${os.homedir()}/Library/Fonts/Inter-SemiBold.otf`].find((f) => fs.existsSync(f));

export const FONT_CSS = `
    @font-face { font-family: Manrope; font-weight: 500; src: url(file://${FONTS}/500Medium/Manrope_500Medium.ttf); }
    @font-face { font-family: Manrope; font-weight: 600; src: url(file://${FONTS}/600SemiBold/Manrope_600SemiBold.ttf); }
    @font-face { font-family: Manrope; font-weight: 700; src: url(file://${FONTS}/700Bold/Manrope_700Bold.ttf); }
    @font-face { font-family: Manrope; font-weight: 800; src: url(file://${FONTS}/800ExtraBold/Manrope_800ExtraBold.ttf); }
    ${INTER ? `@font-face { font-family: InterSB; font-weight: 600; src: url(file://${INTER}); }` : ''}`;

export const PHONE_CSS = `
    .phone { position:absolute; }
    .rim { position:absolute; inset:0; background: linear-gradient(140deg, #7d7d84 0%, #26262a 16%, #46464c 50%, #18181b 84%, #8a8a91 100%); }
    .body { position:absolute; background:#0a0a0b; }
    .screen { position:absolute; overflow:hidden; background:#000; }
    .screen img { position:absolute; left:0; top:0; display:block; }
    .island { position:absolute; background:#000; }
    .time { position:absolute; display:flex; align-items:center; justify-content:center; font-family: InterSB, Manrope; font-weight:600; letter-spacing:-0.01em; }
    .sicons { position:absolute; display:flex; align-items:center; justify-content:center; }
    .sicons span { display:block; }
    .home { position:absolute; }
    .scr { position:absolute; overflow:hidden; background:#000; }
    .scr img { position:absolute; left:0; top:0; display:block; }
    .scr .veil, .scr .edge { position:absolute; inset:0; }
    .scr .edge { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.14); }`;

const icons = (c) => ({
  signal: `<svg viewBox="0 0 18 12" width="100%" height="100%"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="${c}"/><rect x="4.9" y="5.6" width="3.2" height="6.4" rx="1" fill="${c}"/><rect x="9.8" y="3" width="3.2" height="9" rx="1" fill="${c}"/><rect x="14.7" y="0" width="3.2" height="12" rx="1" fill="${c}"/></svg>`,
  wifi: `<svg viewBox="0 0 16 12" width="100%" height="100%"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.1-1.2C13.2 1.7 10.7.6 8 .6S2.8 1.7.9 3.5L2 4.7c1.6-1.5 3.7-2.4 6-2.4z" fill="${c}"/><path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.1-1.2C11.4 4.6 9.8 3.9 8 3.9S4.6 4.6 3.3 5.8l1.1 1.2C5.4 6.1 6.6 5.6 8 5.6z" fill="${c}"/><path d="M8 8.8c.6 0 1.1.2 1.5.6L8 11.1 6.5 9.4c.4-.4.9-.6 1.5-.6z" fill="${c}"/></svg>`,
  battery: `<svg viewBox="0 0 27 13" width="100%" height="100%"><rect x="0.6" y="0.6" width="23" height="11.8" rx="3.6" fill="none" stroke="${c}" stroke-opacity="0.38" stroke-width="1.1"/><rect x="2.3" y="2.3" width="19.6" height="8.4" rx="2.2" fill="${c}"/><path d="M25 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1z" fill="${c}" fill-opacity="0.45"/></svg>`,
});

// p = { cx, top, S }: horizontal centre, top edge and screen width, in canvas px.
export function geometry(p) {
  const S = p.S;
  const k = S / 440;
  const H = (S * 2868) / 1320;
  const b = 12.5 * k;
  const rim = 2.2 * k;
  const W = S + 2 * b + 2 * rim;
  const HH = H + 2 * b + 2 * rim;
  const left = p.cx - W / 2;
  return { S, k, H, b, rim, W, HH, left, top: p.top, screenLeft: left + rim + b, screenTop: p.top + rim + b, scale: S / 1320, R: 55 * k };
}

// Status bar and home indicator over a screen S px wide (k = S / 440): 9:41 with full signal,
// Wi-Fi and battery. status: 'dark' for dark text (light app screen), 'light' otherwise.
// island: the Dynamic Island, drawn only inside the iPhone frame.
function systemUI(k, S, status, time, island) {
  const statusColor = status === 'dark' ? '#000000' : '#FFFFFF';
  const homeColor = status === 'dark' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  const I = icons(statusColor);
  return `${island ? `
      <div class="island" style="width:${126 * k}px; height:${37 * k}px; top:${11 * k}px; left:${(S - 126 * k) / 2}px; border-radius:${18.5 * k}px;"></div>` : ''}
      <div class="time" style="left:0; width:${157 * k}px; top:${11 * k}px; height:${37 * k}px; font-size:${17 * k}px; color:${statusColor};">${time}</div>
      <div class="sicons" style="left:${(440 - 157) * k}px; width:${157 * k}px; top:${11 * k}px; height:${37 * k}px; gap:${5.5 * k}px;">
        <span style="width:${18 * k}px; height:${12 * k}px;">${I.signal}</span>
        <span style="width:${16 * k}px; height:${12 * k}px;">${I.wifi}</span>
        <span style="width:${27 * k}px; height:${13 * k}px;">${I.battery}</span>
      </div>
      <div class="home" style="width:${144 * k}px; height:${5 * k}px; left:${(S - 144 * k) / 2}px; bottom:${8 * k}px; background:${homeColor}; border-radius:${2.5 * k}px;"></div>`;
}

export function phoneHTML(g, screenSrc, status, shadow, time = '9:41') {
  const { S, k, H, b, rim, W, HH, left, top, R } = g;
  return `
  <div class="phone" style="left:${left}px; top:${top}px; width:${W}px; height:${HH}px; border-radius:${R + b + rim}px; box-shadow:${shadow};">
    <div class="rim" style="border-radius:${R + b + rim}px;"></div>
    <div class="body" style="left:${rim}px; top:${rim}px; right:${rim}px; bottom:${rim}px; border-radius:${R + b}px;"></div>
    <div class="screen" style="left:${rim + b}px; top:${rim + b}px; width:${S}px; height:${H}px; border-radius:${R}px;">
      <img src="${screenSrc}" style="width:${S}px; height:${H}px;" />${systemUI(k, S, status, time, true)}
    </div>
  </div>`;
}

// The same measures for a screen shown without a device: p = { cx, top, S }.
export function screenGeometry(p) {
  const S = p.S;
  const k = S / 440;
  return { S, k, H: (S * 2868) / 1320, left: p.cx - S / 2, top: p.top, screenLeft: p.cx - S / 2, screenTop: p.top, scale: S / 1320, R: 55 * k };
}

// A real capture shown as a screen alone, without a device. Apple's marketing guidelines ask
// not to draw an Apple product, nor to tilt it or add shadows to it: here the perspective
// (ry, rotation in degrees; z, depth in px) and the shadow apply to the app screen only.
// s = { cx, top, S, status, ry, z, dim, edge }: dim darkens a screen set further back (0 to 1);
// edge is the colour of its hairline outline (light by default, for dark screens).
export function screenHTML(s, screenSrc, shadow, time = '9:41') {
  const S = s.S;
  const k = S / 440;
  const H = (S * 2868) / 1320;
  const R = 55 * k;
  return `
  <div class="scr" style="left:${s.cx - S / 2}px; top:${s.top}px; width:${S}px; height:${H}px; border-radius:${R}px; transform:translateZ(${s.z ?? 0}px) rotateY(${s.ry ?? 0}deg); box-shadow:${shadow};">
    <img src="${screenSrc}" style="width:${S}px; height:${H}px;" />${systemUI(k, S, s.status, time, false)}
    ${s.dim ? `<div class="veil" style="background:rgba(0,0,0,${s.dim});"></div>` : ''}
    <div class="edge" style="border-radius:${R}px;${s.edge ? ` box-shadow: inset 0 0 0 2px ${s.edge};` : ''}"></div>
  </div>`;
}
