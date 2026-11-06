import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { resolveMention, type Mentionable } from '@/features/messages/communitySpace';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { radius } from '@/theme/tokens';
import type { TypeVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * What people write (posts, comments, chat messages), with its @mentions
 * highlighted and tappable (the profile opens) and its web addresses
 * tappable, each with a small chip naming the site. Nothing is fetched to
 * preview a link: the address is all that is shown.
 */

export type RichPiece = { kind: 'text'; text: string } | { kind: 'link'; text: string; url: string } | { kind: 'mention'; text: string; name: string };

// Letters of the names people write (Latin with accents, Greek, Cyrillic, Arabic, Japanese, Chinese, Korean).
const L = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u0600-\\u06FF\\u3040-\\u30FF\\u4E00-\\u9FFF\\uAC00-\\uD7AF';
const isLetter = new RegExp(`[${L}0-9]`);
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const MENTION_RE = new RegExp(`(^|[^${L}0-9_@.])@([${L}][${L}0-9'’_-]*)`, 'g');

/** An address as written, without the punctuation that ends the sentence after it. */
function trimUrl(raw: string): string {
  let u = raw.replace(/[.,;:!?…'"’”»]+$/u, '');
  // A closing bracket belongs to the address only when it opened one: « (see https://x.y) ».
  while (/[)\]}]$/.test(u)) {
    const close = u.slice(-1);
    const open = close === ')' ? '(' : close === ']' ? '[' : '{';
    if (u.split(open).length >= u.split(close).length) break;
    u = u.slice(0, -1).replace(/[.,;:!?…]+$/u, '');
  }
  return u;
}

