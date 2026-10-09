import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GuideCard, Rail } from '@/components/cards/Blocks';
import { EventRow } from '@/components/cards/EventCards';
import { SessionCard } from '@/components/cards/ThingCards';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { BUSINESS_TOPICS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { BusinessGuide, BusinessTopicId, Professional } from '@/data/types';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { NetworkDoor } from '@/features/network/ui';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Business() {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [topic, setTopic] = useState<BusinessTopicId>(city.businessTopics[0]);
  const [open, setOpen] = useState<string | null>(null);

  const guides = content.guides.filter((g) => g.topic === topic);
  const pros = content.professionals.filter((p) =>
    topic === 'setup' || topic === 'visa' ? p.topic === topic || p.topic === 'professionals' : p.topic === topic,
  );
  const networking = content.events.filter((e) => e.category === 'networking' || e.category === 'business');
  const networkingSessions = content.sessions.filter((s) => s.kind === 'networking');

  return (
    <Page overline={`${city.name} · Business`} title="Build here" subtitle="From licence to first hire: the steps, and people to meet.">
      <View style={{ paddingHorizontal: space.gutter, marginBottom: space[5] }}>
        <NetworkDoor />
      </View>
      <View style={{ marginBottom: space[6] }}>
        <Rail gap={8}>
          {city.businessTopics.map((id) => (
            <Chip key={id} size="sm" label={BUSINESS_TOPICS[id].label} icon={BUSINESS_TOPICS[id].icon} selected={topic === id} onPress={() => setTopic(id)} />
          ))}
        </Rail>
      </View>

      <Animated.View key={topic} entering={enter.fade(0)} style={{ paddingHorizontal: space.gutter, gap: 12 }}>
        <Text variant="bodyS" tone="secondary">
          {BUSINESS_TOPICS[topic].blurb}
        </Text>

        {guides.map((g) => (
          <View key={g.id} style={{ gap: 10 }}>
            <GuideCard guide={g} onPress={() => setOpen(open === g.id ? null : g.id)} />
            {open === g.id ? <Steps guide={g} /> : null}
          </View>
        ))}

        {topic === 'networking' ? (
          <>
            {networkingSessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
            {networking.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </>
        ) : null}

        {pros.map((p, i) => (
          <Animated.View key={p.id} entering={enter.rise(i, 80)}>
            <ProCard pro={p} onProfile={p.personId ? () => router.push(`/person/${p.personId}`) : undefined} />
          </Animated.View>
        ))}

        {(topic === 'setup' || topic === 'visa') && (
          <View style={[styles.expert, { backgroundColor: t.c.brandSoft }]}>
            <Icon name={topic === 'visa' ? 'stamp' : 'briefcase'} size={22} color={t.c.brand} />
            <View style={{ flex: 1 }}>
              <Text variant="titleS">{topic === 'visa' ? 'IRLY VISA is coming' : 'IRLY PRO is coming'}</Text>
              <Text variant="bodyS" tone="secondary">
                {topic === 'visa' ? 'Guides, checklists and qualified advisers. Not available yet.' : 'Company pages, missions and business meetups. Not available yet.'}
              </Text>
            </View>
            <Button label="See" size="sm" variant="secondary" onPress={() => router.push(topic === 'visa' ? '/soon/visa' : '/soon/pro')} />
          </View>
        )}
      </Animated.View>
    </Page>
  );
}

function Steps({ guide }: { guide: BusinessGuide }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.rise(0)} style={[styles.steps, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      {guide.steps.map((s, i) => (
        <View key={s} style={styles.stepRow}>
          <View style={styles.rail}>
            <View style={[styles.stepDot, { backgroundColor: i === 0 ? t.c.brand : t.c.overlay, borderColor: t.c.brand }]}>
              <Text variant="caption" color={i === 0 ? '#FFFFFF' : t.c.text}>
                {i + 1}
              </Text>
            </View>
            {i < guide.steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: t.c.line }]} /> : null}
          </View>
          <Text variant="body" style={{ flex: 1, paddingTop: 3 }}>
            {s}
          </Text>
        </View>
      ))}
      <Text variant="caption" tone="tertiary">
        {guide.summary}
      </Text>
    </Animated.View>
  );
}

function ProCard({ pro, onProfile }: { pro: Professional; onProfile?: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.pro, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <PressableScale onPress={onProfile} disabled={!onProfile} scaleTo={0.98} style={styles.proTop}>
        <Avatar name={pro.name} hue={pro.hue} size={50} verified />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS">{pro.name}</Text>
          <Text variant="bodyS" tone="secondary" numberOfLines={1}>
            {pro.role} · {pro.org}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="star" size={12} color={t.accent} fill={t.accent} />
            <Text variant="caption" tone="secondary">
              {[pro.rating.toFixed(1), tx('{n} reviews', { n: pro.reviews }), pro.languages.map((l) => tx(l)).join(', ')].join(' · ')}
            </Text>
          </View>
        </View>
      </PressableScale>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Request intro"
            variant="secondary"
            size="sm"
            full
            haptic={false}
            onPress={() => {
              haptic('success');
              toast(tx('Intro requested with {name}', { name: pro.name.split(' ')[0] }), 'handshake', 'brand');
            }}
          />
        </View>
        {onProfile ? <Button label="Profile" size="sm" variant="ghost" onPress={onProfile} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, marginTop: 6 },
  steps: { padding: 16, gap: 4, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  stepRow: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 26 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepLine: { width: 2, flex: 1, minHeight: 14, marginVertical: 2 },
  pro: { padding: 14, gap: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  proTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
