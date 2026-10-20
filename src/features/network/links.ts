/**
 * A professional's own links (LinkedIn, website, Instagram, TikTok), as they
 * are typed in the profile editor and as they are opened from a profile.
 *
 * The same rules as the server (migration 20261024008000_irly_pro_links,
 * CHECK constraints on pro_profiles): https only, at most 200 characters, the
 * platform's own host and profile path for LinkedIn, Instagram and TikTok, and
 * a plain https address with a real domain name for a website (no IP address,
 * no port, no user:password@, no spaces). What people type is normalised
 * first ("@nora", "instagram.com/nora", "linkedin.com/in/nora", "nora.studio")
 * so the common ways of writing a link work, and nothing else is ever stored
 * or opened.
 */

export type LinkKind = 'linkedin' | 'website' | 'instagram' | 'tiktok';

export type ProLinks = Record<LinkKind, string | null>;

export const NO_LINKS: ProLinks = { linkedin: null, website: null, instagram: null, tiktok: null };

export const LINK_KINDS: { id: LinkKind; label: string; column: 'linkedin_url' | 'website_url' | 'instagram_url' | 'tiktok_url'; placeholder: string; icon: 'briefcase' | 'globe' | 'camera' | 'music' }[] = [
  { id: 'linkedin', label: 'LinkedIn', column: 'linkedin_url', placeholder: 'linkedin.com/in/your-name', icon: 'briefcase' },
  { id: 'website', label: 'Website', column: 'website_url', placeholder: 'yourcompany.com', icon: 'globe' },
  { id: 'instagram', label: 'Instagram', column: 'instagram_url', placeholder: '@yourname', icon: 'camera' },
  { id: 'tiktok', label: 'TikTok', column: 'tiktok_url', placeholder: '@yourname', icon: 'music' },
];

export const MAX_LINK = 200;

const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company|school)\/[^\s/?#<>"']{2,100}\/?$/i;
const WEBSITE = /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}([/?#][^\s<>"'\\]*)?$/i;
const INSTAGRAM = /^https:\/\/(www\.)?instagram\.com\/[a-z0-9._]{1,30}\/?$/i;
const TIKTOK = /^https:\/\/(www\.)?tiktok\.com\/@[a-z0-9._]{2,24}\/?$/i;
const RULE: Record<LinkKind, RegExp> = { linkedin: LINKEDIN, website: WEBSITE, instagram: INSTAGRAM, tiktok: TIKTOK };

/** A stored link, re-checked before it is shown or opened (null: no button). */
export function safeLink(kind: LinkKind, url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  return u.length <= MAX_LINK && RULE[kind].test(u) ? u : null;
}

export type LinkResult = { ok: true; url: string | null } | { ok: false; error: string };

const bad = (error: string): LinkResult => ({ ok: false, error });

/** "https://www.Example.com/x" → host lowercased; anything that is not a URL → null. */
function split(raw: string): { host: string; rest: string } | null {
  const m = /^https:\/\/([^/?#]+)(.*)$/i.exec(raw);
  if (!m) return null;
  return { host: m[1].toLowerCase(), rest: m[2] };
}

/** Adds https:// to a bare address; refuses another scheme (http, javascript…). */
function withScheme(raw: string, upgradeHttp: boolean): string | null {
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) return upgradeHttp ? `https://${raw.slice(7)}` : null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/]+:\d+/.test(raw)) return null;
  return `https://${raw.replace(/^\/+/, '')}`;
}

const handle = (raw: string) => raw.replace(/^@/, '');

// Instagram pages that are not a profile (a post, a reel, the explore page…).
const NOT_A_PROFILE = new Set(['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct', 'about', 'legal']);

/**
 * What the member typed → the link stored (null: the field is empty), or the
 * reason it is refused. Platform links lose their tracking (?igsh=…, ?trk=…).
 */
export function normaliseLink(kind: LinkKind, input: string): LinkResult {
  const raw = input.trim();
  if (!raw) return { ok: true, url: null };
  if (raw.length > MAX_LINK) return bad('This link is too long');
  if (/\s/.test(raw)) return bad('A link has no spaces');

  if (kind === 'instagram' || kind === 'tiktok') {
    const site = kind === 'instagram' ? 'instagram.com' : 'tiktok.com';
    // A handle alone: "@nora.builds" or "nora.builds".
    const h = handle(raw);
    const isHandle = kind === 'instagram' ? /^[a-z0-9._]{1,30}$/i.test(h) : /^[a-z0-9._]{2,24}$/i.test(h);
    if (isHandle && !h.includes('.com') && !(kind === 'instagram' && NOT_A_PROFILE.has(h.toLowerCase()))) return { ok: true, url: kind === 'instagram' ? `https://www.instagram.com/${h}` : `https://www.tiktok.com/@${h}` };
    const full = withScheme(raw, true);
    const p = full ? split(full) : null;
    if (!p || (p.host !== site && p.host !== `www.${site}`)) return bad(kind === 'instagram' ? 'Use your instagram.com link or @name' : 'Use your tiktok.com link or @name');
    const path = p.rest.replace(/[?#].*$/, '').replace(/\/+$/, '');
    const m = kind === 'instagram' ? /^\/([a-z0-9._]{1,30})$/i.exec(path) : /^\/@([a-z0-9._]{2,24})$/i.exec(path);
    if (!m || (kind === 'instagram' && NOT_A_PROFILE.has(m[1].toLowerCase()))) return bad(kind === 'instagram' ? 'Use your profile link: instagram.com/name' : 'Use your profile link: tiktok.com/@name');
    const url = kind === 'instagram' ? `https://www.instagram.com/${m[1]}` : `https://www.tiktok.com/@${m[1]}`;
    return safeLink(kind, url) ? { ok: true, url } : bad('This link is not valid');
  }

  if (kind === 'linkedin') {
    const full = withScheme(raw, true);
    const p = full ? split(full) : null;
    if (!p || !/^([a-z]{2,3}\.)?linkedin\.com$/.test(p.host)) return bad('Use your linkedin.com link');
    const path = p.rest.replace(/[?#].*$/, '').replace(/\/+$/, '');
    const m = /^\/(in|company|school)\/([^\s/?#<>"']{2,100})$/i.exec(path);
    if (!m) return bad('Use your profile link: linkedin.com/in/name');
    const url = `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}`;
    return safeLink(kind, url) ? { ok: true, url } : bad('This link is not valid');
  }

  // Website: https only (an http:// address is refused, never silently changed).
  const full = withScheme(raw, false);
  if (!full) return bad('Use an https:// link');
  const p = split(full);
  if (!p) return bad('This link is not valid');
  if (p.host.includes('@')) return bad('This link is not valid');
  if (p.host.includes(':')) return bad('A link without a port number');
  const url = `https://${p.host}${p.rest}`;
  if (url.length > MAX_LINK) return bad('This link is too long');
  return safeLink('website', url) ? { ok: true, url } : bad('Use a website address like yourcompany.com');
}

/** "linkedin.com/in/nora", "nora.studio", "@nora": how a link reads on a profile. */
export function linkLabel(kind: LinkKind, url: string): string {
  const bare = url.replace(/^https:\/\/(www\.)?/i, '').replace(/\/$/, '');
  if (kind === 'instagram') return `@${bare.replace(/^instagram\.com\//i, '')}`;
  if (kind === 'tiktok') return bare.replace(/^tiktok\.com\//i, '');
  return bare.length > 40 ? `${bare.slice(0, 39)}…` : bare;
}
