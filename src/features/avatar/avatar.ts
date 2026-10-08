/**
 * IRLY avatars: an original, flat, friendly portrait a member can build
 * instead of uploading a photo. The whole avatar is a short string stored
 * where a photo path would be (`profiles.photo_paths[0]`, `profile.photoUri`):
 *
 *   irly-avatar:v1:<g>.<skin>.<hair>.<hairColor>.<top>.<topColor>.<acc>.<bg>
 *
 * Every number is an index into the lists below, so the string stays tiny,
 * needs no upload and renders the same everywhere. Drawing is pure data
 * (`drawAvatar`) in a 100 x 100 box, rendered by `IrlyAvatar` with SVG.
 */

export type AvatarConfig = {
  g: 'f' | 'm';
  skin: number;
  hair: number;
  hairColor: number;
  top: number;
  topColor: number;
  acc: number;
  bg: number;
};

export type AvatarGender = 'woman' | 'man' | 'other';

/** Light to deep. */
export const SKIN = ['#F8DEC9', '#EFC7A6', '#E0AC85', '#C98D62', '#AA6E47', '#845232', '#5E3A22'] as const;

/** Black, dark brown, brown, auburn, blonde, platinum, grey, soft lilac. */
export const HAIR_COLORS = ['#1D1B1B', '#3A2A22', '#6A4630', '#8C3F25', '#D4AA62', '#EAE0CB', '#9C9C9C', '#C3A6D6'] as const;

/** Headscarves (hijab, ghutra) take their colour from this list, at the same index as the hair colour. */
export const SCARF_COLORS = ['#1E1E20', '#5A4639', '#9A8778', '#B4664E', '#D9C8AE', '#F4F2EE', '#A3A6AB', '#B9A7CF'] as const;

/** Black, white, grey, steel, navy, forest, sand, terracotta. */
export const TOP_COLORS = ['#141416', '#F3F3F1', '#8C8C8C', '#5E7A99', '#2C3954', '#33473B', '#CDBBA4', '#A9513F'] as const;

/** Quiet tints that sit well on IRLY Noir and IRLY Clair. */
export const BG_COLORS = ['#E6E6E3', '#D6DEE7', '#E8DCD0', '#D9E3D8', '#E4D9E4', '#2B2D33'] as const;

export const HAIR_STYLES = {
  f: ['long', 'wavy', 'bob', 'bun', 'afro', 'ponytail', 'hijab'],
  m: ['crop', 'fade', 'curly', 'quiff', 'tied', 'buzz', 'keffiyeh'],
} as const;

export const TOP_STYLES = {
  f: ['tee', 'vneck', 'hoodie', 'blazer', 'turtleneck'],
  m: ['tee', 'collar', 'hoodie', 'blazer', 'turtleneck'],
} as const;

export const ACCESSORIES = {
  f: ['none', 'glasses', 'sunglasses', 'earrings', 'earrings+glasses'],
  m: ['none', 'glasses', 'sunglasses', 'stubble', 'beard', 'beard+glasses'],
} as const;

export type HairStyle = (typeof HAIR_STYLES)[keyof typeof HAIR_STYLES][number];
export type TopStyle = (typeof TOP_STYLES)[keyof typeof TOP_STYLES][number];
export type Accessory = (typeof ACCESSORIES)[keyof typeof ACCESSORIES][number];

/** Head coverings: the colour comes from SCARF_COLORS and the ears stay hidden. */
const HEADWEAR = new Set<HairStyle>(['hijab', 'keffiyeh']);
export const isHeadwear = (c: AvatarConfig) => HEADWEAR.has(HAIR_STYLES[c.g][c.hair]);

const PREFIX = 'irly-avatar:v1:';

/** The size of each list, per field, for a given style set. */
export function avatarRanges(g: AvatarConfig['g']) {
  return {
    skin: SKIN.length,
    hair: HAIR_STYLES[g].length,
    hairColor: HAIR_COLORS.length,
    top: TOP_STYLES[g].length,
    topColor: TOP_COLORS.length,
    acc: ACCESSORIES[g].length,
    bg: BG_COLORS.length,
  };
}

