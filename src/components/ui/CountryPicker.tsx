import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { findCountry, flagOf, searchCountries, type Country } from '@/data/countries';
import { useLang, useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Field } from './Controls';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Props = {
  /** The stored value: a country's English name (or older free text, shown as typed). */
  value: string | null | undefined;
  /** Called with the country's English name. */
  onChange: (english: string) => void;
  label?: string;
  placeholder?: string;
};

const ROW = 52;

/**
 * Choosing a country: a compact row (« 🇫🇷 France › ») opens a sheet with a
 * search field (English or French names, or the code) and the full list.
 * Picking closes the sheet; nothing else on the form changes.
 */
export function CountryPicker({ value, onChange, label = 'Where are you from?', placeholder = 'Choose a country' }: Props) {
  const t = useTheme();
  const tr = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const chosen = findCountry(value);
  const name = (c: Country) => (lang === 'fr' ? c.fr : c.en);
  const list = useMemo(() => searchCountries(q), [q]);
  // A value typed before the picker existed (not a known country) is still shown as it is.
  const summary = chosen ? name(chosen) : value?.trim() || tr(placeholder);

  const pick = (c: Country) => {
    haptic('select');
    onChange(c.en);
    setOpen(false);
    setQ('');
  };

  return (
    <>
      <PressableScale
        haptic="tap"
        scaleTo={0.98}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${tr(label)}: ${summary}`}
        style={[styles.row, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
      >
        <Text variant="titleS" raw style={styles.flag}>
          {chosen ? flagOf(chosen.code) : '🌍'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
          <Text variant="titleS" numberOfLines={1} raw tone={chosen || value?.trim() ? undefined : 'tertiary'}>
            {summary}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={t.c.textSecondary} />
      </PressableScale>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label} maxHeight={0.86}>
        <View style={{ paddingHorizontal: space.gutter, paddingBottom: space[3] }}>
          <Field icon="search" placeholder="Search a country" value={q} onChangeText={setQ} autoCorrect={false} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search a country" />
        </View>
        <FlatList
          data={list}
          keyExtractor={(c) => c.code}
          style={{ flexShrink: 1 }}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={16}
          windowSize={7}
          getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
          renderItem={({ item: c }) => {
            const on = chosen?.code === c.code;
            return (
              <PressableScale
                haptic={false}
                scaleTo={0.98}
                onPress={() => pick(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={name(c)}
                style={[styles.item, { backgroundColor: on ? t.c.brand : 'transparent' }]}
              >
                <Text variant="body" raw style={styles.flag}>
                  {flagOf(c.code)}
                </Text>
                <Text variant="body" color={on ? t.c.onBrand : t.c.text} raw numberOfLines={1} style={{ flex: 1 }}>
                  {name(c)}
                </Text>
                {on ? <Icon name="check" size={18} color={t.c.onBrand} strokeWidth={2.4} /> : null}
              </PressableScale>
            );
          }}
          ListEmptyComponent={
            <Text variant="bodyS" tone="secondary" style={{ padding: space[4] }}>
              {tr('No country called “{q}”.', { q: q.trim() })}
            </Text>
          }
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg, borderWidth: 1 },
  flag: { fontSize: 22, width: 30, textAlign: 'center' },
  list: { paddingHorizontal: space.gutter, paddingBottom: space[6] },
  item: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: radius.md },
});
