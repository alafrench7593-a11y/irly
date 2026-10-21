import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { dateLocale, t as tx } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { enter } from '@/motion/enter';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { STATUS_LABEL, type CaseStatus } from './api';

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

export const adminStyles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  card: { gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
