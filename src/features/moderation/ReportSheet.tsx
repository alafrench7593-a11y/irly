import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { ReportCategory } from '@/features/server/engage';
import { blockUser, report, REPORT_CATEGORIES, type ReportTarget } from './moderation';
import { useReportStore } from './reportStore';

/**
 * Report anything (a profile, a message, a post…): pick what is wrong, add
 * details if you want, send. When a person is behind it, you can block them
 * in the same step.
 */
export function ReportSheet({
  target,
  name,
  onClose,
  onBlocked,
}: {
  /** null = closed. */
  target: ReportTarget | null;
  /** The person's first name, when there is one. */
  name?: string;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const t = useTheme();
  const tr = useT();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = target?.kind === 'profile' ? target.userId : (target?.userId ?? null);

  const close = () => {
    setCategory(null);
    setDetails('');
    setAlsoBlock(false);
    onClose();
  };

  const send = async () => {
    if (!target || !category || busy) return;
    setBusy(true);
    try {
      await report(target, category, details);
      if (alsoBlock && userId) {
        await blockUser(userId);
        onBlocked?.();
      }
      haptic('success');
      toast(alsoBlock ? tr('Reported and blocked. Thank you') : tr('Reported. Our team will review it'), 'flag', 'brand');
      close();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Could not send the report'), 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={Boolean(target)} onClose={close} title="Report" subtitle={tr('What is wrong? Only IRLY’s moderators see reports.')} maxHeight={0.9}>
      <View style={styles.body}>
        <View style={{ gap: 6 }} accessibilityRole="radiogroup">
          {REPORT_CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <PressableScale
                key={c.id}
                haptic="select"
                scaleTo={0.98}
                onPress={() => setCategory(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.option, { borderColor: on ? t.c.text : t.c.line, backgroundColor: on ? t.c.surface : 'transparent' }]}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {c.label}
                </Text>
                {on ? <Icon name="check" size={18} color={t.c.text} /> : null}
              </PressableScale>
            );
          })}
        </View>
        <Field placeholder="Details (optional)" value={details} onChangeText={setDetails} maxLength={1000} multiline accessibilityLabel={tr('Details')} />
        {userId ? (
          <PressableScale
            haptic="select"
            scaleTo={0.98}
            onPress={() => setAlsoBlock((b) => !b)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoBlock }}
            style={[styles.option, { borderColor: t.c.line }]}
          >
            <Icon name={alsoBlock ? 'check' : 'shield'} size={18} color={t.c.text} />
            <Text variant="body" style={{ flex: 1 }}>
              {name ? tr('Also block {name}', { name }) : tr('Also block this member')}
            </Text>
          </PressableScale>
        ) : null}
        <Button label="Send report" icon="flag" full loading={busy} disabled={!category} onPress={send} />
        <Text variant="caption" tone="tertiary" align="center">
          In danger? Contact local emergency services first.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[4], paddingBottom: space[2] },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
});

/** Mounted once at the root: the sheet opened by openReport() from any screen. */
export function ReportHost() {
  const target = useReportStore((s) => s.target);
  const name = useReportStore((s) => s.name);
  const close = useReportStore((s) => s.close);
  return <ReportSheet target={target} name={name} onClose={close} />;
}
