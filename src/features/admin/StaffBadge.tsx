import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/useTheme';

/**
 * The Admin badge: shown next to the name of a member who holds the owner or
 * admin role. The server says who (public.staff_badges, read live from the
 * role table members cannot touch); nothing in the profile or the app sets
 * it, and it goes the moment the role does (5 minutes at most on screen).
 * Lookups of one screen are grouped into one request.
 */
const TTL = 5 * 60_000;
const known = new Map<string, { admin: boolean; at: number }>();
const waiting = new Map<string, Set<() => void>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function flush() {
  timer = null;
  const ids = [...waiting.keys()].slice(0, 200);
  const sb = supabase;
  if (!ids.length || !sb) return;
  const calls = ids.map((id) => [id, waiting.get(id)!] as const);
  ids.forEach((id) => waiting.delete(id));
  sb.rpc('staff_badges', { p_ids: ids }).then(({ data, error }) => {
    // A failed lookup shows no badge and asks again next time.
    const admins = new Set(((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id));
    for (const [id, cbs] of calls) {
      if (!error) known.set(id, { admin: admins.has(id), at: Date.now() });
      cbs.forEach((cb) => cb());
    }
  });
  if (waiting.size) timer = setTimeout(flush, 0);
}

export function useIsStaffAdmin(userId: string | null | undefined): boolean {
  const id = userId && UUID.test(userId) ? userId : null;
  // The answer lives in the shared cache; this only re-renders when it arrives.
  const [, bump] = useState(0);
  useEffect(() => {
    if (!id) return;
    const hit = known.get(id);
    if (hit && Date.now() - hit.at < TTL) return;
    let alive = true;
    const cb = () => alive && bump((n) => n + 1);
    const set = waiting.get(id) ?? new Set();
    set.add(cb);
    waiting.set(id, set);
    if (!timer) timer = setTimeout(flush, 30);
    return () => {
      alive = false;
      waiting.get(id)?.delete(cb);
    };
  }, [id]);
  return id ? Boolean(known.get(id)?.admin) : false;
}

/** The small "Admin" pill. `size` "md" on a profile, "sm" next to a name in a list. */
export function AdminBadge({ userId, size = 'sm' }: { userId: string | null | undefined; size?: 'sm' | 'md' }) {
  const t = useTheme();
  const admin = useIsStaffAdmin(userId);
  if (!admin) return null;
  const md = size === 'md';
  return (
    <View
      style={[styles.pill, md ? styles.md : styles.sm, { borderColor: t.c.text }]}
      accessibilityRole="text"
      accessibilityLabel={tx('IRLY admin')}
    >
      <Icon name="shield" size={md ? 13 : 10} color={t.c.text} />
      <Text variant="caption" style={[styles.label, md ? null : styles.small]}>
        Admin
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 999 },
  md: { gap: 4, paddingHorizontal: 9, paddingVertical: 3 },
  sm: { gap: 3, paddingHorizontal: 6, paddingVertical: 1 },
  label: { fontWeight: '700', letterSpacing: 0.3 },
  small: { fontSize: 10, lineHeight: 13 },
});
