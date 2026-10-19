import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { STATUS_LABEL, type CaseStatus } from './api';

export const ago = (iso: string) => timeAgo(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)));
export const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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

export function Card({ children, onPress, accessibilityLabel }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  const body = <View style={[styles.card, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
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

export function Stat({ label, value, icon, onPress, alert }: { label: string; value: number | string; icon: IconName; onPress?: () => void; alert?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.stat, { backgroundColor: t.c.surface, borderColor: alert ? t.c.live : t.c.line, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={18} color={alert ? t.c.live : t.c.textSecondary} />
      <Text variant="number" raw>
        {String(value)}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
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

export const adminStyles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  card: { padding: 14, gap: 8, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  stat: { flexBasis: '47%', flexGrow: 1, padding: 14, gap: 4, borderRadius: radius.xl, borderWidth: 1 },
});
