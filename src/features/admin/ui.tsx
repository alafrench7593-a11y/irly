import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { a11y, dateLocale, t as tx } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { enter } from '@/motion/enter';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { DEMO } from '@/config/app';
import { STATUS_LABEL, useStaffRole, type CaseStatus, type StaffRole } from './api';

export const ago = (iso: string) => timeAgo(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)));
export const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Loading, error (with retry) and empty states shared by every back office list. */
export function Loadable<T>({ data, error, retry, empty, children }: { data: T[] | null; error: string | null; retry: () => void; empty: string; children: (rows: T[]) => ReactNode }) {
  const t = useTheme();
  if (error) {
    return (
      <View style={{ gap: space[2] }}>
        <Text variant="body" tone="secondary">
          {tx(error)}
        </Text>
        <Button label="Try again" variant="secondary" onPress={retry} />
      </View>
    );
  }
  if (data === null) return <ActivityIndicator color={t.c.text} style={{ marginTop: 24 }} />;
  if (!data.length) {
    return (
      <Text variant="body" tone="secondary">
        {empty}
      </Text>
    );
  }
  return <>{children(data)}</>;
}

/** A glass panel that rises into place (staggered by its index in a list) and sinks a little under the finger. */
export function Card({ children, onPress, accessibilityLabel, index = 0 }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string; index?: number }) {
  return (
    <Animated.View entering={enter.rise(Math.min(index, 8))}>
      <GlassCard level="regular" padding={14} onPress={onPress} accessibilityLabel={accessibilityLabel} style={styles.card}>
        {children}
      </GlassCard>
    </Animated.View>
  );
}

const STATUS_TONE: Record<CaseStatus, 'live' | 'accent' | 'brand' | 'positive' | 'secondary' | 'tertiary'> = {
  open: 'live',
  reviewing: 'accent',
  need_info: 'brand',
  actioned: 'positive',
  dismissed: 'secondary',
  closed: 'tertiary',
};

export function StatusPill({ status }: { status: CaseStatus }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.c.overlay }]}>
      <Text variant="caption" tone={STATUS_TONE[status]}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function Stat({ label, value, icon, onPress, alert, index = 0 }: { label: string; value: number | string; icon: IconName; onPress?: () => void; alert?: boolean; index?: number }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.pop(index)} style={styles.statWrap}>
      <GlassCard level="regular" padding={14} onPress={onPress} accessibilityLabel={label}>
        <View style={{ gap: 4 }}>
          <View style={[styles.statIcon, { backgroundColor: alert ? t.c.live : t.c.overlay }]}>
            <Icon name={icon} size={16} color={alert ? '#FFFFFF' : t.c.textSecondary} />
          </View>
          <Text variant="number" raw>
            {String(value)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {label}
          </Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

/** Shown when the server says the caller's role does not allow this screen. */
export function NoAccess() {
  return (
    <Text variant="body" tone="secondary">
      This part of the back office is not open to your role.
    </Text>
  );
}

/**
 * The role the back office screens go by. The demo build (no server) shows
 * them with example data as the owner would; elsewhere it is the server's
 * answer, and the server re-checks every call anyway.
 */
export function useAdminRole(): StaffRole | null | undefined {
  const role = useStaffRole();
  return DEMO ? 'owner' : role;
}

/** Loads once and on demand: data (null while loading), error, reload. */
export function useLoad<T>(fn: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fn().then(
      (x) => {
        setData(x);
        setError(null);
      },
      (e) => setError(e instanceof Error ? e.message : 'Could not load'),
    );
    // The key names what is loaded: a new key loads again (fn is a new closure each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

/** A one-line (or multi-line) text box in the back office style. */
export function AdminInput({ value, onChange, placeholder, label, multiline, max = 1000, autoCapitalize }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; multiline?: boolean; max?: number; autoCapitalize?: 'none' | 'sentences' }) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(x) => onChange(x.slice(0, max))}
      placeholder={tx(placeholder)}
      placeholderTextColor={t.c.textTertiary}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      style={[styles.input, multiline ? styles.multi : null, { color: t.c.text, backgroundColor: t.c.overlay }]}
      accessibilityLabel={a11y(label)}
    />
  );
}

/** A small label: value line in a sheet. */
export function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="tertiary" style={{ width: 110 }}>
        {label}
      </Text>
      <Text variant="bodyS" style={{ flex: 1 }} raw>
        {String(value)}
      </Text>
    </View>
  );
}

const STATE_TONE: Record<string, 'live' | 'accent' | 'positive' | 'secondary' | 'tertiary'> = {
  visible: 'positive',
  active: 'positive',
  hidden: 'live',
  suspended: 'live',
  banned: 'live',
  removed: 'live',
  cancelled: 'secondary',
  deleted: 'tertiary',
  expired: 'tertiary',
  past: 'tertiary',
};
const STATE_LABEL: Record<string, string> = {
  visible: 'Visible',
  active: 'Active',
  hidden: 'Hidden by the team',
  suspended: 'Suspended',
  banned: 'Banned',
  removed: 'Removed',
  cancelled: 'Cancelled',
  deleted: 'Deleted',
  expired: 'Expired',
  past: 'Past',
};

/** Where an item or an account stands, as a pill. */
export function StatePill({ state }: { state: string }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.c.overlay }]}>
      <Text variant="caption" tone={STATE_TONE[state] ?? 'secondary'} raw>
        {tx(STATE_LABEL[state] ?? 'Unknown')}
      </Text>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  card: { gap: 8 },
  input: { minHeight: 44, borderRadius: radius.lg, paddingHorizontal: 12, fontFamily: font.medium, fontSize: 15 },
  multi: { height: 96, paddingTop: 10, textAlignVertical: 'top' },
  fact: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