const FIELDS = ['skin', 'hair', 'hairColor', 'top', 'topColor', 'acc', 'bg'] as const;

export function encodeAvatar(c: AvatarConfig): string {
  return `${PREFIX}${c.g}.${FIELDS.map((f) => c[f]).join('.')}`;
}

export function decodeAvatar(s: string | null | undefined): AvatarConfig | null {
  if (typeof s !== 'string' || !s.startsWith(PREFIX)) return null;
  const parts = s.slice(PREFIX.length).split('.');
  if (parts.length !== 8) return null;
  const [g, ...rest] = parts;
  if (g !== 'f' && g !== 'm') return null;
  const ranges = avatarRanges(g);
  const out = { g } as AvatarConfig;
  for (const [i, f] of FIELDS.entries()) {
    const v = rest[i];
    if (!/^\d{1,2}$/.test(v)) return null;
    const n = Number(v);
    if (n >= ranges[f]) return null;
    out[f] = n;
  }
  return out;
}

export function isAvatar(s?: string | null): boolean {
  return typeof s === 'string' && s.startsWith(PREFIX);
}

/** Small deterministic generator, so a seed always gives the same avatar. */
function rng(seed: number) {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const genderToG = (gender: AvatarGender | undefined, pick: () => number): AvatarConfig['g'] =>
  gender === 'man' ? 'm' : gender === 'woman' ? 'f' : pick() < 0.5 ? 'f' : 'm';

/**
 * A random avatar. Head coverings are never drawn at random: they are a
 * personal choice, offered in the builder.
 */
export function randomAvatar(gender?: AvatarGender, seed = Date.now()): AvatarConfig {
  const r = rng(seed);
  const pick = (n: number) => Math.floor(r() * n) % n;
  const g = genderToG(gender, r);
  const ranges = avatarRanges(g);
  const hairs = HAIR_STYLES[g].map((h, i) => (HEADWEAR.has(h) ? -1 : i)).filter((i) => i >= 0);
  // Mostly natural hair colours; the pastel and platinum shades stay rarer.
  const hairColor = r() < 0.85 ? pick(5) : 5 + pick(3);
  const acc = r() < 0.55 ? 0 : pick(ranges.acc);
  return {
    g,
    skin: pick(ranges.skin),
    hair: hairs[pick(hairs.length)],
    hairColor,
    top: pick(ranges.top),
    topColor: pick(ranges.topColor),
    acc,
    bg: pick(ranges.bg - 1),
  };
}

/** The starting point of the builder: a calm, neutral avatar (seed 0), or a seeded random one. */
export function defaultAvatar(gender?: AvatarGender, seed = 0): AvatarConfig {
  if (seed) return randomAvatar(gender, seed);
  const g: AvatarConfig['g'] = gender === 'man' ? 'm' : 'f';
  return { g, skin: 2, hair: 0, hairColor: 1, top: 0, topColor: 0, acc: 0, bg: 0 };
}

// ---------------------------------------------------------------------------
// Drawing (pure data, 100 x 100)
// ---------------------------------------------------------------------------

type Paint = { fill?: string; stroke?: string; sw?: number; op?: number; evenodd?: boolean };
export type Shape =
  | ({ t: 'path'; d: string } & Paint)
  | ({ t: 'circle'; cx: number; cy: number; r: number } & Paint)
  | ({ t: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Paint)
  | ({ t: 'rect'; x: number; y: number; w: number; h: number; rx?: number } & Paint);

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mixes two colours: `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const v = x.map((n, i) => Math.round(n + (y[i] - n) * t));
  return `#${v.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
const darker = (c: string, t: number) => mix(c, '#000000', t);
const lighter = (c: string, t: number) => mix(c, '#FFFFFF', t);
const luminance = (c: string) => {
  const [r, g, b] = hex(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const mirror = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(100 - Number(x)).toFixed(2)} ${y}`);

const TORSO = 'M11 100 C12 83 25 74 42 71 Q50 72.6 58 71 C75 74 88 83 89 100 Z';

function topShapes(style: TopStyle, color: string, skin: string): Shape[] {
  const deep = darker(color, 0.22);
  const out: Shape[] = [{ t: 'path', d: TORSO, fill: color }];
  switch (style) {
    case 'tee':
      out.push({ t: 'path', d: 'M42 71 Q50 77.5 58 71 Q50 74.4 42 71 Z', fill: deep });
      break;
    case 'vneck':
      out.push({ t: 'path', d: 'M42.6 71 L50 80.5 L57.4 71 Q50 72.6 42.6 71 Z', fill: skin });
      out.push({ t: 'path', d: 'M42.6 71 L50 80.5 L57.4 71', stroke: deep, sw: 1.4 });
      break;
    case 'collar': {
      const flap = luminance(color) > 0.8 ? darker(color, 0.08) : lighter(color, 0.22);
      out.push({ t: 'path', d: 'M44 71 L50 77.5 L56 71 Q50 72.4 44 71 Z', fill: skin });
      out.push({ t: 'path', d: 'M50 77.5 L50 100', stroke: deep, sw: 1, op: 0.6 });
      const left = 'M41.5 70.2 L50 77.5 L44.6 81.5 L39.4 72.6 Z';
      out.push({ t: 'path', d: left, fill: flap }, { t: 'path', d: mirror(left), fill: flap });
      break;
    }
    case 'hoodie':
      out.push({ t: 'path', d: 'M34.5 74.5 C35.5 67.5 42 65.5 50 65.5 C58 65.5 64.5 67.5 65.5 74.5 C60 79 40 79 34.5 74.5 Z', fill: deep });
      out.push({ t: 'path', d: 'M42 71 Q50 76.6 58 71 L58 69.4 Q50 72 42 69.4 Z', fill: skin });
      out.push({ t: 'path', d: 'M45.6 76 L45 84.5', stroke: lighter(color, 0.6), sw: 1.2 });
      out.push({ t: 'path', d: 'M54.4 76 L55 84.5', stroke: lighter(color, 0.6), sw: 1.2 });
      break;
    case 'blazer': {
      const shirt = luminance(color) > 0.8 ? '#1C1C1E' : '#F5F5F3';
      const lapel = darker(color, 0.25);
      out.push({ t: 'path', d: 'M41.6 71 L50 92 L58.4 71 Q50 72.6 41.6 71 Z', fill: shirt });
      out.push({ t: 'path', d: 'M44.4 71 L50 77.2 L55.6 71 Q50 72.4 44.4 71 Z', fill: skin });
      const left = 'M41.6 70.6 L50 92 L43.2 86 L40.6 79 L43.6 77 L38.6 73.2 Z';
      out.push({ t: 'path', d: left, fill: lapel }, { t: 'path', d: mirror(left), fill: lapel });
      break;
    }
    case 'turtleneck':
      out.push({ t: 'rect', x: 42.5, y: 61, w: 15, h: 13, rx: 5, fill: darker(color, 0.1) });
      out.push({ t: 'path', d: 'M43.5 66.4 Q50 68.4 56.5 66.4 M43.5 69.6 Q50 71.6 56.5 69.6', stroke: darker(color, 0.25), sw: 0.9, op: 0.7 });
      break;
  }
  return out;
}

/** Hair drawn behind the head (length, volume, buns). */
function hairBack(style: HairStyle, c: string): Shape[] {
  switch (style) {
    case 'long':
      return [{ t: 'path', d: 'M30 42 C30 24 39 19 50 19 C61 19 70 24 70 42 L71.5 79 L28.5 79 Z', fill: c }];
    case 'wavy':
      return [
        {
          t: 'path',
          d: 'M29.5 42 C29.5 23 39 18.5 50 18.5 C61 18.5 70.5 23 70.5 42 C72.5 50 68.5 56 71.5 63 C74 69.5 70 75 72.5 80 L27.5 80 C30 75 26 69.5 28.5 63 C31.5 56 27.5 50 29.5 42 Z',
          fill: c,
        },
      ];
    case 'bob':
      return [{ t: 'path', d: 'M30 42 C30 23 39 19 50 19 C61 19 70 23 70 42 L70.5 63 C66 65.5 62 64.5 60 62.5 L40 62.5 C38 64.5 34 65.5 29.5 63 Z', fill: c }];
    case 'bun':
      return [{ t: 'circle', cx: 50, cy: 17, r: 8.4, fill: c }];
    case 'tied':
      return [{ t: 'circle', cx: 50, cy: 18.6, r: 6.4, fill: c }];
    case 'afro': {
      const bumps: Shape[] = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * (0.92 + (i / 11) * 1.16);
        bumps.push({ t: 'circle', cx: +(50 + Math.cos(a) * 21).toFixed(2), cy: +(38 + Math.sin(a) * 18.5).toFixed(2), r: 7.4, fill: c });
      }
      return [{ t: 'ellipse', cx: 50, cy: 39, rx: 24, ry: 21, fill: c }, ...bumps];
    }
    case 'ponytail':
      return [
        { t: 'path', d: 'M60 27 C74 26 80.5 40 77.5 55 C76.5 62 73 67 70 70 C71.5 61 70 52 64 44 Z', fill: c },
      ];
    case 'keffiyeh':
      return [];
    default:
      return [];
  }
}

/** Hair drawn over the face (hairline, fringe, sides). */
function hairFront(style: HairStyle, c: string): Shape[] {
  const shade = darker(c, 0.18);
  switch (style) {
    case 'long':
      return [
        {
          t: 'path',
          d: 'M30.8 61 L30.8 40 C30.8 25 40 20.5 50 20.5 C60 20.5 69.2 25 69.2 40 L69.2 61 C67.3 62.4 65.4 61.6 65 59 L65 42.5 C59.5 40.5 52 35.5 46.5 29.5 C43.5 35.5 38.5 40 35 42.5 L35 59 C34.6 61.6 32.7 62.4 30.8 61 Z',
          fill: c,
        },
      ];
    case 'wavy':
      return [
        {
          t: 'path',
          d: 'M30.8 61 C29 54.5 32.2 48 30.5 40 C30.8 25 40 20.5 50 20.5 C60 20.5 69.2 25 69.5 40 C67.8 48 71 54.5 69.2 61 C67.3 62.4 65.2 61.6 64.8 59 C66 53 63.6 48 65.2 43 C60 40.6 53.5 35.6 50 29.5 C46.5 35.6 40 40.6 34.8 43 C36.4 48 34 53 35.2 59 C34.8 61.6 32.7 62.4 30.8 61 Z',
          fill: c,
        },
      ];
    case 'bob':
      return [
        {
          t: 'path',
          d: 'M30.4 62 L30.4 40 C30.4 25 40 20.5 50 20.5 C60 20.5 69.6 25 69.6 40 L69.6 62 C67.6 63.6 65.6 63 65 60.8 L65 40.5 C59 37.4 41 37.4 35 40.5 L35 60.8 C34.4 63 32.4 63.6 30.4 62 Z',
          fill: c,
        },
      ];
    case 'bun':
    case 'ponytail':
      return [
        { t: 'path', d: 'M33 45 C32 27.5 40 21.5 50 21.5 C60 21.5 68 27.5 67 45 C66 38.5 63 33.6 58 31.6 C53 30.4 47 30.4 42 31.6 C37 33.6 34 38.5 33 45 Z', fill: c },
        { t: 'path', d: 'M43 25.5 Q50 23.6 57 25.5', stroke: shade, sw: 0.9, op: 0.8 },
      ];
    case 'afro': {
      const curls: Shape[] = [36, 42, 50, 58, 64].map((x, i) => ({ t: 'circle', cx: x, cy: i % 2 ? 31.6 : 33.4, r: 4.4, fill: c }));
      return [{ t: 'path', d: 'M32.6 44 C31 28 39 21 50 21 C61 21 69 28 67.4 44 C66 38 63.5 35 60 34 L40 34 C36.5 35 34 38 32.6 44 Z', fill: c }, ...curls];
    }
    case 'hijab':
      return [
        {
          t: 'path',
          evenodd: true,
          d:
            'M50 19 C35 19 29.5 31.5 29.8 47 C30 58 32 65 29.5 73.5 C38 80.5 62 80.5 70.5 73.5 C68 65 70 58 70.2 47 C70.5 31.5 65 19 50 19 Z ' +
            'M50 28.6 C41.6 28.6 36.6 35 36.6 45 C36.6 55.4 42.4 62.6 50 62.6 C57.6 62.6 63.4 55.4 63.4 45 C63.4 35 58.4 28.6 50 28.6 Z',
          fill: c,
        },
        { t: 'path', d: 'M37 66 Q50 75.5 63 66', stroke: darker(c, 0.16), sw: 1.2 },
        { t: 'path', d: 'M36.6 45 C36.6 35 41.6 28.6 50 28.6 C58.4 28.6 63.4 35 63.4 45', stroke: darker(c, 0.12), sw: 1 },
      ];
    case 'crop':
      return [
        {
          t: 'path',
          d: 'M33.2 45 C32.4 27.5 40 21 50 21 C60 21 67.6 27.5 66.8 45 C66 39.5 64 35.5 61.4 34 L58 35.4 L54.6 33.8 L50.6 35.4 L46.6 33.8 L42.6 35.4 L38.6 34 C36 35.5 34 39.5 33.2 45 Z',
          fill: c,
        },
      ];
    case 'fade':
      return [
        { t: 'path', d: 'M33.6 46 C33 33.5 38.5 27 50 27 C61.5 27 67 33.5 66.4 46 L64.6 46 C64.4 38.5 60 35 50 35 C40 35 35.6 38.5 35.4 46 Z', fill: c, op: 0.42 },
        { t: 'path', d: 'M35.6 36.4 C35.4 25 41.6 19.6 50 19.6 C58.4 19.6 64.6 25 64.4 36.4 C58 33.2 42 33.2 35.6 36.4 Z', fill: c },
      ];
    case 'curly': {
      const top: [number, number, number][] = [
        [36.4, 33, 5.2],
        [40.6, 26.6, 5.6],
        [47.4, 23, 5.8],
        [54.8, 23.2, 5.8],
        [61, 27, 5.6],
        [64.2, 33.4, 5.2],
        [42.6, 33.8, 4.2],
        [50, 32.6, 4.4],
        [57.4, 33.8, 4.2],
      ];
      return [
        { t: 'path', d: 'M33.4 44 C33 29 40 23.5 50 23.5 C60 23.5 67 29 66.6 44 C64.6 38.6 60 36 50 36 C40 36 35.4 38.6 33.4 44 Z', fill: c },
        ...top.map(([cx, cy, r]): Shape => ({ t: 'circle', cx, cy, r, fill: c })),
      ];
    }
    case 'quiff':
      return [
        {
          t: 'path',
          d: 'M33.2 45 C32.2 31 37.6 24.6 43.6 23.2 C46 16.4 56.6 13.4 64.6 17.6 C61.4 18.4 60.2 20.2 60.6 22.6 C66.4 25.6 68 34 66.8 45 C66 39 63.6 35.6 60.4 35 C54 35.8 45 35.2 39.4 35 C36 36 34 39.5 33.2 45 Z',
          fill: c,
        },
        { t: 'path', d: 'M46 23.6 C49.5 19.6 55 18.2 60 19.6', stroke: shade, sw: 1, op: 0.8 },
      ];
    case 'tied':
      return [
        { t: 'path', d: 'M33 46 C32 28 40 22 50 22 C60 22 68 28 67 46 C66 39 63.4 34.6 58.6 32.4 C53.4 31 46.6 31 41.4 32.4 C36.6 34.6 34 39 33 46 Z', fill: c },
        { t: 'path', d: 'M41 27 Q50 23.4 59 27 M44.4 31.6 Q50 27 55.6 31.6', stroke: shade, sw: 0.9, op: 0.7 },
        { t: 'rect', x: 46.4, y: 23.2, w: 7.2, h: 2.6, rx: 1.3, fill: darker(c, 0.35) },
      ];
    case 'buzz':
      return [
        { t: 'path', d: 'M33.6 44 C33 30 40 24 50 24 C60 24 67 30 66.4 44 C65 37.5 62 33.4 58 32.6 C53 32 47 32 42 32.6 C38 33.4 35 37.5 33.6 44 Z', fill: c, op: 0.72 },
      ];
    case 'keffiyeh':
      return [
        {
          t: 'path',
          d: 'M30 48 C29 28 38 19.4 50 19.4 C62 19.4 71 28 70 48 L74 84 L63.6 84 L63.6 60 C65.4 52 65.4 46 64.8 41.6 C62 36 56 33.6 50 33.6 C44 33.6 38 36 35.2 41.6 C34.6 46 34.6 52 36.4 60 L36.4 84 L26 84 Z',
          fill: c,
        },
        { t: 'path', d: 'M35.6 59 L34 84 M64.4 59 L66 84', stroke: darker(c, 0.12), sw: 0.9 },
        { t: 'path', d: 'M33.2 34.6 C40 28.4 60 28.4 66.8 34.6', stroke: '#18181A', sw: 2.6 },
        { t: 'path', d: 'M34.2 31 C41 25 59 25 65.8 31', stroke: '#18181A', sw: 2 },
      ];
  }
}

const COVERS_EARS = new Set<HairStyle>(['long', 'wavy', 'bob', 'hijab', 'keffiyeh']);

/**
 * The avatar as a list of flat shapes, back to front, in a 100 x 100 box.
 * Pure: the same config always gives the same drawing.
 */
export function drawAvatar(c: AvatarConfig): Shape[] {
  const skin = SKIN[c.skin] ?? SKIN[0];
  const hairStyle = HAIR_STYLES[c.g][c.hair] ?? HAIR_STYLES[c.g][0];
  const headwear = HEADWEAR.has(hairStyle);
  const hair = headwear ? (SCARF_COLORS[c.hairColor] ?? SCARF_COLORS[0]) : (HAIR_COLORS[c.hairColor] ?? HAIR_COLORS[0]);
  const top = TOP_COLORS[c.topColor] ?? TOP_COLORS[0];
  const topStyle = TOP_STYLES[c.g][c.top] ?? 'tee';
  const acc = ACCESSORIES[c.g][c.acc] ?? 'none';
  const skinShade = darker(skin, 0.14);
  const ink = luminance(skin) > 0.45 ? '#2A1D1A' : '#1A1110';
  const brow = headwear ? '#3A2A22' : luminance(hair) > 0.55 ? darker(hair, 0.4) : darker(hair, 0.1);
  const facial = luminance(hair) > 0.55 ? darker(hair, 0.18) : hair;

  const s: Shape[] = [{ t: 'circle', cx: 50, cy: 50, r: 50, fill: BG_COLORS[c.bg] ?? BG_COLORS[0] }];
  s.push(...hairBack(hairStyle, hair));
  // Neck, with a soft shadow under the chin.
  s.push({ t: 'rect', x: 43.6, y: 54, w: 12.8, h: 21, rx: 5, fill: skin });
  s.push({ t: 'ellipse', cx: 50, cy: 64.6, rx: 6.4, ry: 3.4, fill: skinShade });
  s.push(...topShapes(topStyle, top, skin));
  // Ears, then the head over them.
  if (!COVERS_EARS.has(hairStyle)) {
    s.push({ t: 'ellipse', cx: 34, cy: 47, rx: 3.6, ry: 4.8, fill: skin });
    s.push({ t: 'ellipse', cx: 66, cy: 47, rx: 3.6, ry: 4.8, fill: skin });
    s.push({ t: 'path', d: 'M33.4 45 Q32 47 33.6 49.4', stroke: skinShade, sw: 1 });
    s.push({ t: 'path', d: 'M66.6 45 Q68 47 66.4 49.4', stroke: skinShade, sw: 1 });
  }
  s.push({ t: 'ellipse', cx: 50, cy: 45, rx: 16, ry: 19, fill: skin });
  // Facial hair sits under the features so the smile always shows.
  if (acc === 'stubble') {
    s.push({ t: 'path', d: 'M34.4 49 C35.4 59.5 41.6 64 50 64 C58.4 64 64.6 59.5 65.6 49 C63 55.6 58.6 58.2 55.4 58.4 C53.6 54.6 46.4 54.6 44.6 58.4 C41.4 58.2 37 55.6 34.4 49 Z', fill: facial, op: 0.26 });
  } else if (acc === 'beard' || acc === 'beard+glasses') {
    s.push({
      t: 'path',
      d: 'M34.2 46 C34 60 41 66.8 50 66.8 C59 66.8 66 60 65.8 46 C64.4 52.6 61.4 56.2 57.4 56.8 C55.6 60.8 44.4 60.8 42.6 56.8 C38.6 56.2 35.6 52.6 34.2 46 Z',
      fill: facial,
    });
    s.push({ t: 'path', d: 'M43.6 55.4 C46.4 53 53.6 53 56.4 55.4 C53.4 56.4 46.6 56.4 43.6 55.4 Z', fill: facial });
  }
  // Cheeks, eyes, brows, nose, smile.
  s.push({ t: 'circle', cx: 40, cy: 53, r: 2.8, fill: '#FF7A6B', op: 0.16 });
  s.push({ t: 'circle', cx: 60, cy: 53, r: 2.8, fill: '#FF7A6B', op: 0.16 });
  s.push({ t: 'ellipse', cx: 43.6, cy: 47, rx: 1.9, ry: 2.2, fill: ink });
  s.push({ t: 'ellipse', cx: 56.4, cy: 47, rx: 1.9, ry: 2.2, fill: ink });
  s.push({ t: 'circle', cx: 44.2, cy: 46.3, r: 0.6, fill: '#FFFFFF', op: 0.9 });
  s.push({ t: 'circle', cx: 57, cy: 46.3, r: 0.6, fill: '#FFFFFF', op: 0.9 });
  s.push({ t: 'path', d: 'M40.2 42.2 Q43.4 40.4 46.6 41.6', stroke: brow, sw: 1.6 });
  s.push({ t: 'path', d: 'M53.4 41.6 Q56.6 40.4 59.8 42.2', stroke: brow, sw: 1.6 });
  s.push({ t: 'path', d: 'M49.6 49.6 Q48.6 52.6 50.8 52.8', stroke: skinShade, sw: 1.2 });
  s.push({ t: 'path', d: 'M45.6 56.2 Q50 60.6 54.4 56.2 Q50 57.6 45.6 56.2 Z', fill: ink, stroke: ink, sw: 0.8 });
  s.push(...hairFront(hairStyle, hair));
  // Accessories in front of everything.
  if ((acc === 'earrings' || acc === 'earrings+glasses') && !COVERS_EARS.has(hairStyle)) {
    s.push({ t: 'circle', cx: 34, cy: 54.4, r: 2.2, stroke: '#D9AE52', sw: 1.1 });
    s.push({ t: 'circle', cx: 66, cy: 54.4, r: 2.2, stroke: '#D9AE52', sw: 1.1 });
  }
  if (acc === 'glasses' || acc === 'sunglasses' || acc === 'earrings+glasses' || acc === 'beard+glasses') {
    const dark = acc === 'sunglasses';
    const frame = '#18181A';
    const lens = dark ? '#1E1F23' : undefined;
    s.push({ t: 'rect', x: 38, y: 43.2, w: 10.6, h: 8, rx: 3.4, stroke: frame, sw: 1.5, fill: lens });
    s.push({ t: 'rect', x: 51.4, y: 43.2, w: 10.6, h: 8, rx: 3.4, stroke: frame, sw: 1.5, fill: lens });
    if (dark) s.push({ t: 'path', d: 'M40.4 45.4 L42.8 45.4 M53.8 45.4 L56.2 45.4', stroke: '#FFFFFF', sw: 0.9, op: 0.35 });
    s.push({ t: 'path', d: 'M48.6 46.4 Q50 45.2 51.4 46.4', stroke: frame, sw: 1.3 });
    if (!COVERS_EARS.has(hairStyle)) {
      s.push({ t: 'path', d: 'M38 45.6 L34.6 45 M62 45.6 L65.4 45', stroke: frame, sw: 1.2 });
    }
  }
  return s;
}

/** The figure is drawn at a comfortable scale, then framed like a portrait: head and shoulders fill the circle. */
export const AVATAR_FRAME = 'translate(-10 -7.5) scale(1.2)';
