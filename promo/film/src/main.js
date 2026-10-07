/* Boot: fonts, images, scenes; window.seek(t) draws the frame at time t. */
'use strict';
const SCENES = [];
async function boot() {
  await document.fonts.load('800 100px Archivo');
  await document.fonts.load('600 40px Geist');
  await document.fonts.ready;
  await loadImages(window.__IMAGES);
  const stage = document.getElementById('stage');
  const defsSvg = S('svg', { width: 0, height: 0 }, document.body);
  defsSvg.style.position = 'absolute';
  DEFS = S('defs', {}, defsSvg);
  const sh = S('linearGradient', { id: 'glassShade', x1: 0, y1: 0, x2: 0, y2: 1 }, DEFS);
  S('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': 0.14 }, sh);
  S('stop', { offset: 0.45, 'stop-color': '#FFFFFF', 'stop-opacity': 0 }, sh);
  S('stop', { offset: 1, 'stop-color': '#000000', 'stop-opacity': 0.10 }, sh);
  const rm = S('linearGradient', { id: 'glassRim', x1: 0, y1: 0, x2: 1, y2: 1 }, DEFS);
  S('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': 0.9 }, rm);
  S('stop', { offset: 0.35, 'stop-color': '#FFFFFF', 'stop-opacity': 0.08 }, rm);
  S('stop', { offset: 0.7, 'stop-color': '#FFFFFF', 'stop-opacity': 0.05 }, rm);
  S('stop', { offset: 1, 'stop-color': '#FFFFFF', 'stop-opacity': 0.55 }, rm);
  const gs = S('filter', { id: 'glyphShadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, DEFS);
  S('feGaussianBlur', { stdDeviation: 10 }, gs);
  S('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0' }, gs);
  const rs = S('filter', { id: 'rrShadow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, DEFS);
  S('feGaussianBlur', { stdDeviation: 16 }, rs);
  S('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0' }, rs);
  for (const s of window.__SCENES) { s.build(stage); SCENES.push(s); }
  window.seek = async (t) => {
    let b = (t * BPM) / 60;
    b = ((b % BEATS) + BEATS) % BEATS;
    for (const s of SCENES) s.seek(b);
    await Promise.all(pendingDecodes.splice(0));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  window.__ready = true;
  // scrubber when opened by hand
  if (!/render/.test(location.hash)) {
    const bar = H('input', { type: 'range', min: 0, max: DUR * 1000, value: 0 }, document.body, { width: '1440px', display: 'block' });
    const lab = H('div', {}, document.body, { font: '14px Geist', color: '#ddd', padding: '6px' });
    let playing = false, t0 = 0;
    const show = async (ms) => { await window.seek(ms / 1000); lab.textContent = `t=${(ms / 1000).toFixed(2)}s  beat ${((ms / 1000) * 2).toFixed(2)}  (space = play)`; };
    bar.oninput = () => show(+bar.value);
    window.onkeydown = (e) => { if (e.code === 'Space') { playing = !playing; t0 = performance.now() - +bar.value; loop(); } };
    const loop = async () => { if (!playing) return; const ms = (performance.now() - t0) % (DUR * 1000); bar.value = ms; await show(ms); requestAnimationFrame(loop); };
    show(0);
  }
}
boot();
