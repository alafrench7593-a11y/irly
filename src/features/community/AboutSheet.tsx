import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * « About »: what the community is, its rules (written by its team, shown
 * as written), IRLY's guidelines for its own communities, a few facts and
 * Report. Opened from the page header, on the real and the demo pages.
 */
export function AboutSheet({
  visible,
  onClose,
  name,
  about,
  aboutRaw,
  rules,
  rulesLoading = false,
  guidelines,
  facts = [],
  onReport,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  /** Its description (or tagline). */
  about: string | null;
  /** The description is the members' own words (never through the dictionary). */
  aboutRaw: boolean;
  rules: string | null;
  rulesLoading?: boolean;
  /** IRLY's own house rules (official communities), English keys. */
  guidelines?: readonly string[];
  facts?: { icon: IconName; text: string }[];
  onReport?: () => void;
}) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={tx('About')} subtitle={name} scroll>
      <View style={{ gap: 16, paddingBottom: 8, paddingHorizontal: space.gutter + 4 }}>
        <Text variant="body" raw={aboutRaw}>
          {about ?? tx('A community on IRLY.')}
        </Text>
        {facts.length ? (
          <View style={{ gap: 10 }}>
            {facts.map((f) => (
              <View key={f.text} style={styles.row}>
                <Icon name={f.icon} size={18} color={t.c.textSecondary} />
                <Text variant="bodyS" tone="secondary" style={{ flex: 1 }} raw>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.card}>
          <GlassLayer radius={radius.xl} />
          <View style={styles.row}>
            <Icon name="shield" size={18} color={t.c.text} />
            <Text variant="titleS" style={{ flex: 1 }}>
              Rules
            </Text>
          </View>
          {rulesLoading ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={14} width="90%" />
              <Skeleton height={14} width="70%" />
            </View>
          ) : rules ? (
            <Text variant="bodyS" raw selectable>
              {rules}
            </Text>
          ) : guidelines?.length ? null : (
            <Text variant="bodyS" tone="secondary">
              No rules written yet. Be kind: posts can be reported and removed by the community’s hosts.
            </Text>
          )}
          {guidelines?.map((g) => (
            <Text key={g} variant="bodyS" tone="secondary" raw>
              {`· ${tx(g)}`}
            </Text>
          ))}
        </View>
        {onReport ? <Button label="Report this community" icon="flag" variant="ghost" onPress={onReport} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { padding: 16, borderRadius: radius.xl, gap: 10, overflow: 'hidden' },
});
