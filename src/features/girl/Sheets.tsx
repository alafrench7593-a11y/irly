import { useState } from 'react';
import { t as tx } from '@/i18n';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { PressableScale } from '@/motion/PressableScale';
import { font, radius, space } from '@/theme/tokens';
import { reasonLines } from './suggest';
import { AVAILABILITY, GOALS, INTERESTS, LANGUAGES, SPORTS, labelOf } from './taxonomy';
import { girl } from './theme';
import { REPORT_CATEGORIES, type Candidate, type Filters, type ReportCategory } from './types';
import { GButton, GChip, GSection, ScorePill, Wrap } from './ui';

const AGES: { label: string; min?: number; max?: number }[] = [
  { label: 'Any' },
  { label: '18–25', min: 18, max: 25 },
  { label: '25–30', min: 25, max: 30 },
  { label: '30–35', min: 30, max: 35 },
  { label: '35+', min: 35 },
];

/** Narrow discovery. Applies on "Show results"; "Reset" clears everything. */
export function FiltersSheet({
  visible,
  cityId,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  cityId: CityId;
  value: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Filters>(value);
  const city = CITIES[cityId];
  const one = (k: 'sport' | 'language' | 'goal' | 'area' | 'availability', id: string) => setF((x) => ({ ...x, [k]: x[k] === id ? undefined : id }));
  return (
    <Sheet visible={visible} onClose={onClose} title="Filters" subtitle="Only what members chose to show is used." maxHeight={0.9}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: 24, gap: space[5] }}>
        <GSection title="Interests">
          <Wrap>
            {INTERESTS.map((o) => (
              <GChip
                key={o.id}
                small
                label={o.label}
                selected={Boolean(f.interests?.includes(o.id))}
                onPress={() =>
                  setF((x) => {
                    const cur = x.interests ?? [];
                    return { ...x, interests: cur.includes(o.id) ? cur.filter((i) => i !== o.id) : [...cur, o.id] };
                  })
                }
              />
            ))}
          </Wrap>
        </GSection>
        <GSection title="Sport">
          <Wrap>
            {SPORTS.map((o) => (
              <GChip key={o.id} small label={o.label} selected={f.sport === o.id} onPress={() => one('sport', o.id)} />
            ))}
          </Wrap>
        </GSection>
        <GSection title="Looking for">
          <Wrap>
            {GOALS.map((o) => (
              <GChip key={o.id} small label={o.label} selected={f.goal === o.id} onPress={() => one('goal', o.id)} />
            ))}
          </Wrap>
        </GSection>
        <GSection title="Language">
          <Wrap>
            {LANGUAGES.map((o) => (
              <GChip key={o.id} small label={o.label} selected={f.language === o.id} onPress={() => one('language', o.id)} />
            ))}
          </Wrap>
        </GSection>
        <GSection title="Area">
          <Wrap>
            {city.areas.map((a) => (
              <GChip key={a.id} small label={a.name} selected={f.area === a.id} onPress={() => one('area', a.id)} />
            ))}
          </Wrap>
        </GSection>
        <GSection title="Available">
          <Wrap>
            {AVAILABILITY.map((o) => (
              <GChip key={o.id} small label={o.label} selected={f.availability === o.id} onPress={() => one('availability', o.id)} />
            ))}
          </Wrap>
        </GSection>
        <GSection title="Age">
          <Wrap>
            {AGES.map((a) => (
              <GChip key={a.label} small label={a.label} selected={f.ageMin === a.min && f.ageMax === a.max} onPress={() => setF((x) => ({ ...x, ageMin: a.min, ageMax: a.max }))} />
            ))}
          </Wrap>
        </GSection>
        <GChip icon="plane" label="Loves to travel" selected={Boolean(f.travel)} onPress={() => setF((x) => ({ ...x, travel: !x.travel }))} />
        <View style={styles.row}>
          <GButton label="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setF({ section: value.section })} />
          <GButton label="Show results" style={{ flex: 1.4 }} onPress={() => onApply(f)} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** Full profile, opened from a card: everything she chose to show. */
export function ProfileSheet({
  candidate: c,
  onClose,
  onConnect,
  onPass,
  onSave,
  onSafety,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onConnect: () => void;
  onPass: () => void;
  onSave: () => void;
  onSafety: () => void;
}) {
  const city = c ? CITIES[c.cityId as CityId] : undefined;
  return (
    <Sheet visible={Boolean(c)} onClose={onClose} maxHeight={0.92}>
      {c ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: 24, gap: space[5] }}>
          <View style={styles.hero}>
            {c.cover ? <Photo visual={{ photo: c.cover }} light="dubai" style={StyleSheet.absoluteFill} width={900} /> : null}
          </View>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text variant="displayM" color={girl.ink}>
                {c.firstName}
                {c.age ? `, ${c.age}` : ''}
              </Text>
              <Text variant="bodyS" color={girl.inkSoft}>
                {[city?.name, ...c.areas.slice(0, 2).map((a) => (city ? areaName(city, a) : a))].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <ScorePill score={c.score} />
          </View>
          {c.bio ? (
            <Text variant="body" color={girl.ink}>
              {c.bio}
            </Text>
          ) : null}
          <GSection title="You both">
            {reasonLines(c.reasons, labelOf, 8).map((l) => (
              <View key={l} style={styles.line}>
                <Icon name="check" size={14} color={girl.positive} strokeWidth={2.6} />
                <Text variant="bodyS" color={girl.ink}>
                  {l}
                </Text>
              </View>
            ))}
          </GSection>
          <Facet title="Looking for" ids={c.goals} />
          <Facet title="Interests" ids={c.interests} />
          <Facet title="Sports" ids={c.sports} />
          <Facet title="Favourite plans" ids={c.activities} />
          <Facet title="Languages" ids={c.languages} />
          <Facet title="Dream trips" ids={c.travel} />
          <View style={styles.row}>
            <GButton label="Not now" variant="secondary" icon="x" style={{ flex: 1 }} onPress={onPass} />
            <GButton label="Connect" icon="heartHandshake" style={{ flex: 1.4 }} onPress={onConnect} />
          </View>
          <View style={styles.row}>
            <PressableScale haptic="select" scaleTo={0.96} onPress={onSave} style={styles.link} accessibilityLabel={c.saved ? 'Remove from saved' : 'Save for later'}>
              <Icon name="bookmark" size={16} color={girl.ink} fill={c.saved ? girl.ink : 'none'} />
              <Text variant="label" color={girl.ink}>
                {c.saved ? 'Saved' : 'Save for later'}
              </Text>
            </PressableScale>
            <PressableScale haptic="select" scaleTo={0.96} onPress={onSafety} style={styles.link} accessibilityLabel="Block, report or hide">
              <Icon name="shield" size={16} color={girl.inkSoft} />
              <Text variant="label" color={girl.inkSoft}>
                Block or report
              </Text>
            </PressableScale>
          </View>
        </ScrollView>
      ) : (
        <View />
      )}
    </Sheet>
  );
}

