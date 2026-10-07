import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { zoneOf, zonesOf } from '@/data/zones';
import { useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Chip, Field } from './Controls';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Palette = { ink: string; soft: string; surface: string; accent: string; line: string };

type Props = {
  cityId: CityId;
  /** One neighbourhood, or several with `multiple`. */
  value: string | string[] | null;
  onChange: (value: string) => void;
  multiple?: boolean;
  /** Most you can pick with `multiple`. */
  max?: number;
  /** Shown when nothing is chosen. */
  placeholder?: string;
  label?: string;
  palette?: Palette;
};

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Choosing a neighbourhood without a wall of chips: a compact row
 * (« 📍 Dubai Marina › ») opens a sheet with a search field, the city's
 * zones (Marina & JBR, Creek, MBR City…) and the neighbourhoods of the
 * zone you tapped. Typing searches every neighbourhood at once.
 */
export function AreaPicker({ cityId, value, onChange, multiple, max, placeholder = 'Choose a neighbourhood', label, palette }: Props) {
  const t = useTheme();
  const tr = useT();
  const city = CITIES[cityId];
  const zones = zonesOf(cityId);
  const chosen = (Array.isArray(value) ? value : value ? [value] : []).filter((id) => city.areas.some((a) => a.id === id));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const first = chosen[0] ? zoneOf(cityId, chosen[0]) : null;
  const [zone, setZone] = useState<string | null>(null);
  const activeZone = zone ?? first?.id ?? zones[0]?.id ?? null;
  // Where each zone chip sits, so the row opens on the active zone.
  const zoneRow = useRef<ScrollView>(null);
  const zoneX = useRef(new Map<string, number>());
  const showZone = (id: string | null, animated: boolean) => {
    const x = id ? zoneX.current.get(id) : undefined;
    if (x != null) zoneRow.current?.scrollTo({ x: Math.max(0, x - space.gutter), animated });
  };

  const c: Palette = palette ?? { ink: t.c.text, soft: t.c.textSecondary, surface: t.c.surface, accent: t.c.brand, line: t.c.line };

  const term = plain(q.trim());
  const inZone = zones.find((x) => x.id === activeZone);
  // Names that match come first, then the rest of a matching zone.
  const list = term
    ? [
        ...city.areas.filter((a) => plain(a.name).includes(term)),
        ...city.areas.filter((a) => !plain(a.name).includes(term) && plain(zoneOf(cityId, a.id)?.name ?? '').includes(term)),
      ]
    : inZone
      ? inZone.areas.map((id) => city.areas.find((a) => a.id === id)!).filter(Boolean)
      : city.areas;

  const summary = chosen.length
    ? chosen.length === 1
      ? city.areas.find((a) => a.id === chosen[0])!.name
      : tr('{n} neighbourhoods', { n: chosen.length })
    : tr(placeholder);

  const pick = (id: string) => {
    const on = chosen.includes(id);
    if (multiple && !on && max && chosen.length >= max) {
      haptic('warning');
      return;
    }
    haptic('select');
    onChange(id);
    if (!multiple) {
      setOpen(false);
      setQ('');
    }
  };

  return (
    <>
      <PressableScale
        haptic="tap"
        scaleTo={0.98}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label ? tr(label) + ': ' : ''}${summary}`}
        style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        <View style={[styles.pin, { backgroundColor: c.accent }]}>
          <Icon name="pin" size={15} color={palette ? '#FFFFFF' : t.c.onBrand} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          {label ? (
            <Text variant="caption" color={c.soft}>
              {label}
            </Text>
          ) : null}
          <Text variant="titleS" color={c.ink} numberOfLines={1} raw={chosen.length === 1}>
            {summary}
          </Text>
          {chosen.length === 1 && zoneOf(cityId, chosen[0]) ? (
            <Text variant="caption" color={c.soft} numberOfLines={1}>
              {tr(zoneOf(cityId, chosen[0])!.name)}
            </Text>
          ) : null}
        </View>
        <Icon name="chevronRight" size={18} color={c.soft} />
      </PressableScale>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? 'Where'} subtitle={city.name} maxHeight={0.86}>
        <View style={{ paddingHorizontal: space.gutter, gap: space[3] }}>
          <Field icon="search" placeholder="Search a neighbourhood" value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" />
        </View>
        {zones.length && !q.trim() ? (
          <ScrollView ref={zoneRow} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zones} keyboardShouldPersistTaps="handled">
            {zones.map((z) => (
              <View
                key={z.id}
                onLayout={(e) => {
                  zoneX.current.set(z.id, e.nativeEvent.layout.x);
                  if (z.id === activeZone) showZone(z.id, false);
                }}
              >
                <Chip
                  size="sm"
                  label={z.name}
                  selected={activeZone === z.id}
                  onPress={() => {
                    setZone(z.id);
                    showZone(z.id, true);
                  }}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: space[3] }} />
        )}
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {list.map((a, i) => {
            const on = chosen.includes(a.id);
            const z = q.trim() ? zoneOf(cityId, a.id) : null;
            return (
              <Animated.View key={`${activeZone}-${q.trim() ? 'q' : ''}-${a.id}`} entering={FadeIn.duration(180).delay(Math.min(i, 8) * 22)} layout={LinearTransition.springify().dampingRatio(0.9)}>
                <PressableScale
                  haptic={false}
                  scaleTo={0.98}
                  onPress={() => pick(a.id)}
                  accessibilityRole={multiple ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: on }}
                  style={[styles.item, { backgroundColor: on ? t.c.brand : 'transparent' }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="body" color={on ? t.c.onBrand : t.c.text} raw>
                      {a.name}
                    </Text>
                    {z ? (
                      <Text variant="caption" color={on ? t.c.onBrand : t.c.textSecondary}>
                        {tr(z.name)}
                      </Text>
                    ) : null}
                  </View>
                  {on ? <Icon name="check" size={18} color={t.c.onBrand} strokeWidth={2.4} /> : null}
                </PressableScale>
              </Animated.View>
            );
          })}
          {!list.length ? (
            <Text variant="bodyS" tone="secondary" style={{ padding: space[4] }}>
              {tr('No neighbourhood called “{q}” in {city}.', { q: q.trim(), city: city.name })}
            </Text>
          ) : null}
        </ScrollView>
        {multiple ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space[3] }}>
            <PressableScale haptic="tap" scaleTo={0.97} onPress={() => setOpen(false)} style={[styles.done, { backgroundColor: t.c.brand }]} accessibilityRole="button">
              <Text variant="label" color={t.c.onBrand}>
                {max ? tr('Done · {n}/{max}', { n: chosen.length, max }) : tr('Done')}
              </Text>
            </PressableScale>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  pin: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  zones: { paddingHorizontal: space.gutter, paddingVertical: space[3], gap: 8 },
  list: { paddingHorizontal: space.gutter - 6, paddingBottom: space[3] },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  done: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
