import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { a11y, dateLocale, t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { changeRegion, closeRegionChange, fetchMyRegion, useRegionChange } from './region';

/**
 * « Move to another region »: opened whenever a member with an account
 * picks a city of another region. It says what moving does (the account and
 * the private chats stay; the communities and the coming activities of the
 * region left are left), asks her to state that she lives there, and lets
 * the server decide: one move every 90 days, and the communities she owns
 * are handed over or deleted first.
 */
export function RegionChangeSheet() {
  const target = useRegionChange((s) => s.target);
  return (
    <Sheet visible={target !== null} onClose={closeRegionChange} title={tx('Move to another region')} scroll>
      {target ? <Body key={target} target={target} /> : null}
    </Sheet>
  );
}

const day = (ms: number) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));

function Body({ target }: { target: keyof typeof CITIES }) {
  const t = useTheme();
  const dest = DESTINATIONS[CITIES[target].destinationId];
  const [resident, setResident] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When the server will accept the next move (null: now, or not known).
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchMyRegion().then((r) => alive && setWaitUntil(r?.canChangeAt && r.canChangeAt > Date.now() ? r.canChangeAt : null));
    return () => {
      alive = false;
    };
  }, []);

  const move = async () => {
    if (!resident || busy || waitUntil) return;
    setBusy(true);
    setError(null);
    try {
      await changeRegion(target);
      haptic('success');
      toast(tx('Welcome to {name}', { name: dest.name }), 'check', 'brand');
      closeRegionChange();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(false);
    }
  };

  const facts: { icon: IconName; text: string }[] = [
    { icon: 'user', text: 'Your account, your profile and your private chats stay.' },
    { icon: 'users', text: 'You leave the communities of the region you are leaving, and their chats.' },
    { icon: 'calendar', text: 'Your seat in the activities coming up there is freed. What you organise stays yours.' },
    { icon: 'clock', text: 'A region is where you live: one move every 90 days.' },
  ];

  return (
    <View style={styles.body}>
      <Text variant="titleM" raw>
        {`${dest.flag} ${dest.name}`}
      </Text>
      <Text variant="body" tone="secondary">
        {tx('{name} is for people who live in {country}. You will see the people, communities, activities and Lives of that region only.', { name: dest.name, country: dest.shortName })}
      </Text>
      <View style={{ gap: 10 }}>
        {facts.map((f) => (
          <View key={f.text} style={styles.fact}>
            <Icon name={f.icon} size={18} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
              {f.text}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.declare, { overflow: 'hidden' }]}>
        <GlassLayer radius={radius.lg} />
        <Text variant="label" style={{ flex: 1 }}>
          {tx('I live in {country}', { country: dest.shortName })}
        </Text>
        <Switch value={resident} disabled={busy} onValueChange={setResident} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel={a11y('I live there')} />
      </View>
      {waitUntil ? (
        <Text variant="bodyS" tone="critical">
          {tx('You changed region recently. You can move again from {date}.', { date: day(waitUntil) })}
        </Text>
      ) : null}
      {error ? (
        <Text variant="bodyS" tone="critical">
          {tx(error)}
        </Text>
      ) : null}
      <Button label={tx('Move to {name}', { name: dest.name })} icon="check" full loading={busy} disabled={!resident || busy || waitUntil !== null} onPress={() => void move()} />
      <Button label="Cancel" variant="ghost" full disabled={busy} onPress={closeRegionChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingHorizontal: space.gutter + 4, paddingBottom: space[6] },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  declare: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
});
