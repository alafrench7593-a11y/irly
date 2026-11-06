import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type NativeSyntheticEvent, type TextInputSelectionChangeEventData } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Text } from '@/components/ui/Text';
import { MAX_MENTIONS, mentionsIn, rememberPeople, searchMentionable, type Mentionable } from '@/features/messages/communitySpace';
import { t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { duration, spring } from '@/motion/tokens';
import { PressableScale } from '@/motion/PressableScale';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * @mentions while writing (post composer, comments): typing `@` opens the
 * community's members whose name starts like what follows, from
 * community_members_list (one call per pause in typing). A pick writes
 * `@Name ` in the text; what is sent is the ids of the people picked whose
 * `@Name` is still in the text. Without a community (a profile post) or a
 * server, only `local` people are offered (the demo's thread authors).
 */

// `@` at the start of a word, then the beginning of a name, up to the caret.
const QUERY_RE = /(^|[\s(])@([^\s@]{0,30})$/;

export function useMentionComposer({ text, setText, communityId, local, me }: { text: string; setText: (v: string) => void; communityId: string | null; local?: readonly Mentionable[]; me?: string | null }) {
  const [caret, setCaret] = useState<number | null>(null);
  const [picked, setPicked] = useState<Mentionable[]>([]);
  const onSelectionChange = useCallback((e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => setCaret(e.nativeEvent.selection.end), []);
  const at = Math.min(caret ?? text.length, text.length);
  const match = QUERY_RE.exec(text.slice(0, at));
  const enabled = Boolean(communityId) || Boolean(local?.length);
  const query = enabled && match && picked.length < MAX_MENTIONS ? match[2] : null;

  const [found, setFound] = useState<{ q: string; rows: Mentionable[] } | null>(null);
  useEffect(() => {
    if (query === null || !communityId) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchMentionable(communityId, query).then((rows) => alive && setFound({ q: query, rows }));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, communityId]);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    const rows = communityId ? (found?.q === query ? found.rows : []) : (local ?? []).filter((p) => p.name.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(` ${q}`));
    const seen = new Set<string>();
    return rows.filter((p) => p.id !== me && !seen.has(p.id) && seen.add(p.id)).slice(0, 6);
  }, [query, communityId, found, local, me]);
  const loading = query !== null && Boolean(communityId) && found?.q !== query;

  const pick = useCallback(
    (p: Mentionable) => {
      const end = at;
      const head = text.slice(0, end);
      const m = QUERY_RE.exec(head);
      if (!m) return;
      const start = end - m[2].length - 1;
      const inserted = `@${p.name} `;
      setText(text.slice(0, start) + inserted + text.slice(end).replace(/^\s+/, ''));
      setCaret(start + inserted.length);
      rememberPeople([p]);
      setPicked((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    },
    [text, setText, at],
  );
  const mentions = useCallback((body: string) => mentionsIn(body, picked), [picked]);
  const reset = useCallback(() => setPicked([]), []);
  return { onSelectionChange, query, suggestions, loading, pick, picked, mentions, reset };
}

/** The members offered for an @mention, above the field; a tap writes the name. */
export const MentionSuggestions = memo(function MentionSuggestions({ query, suggestions, loading, onPick }: { query: string | null; suggestions: Mentionable[]; loading: boolean; onPick: (p: Mentionable) => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  if (query === null || (!loading && !suggestions.length && !query)) return null;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.springify(spring.snappy.duration).dampingRatio(spring.snappy.dampingRatio)}
      exiting={reduced ? undefined : FadeOut.duration(duration.fast)}
      style={[styles.panel, { boxShadow: t.shadow.card }]}
      accessibilityRole="list"
      accessibilityLabel={tx('People to mention')}
    >
      <GlassLayer radius={radius.lg} />
      {suggestions.length ? (
        suggestions.map((p) => (
          <PressableScale key={p.id} haptic="select" scaleTo={0.98} onPress={() => onPick(p)} style={styles.row} accessibilityRole="button" accessibilityLabel={tx('Mention {name}', { name: p.name })}>
            <Avatar name={p.name} hue={hueOf(p.id)} size={28} userId={p.id} />
            <Text variant="label" raw numberOfLines={1} style={{ flex: 1 }}>
              {p.name}
            </Text>
            <Text variant="caption" tone="tertiary" raw>
              @
            </Text>
          </PressableScale>
        ))
      ) : loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={t.c.textSecondary} />
        </View>
      ) : (
        <View style={styles.row}>
          <Text variant="caption" tone="secondary">
            No member with this name
          </Text>
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, overflow: 'hidden', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12 },
});