function Facet({ title, ids }: { title: string; ids: string[] }) {
  if (!ids.length) return null;
  return (
    <GSection title={title}>
      <Wrap>
        {ids.map((id) => (
          <GChip key={id} small label={labelOf(id)} />
        ))}
      </Wrap>
    </GSection>
  );
}

/**
 * Safety: hide (pass), block, report with a category. Blocking hides both
 * people from each other everywhere and ends any match; reports open a
 * moderation case reviewed by the IRLY team.
 */
export function SafetySheet({
  name,
  visible,
  matched,
  onClose,
  onHide,
  onBlock,
  onReport,
  onUnmatch,
}: {
  name: string;
  visible: boolean;
  matched?: boolean;
  onClose: () => void;
  onHide: () => void;
  onBlock: () => void;
  onReport: (category: ReportCategory, details?: string) => void;
  onUnmatch?: () => void;
}) {
  const [mode, setMode] = useState<'menu' | 'report' | 'confirmBlock'>('menu');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const close = () => {
    setMode('menu');
    setCategory(null);
    setDetails('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={mode === 'report' ? tx('Report {name}', { name }) : mode === 'confirmBlock' ? tx('Block {name}?', { name }) : 'Safety'}>
      <View style={{ paddingHorizontal: space.gutter, paddingBottom: 24, gap: 10 }}>
        {mode === 'menu' ? (
          <>
            {!matched ? <Row icon="eye" label={tx('Hide {name}', { name })} hint="She won't appear in your discovery again." onPress={onHide} /> : null}
            {matched && onUnmatch ? <Row icon="x" label="Unmatch" hint="The match and your private chat end for both of you." onPress={onUnmatch} /> : null}
            <Row icon="shield" label={tx('Block {name}', { name })} hint="You won't see each other anywhere on IRLY." onPress={() => setMode('confirmBlock')} />
            <Row icon="flag" label={tx('Report {name}', { name })} hint="Our team reviews every report. She won't know who reported." onPress={() => setMode('report')} danger />
          </>
        ) : null}
        {mode === 'confirmBlock' ? (
          <>
            <Text variant="body" color={girl.inkSoft}>
              You won&apos;t see each other in IRLY Girl, chats or activities. Any match ends. You can unblock later in Settings.
            </Text>
            <GButton
              label={tx('Block {name}', { name })}
              icon="shield"
              onPress={() => {
                onBlock();
                close();
              }}
            />
            <GButton label="Cancel" variant="ghost" onPress={() => setMode('menu')} />
          </>
        ) : null}
        {mode === 'report' ? (
          <>
            <Wrap>
              {REPORT_CATEGORIES.map((r) => (
                <GChip key={r.id} small label={r.label} selected={category === r.id} onPress={() => setCategory(r.id)} />
              ))}
            </Wrap>
            <TextInput
              value={details}
              onChangeText={(v) => setDetails(v.slice(0, 1000))}
              placeholder={tx('What happened? (optional)')}
              placeholderTextColor={girl.inkFaint}
              multiline
              style={styles.input}
              accessibilityLabel="Details"
            />
            <GButton
              label="Send report"
              icon="flag"
              disabled={!category}
              onPress={() => {
                if (!category) return;
                onReport(category, details.trim() || undefined);
                close();
              }}
            />
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

function Row({ icon, label, hint, onPress, danger }: { icon: 'eye' | 'shield' | 'flag' | 'x'; label: string; hint: string; onPress: () => void; danger?: boolean }) {
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={styles.safetyRow} accessibilityLabel={label}>
      <View style={[styles.safetyIcon, { backgroundColor: danger ? '#FDE7E4' : girl.cream }]}>
        <Icon name={icon} size={18} color={danger ? '#C8443A' : girl.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleS" color={danger ? '#C8443A' : girl.ink}>
          {label}
        </Text>
        <Text variant="bodyS" color={girl.inkSoft}>
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  hero: { height: 300, borderRadius: radius.xxl, overflow: 'hidden', backgroundColor: girl.cream },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22, backgroundColor: girl.cream },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: girl.surface, borderWidth: 1, borderColor: girl.line },
  safetyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 90, borderRadius: radius.lg, padding: 12, backgroundColor: girl.cream, color: girl.ink, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
});