/** The site of an address, for its chip (« instagram.com »). */
export function domainOf(url: string): string {
  const m = /^(?:https?:\/\/)?([^/?#:]+)/i.exec(url);
  return (m?.[1] ?? url).replace(/^www\./i, '').toLowerCase();
}

const hrefOf = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/**
 * The text cut into plain words, links and mentions. A mention is `@` and a
 * name, at the start of a word (an e-mail address is not one); a known name
 * of several words (« @Marie Claire ») is taken whole.
 */
export function parseRich(text: string, names: readonly string[] = []): RichPiece[] {
  const out: RichPiece[] = [];
  const marks: { at: number; end: number; piece: RichPiece }[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    if (url.length < 5 || !url.includes('.')) continue;
    marks.push({ at: m.index ?? 0, end: (m.index ?? 0) + url.length, piece: { kind: 'link', text: url, url: hrefOf(url) } });
  }
  const long = names.filter((n) => /\s/.test(n.trim())).sort((a, b) => b.length - a.length);
  for (const m of text.matchAll(MENTION_RE)) {
    const at = (m.index ?? 0) + m[1].length;
    if (marks.some((k) => at >= k.at && at < k.end)) continue;
    let name = m[2];
    const rest = text.slice(at + 1);
    const whole = long.find((n) => rest.toLowerCase().startsWith(n.toLowerCase()) && !isLetter.test(rest.charAt(n.length)));
    if (whole) name = rest.slice(0, whole.length);
    name = name.replace(/['’_-]+$/, '');
    marks.push({ at, end: at + 1 + name.length, piece: { kind: 'mention', text: `@${name}`, name } });
  }
  marks.sort((a, b) => a.at - b.at);
  let i = 0;
  for (const k of marks) {
    if (k.at < i) continue;
    if (k.at > i) out.push({ kind: 'text', text: text.slice(i, k.at) });
    out.push(k.piece);
    i = k.end;
  }
  if (i < text.length) out.push({ kind: 'text', text: text.slice(i) });
  return out;
}

export function openLink(url: string): void {
  void WebBrowser.openBrowserAsync(hrefOf(url)).catch(() => toast('Could not open this link', 'x', 'live'));
}

type Props = {
  text: string;
  variant?: TypeVariant;
  /** The text's colour (on a brand bubble: the colour on brand). */
  color?: string;
  /** On a brand background (my chat bubbles): links and mentions keep that colour, underlined. */
  onBrand?: boolean;
  /** People who may be mentioned here (thread authors, picked suggestions): a tap opens at once. */
  people?: readonly Mentionable[];
  /** The community the text belongs to: an unknown @Name is looked up among its members on tap. */
  communityId?: string | null;
  /** Or the post it belongs to: its community is read on the tap of an unknown @Name only. */
  postId?: string | null;
  selectable?: boolean;
  numberOfLines?: number;
  /** A chip per site linked, under the text (default on). */
  chips?: boolean;
  style?: StyleProp<TextStyle>;
};

export const RichText = memo(function RichText({ text, variant = 'body', color, onBrand, people, communityId, postId, selectable, numberOfLines, chips = true, style }: Props) {
  const t = useTheme();
  const router = useRouter();
  const names = useMemo(() => (people ?? []).map((p) => p.name), [people]);
  const pieces = useMemo(() => parseRich(text, names), [text, names]);
  const fg = color ?? t.c.text;
  // IRLY Girl: the rose of the space; IRLY: its one quiet accent (steel).
  const accent = onBrand ? fg : t.flavor === 'girl' ? t.c.brand : t.c.steel;
  const sites = useMemo(() => {
    if (!chips) return [];
    const seen = new Map<string, string>();
    for (const p of pieces) if (p.kind === 'link' && !seen.has(domainOf(p.url)) && seen.size < 2) seen.set(domainOf(p.url), p.url);
    return [...seen.entries()];
  }, [pieces, chips]);
  const openMention = (name: string) => {
    const known = people?.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    const go = (id: string | null) => (id ? router.push(`/person/${id}`) : toast('This profile is not available', 'user', 'brand'));
    if (known) return go(known.id);
    resolveMention(name, communityId, postId).then(go, () => toast('Can’t reach IRLY right now', 'x', 'live'));
  };
  const plain = pieces.length === 1 && pieces[0].kind === 'text';
  const body = (
    <Text variant={variant} raw color={fg} selectable={selectable} numberOfLines={numberOfLines} style={style}>
      {plain
        ? text
        : pieces.map((p, i) =>
            p.kind === 'text' ? (
              p.text
            ) : p.kind === 'link' ? (
              <Text key={i} variant={variant} raw color={accent} style={styles.link} onPress={() => openLink(p.url)} accessibilityRole="link" accessibilityLabel={tx('Open {site}', { site: domainOf(p.url) })}>
                {p.text}
              </Text>
            ) : (
              <Text key={i} variant={variant} raw color={accent} style={[styles.mention, onBrand ? styles.link : null]} onPress={() => openMention(p.name)} accessibilityRole="link" accessibilityLabel={tx('Open {name}’s profile', { name: p.name })}>
                {p.text}
              </Text>
            ),
          )}
    </Text>
  );
  if (!sites.length) return body;
  return (
    <View style={styles.wrap}>
      {body}
      <View style={styles.chips}>
        {sites.map(([site, url]) => (
          <PressableScale key={site} haptic="select" scaleTo={0.94} onPress={() => openLink(url)} style={[styles.chip, { borderColor: onBrand ? fg : t.c.line }]} accessibilityRole="link" accessibilityLabel={tx('Open {site}', { site })}>
            {onBrand ? null : <GlassLayer radius={radius.pill} level="thin" />}
            <Icon name="globe" size={12} color={onBrand ? fg : accent} strokeWidth={2.2} />
            <Text variant="caption" raw color={onBrand ? fg : t.c.textSecondary} numberOfLines={1} style={styles.site}>
              {site}
            </Text>
            <Icon name="arrowUpRight" size={12} color={onBrand ? fg : t.c.textTertiary} strokeWidth={2.2} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6, flexShrink: 1 },
  link: { textDecorationLine: 'underline' },
  mention: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, maxWidth: 220, paddingHorizontal: 9, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  site: { flexShrink: 1, fontWeight: '600' },
});
